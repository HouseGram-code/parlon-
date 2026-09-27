-- ============================================================
-- Parlon Bot Platform — API beta v0.1 (Discord-style bots)
-- Выполнить ПОСЛЕ schema.sql + roles.sql, один раз, в Supabase
-- Dashboard → SQL Editor → Run. Безопасно перезапускать.
--
-- Что добавляет:
--   • bot_applications / bots / bot_tokens — приложения-боты и их токены
--     (токен показывается ОДИН раз при создании/сбросе, как в Discord —
--     хранится только его sha256-хэш, plain text никогда не пишется в БД)
--   • bot_installations — какие боты подключены к каким серверам + права
--   • bot_interactions  — клики по кнопкам бота, ждущие ответа от бота
--   • messages.components / messages.bot_id — кнопки под сообщением бота
--   • каждому приложению автоматически и один раз создаётся персональный
--     "Sandbox"-сервер (обычная строка в public.servers) — он не пересоздаётся
--     и не сбрасывается при каждом визите на страницу песочницы, потому что
--     это обычные постоянные данные в Postgres, а не что-то in-memory.
--   • всё общение бот-библиотеки (PyPI-пакет) с Parlon идёт через
--     SECURITY DEFINER RPC-функции (bot_send_message/bot_edit_message/bot_poll),
--     вызываемые по обычному Supabase anon key + сам секретный токен бота
--     передаётся как параметр — отдельный сервер/бэкенд не нужен.
-- ============================================================

create extension if not exists pgcrypto;

-- ---------- новые колонки на существующих таблицах ----------
alter table public.profiles add column if not exists is_bot boolean not null default false;
alter table public.messages add column if not exists components jsonb;
alter table public.messages add column if not exists bot_id uuid;
create index if not exists messages_channel_created_idx on public.messages(channel_id, created_at);

-- ---------- BOT APPLICATIONS (как "Applications" в Discord Developer Portal) ----------
create table if not exists public.bot_applications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 2 and 50),
  description text not null default '',
  icon_url text,
  created_at timestamptz not null default now()
);
create index if not exists bot_applications_owner_idx on public.bot_applications(owner_id);

-- ---------- BOTS (1:1 с приложением; у бота есть обычный profiles-профиль,
--            поэтому его сообщения выглядят как сообщения обычного участника) ----------
create table if not exists public.bots (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.bot_applications(id) on delete cascade,
  user_id uuid not null unique references public.profiles(id) on delete cascade,
  token_prefix text,
  token_created_at timestamptz,
  token_last_used_at timestamptz,
  created_at timestamptz not null default now()
);
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_bot_id_fkey'
  ) then
    alter table public.messages add constraint messages_bot_id_fkey
      foreign key (bot_id) references public.bots(id) on delete set null;
  end if;
end $$;

-- When a bot's application is deleted, `bots` cascades away — but its shadow
-- auth.users/profiles row otherwise wouldn't, leaving an orphaned "ghost"
-- account behind. Clean it up too (cascades to profiles automatically).
create or replace function public.cleanup_bot_user()
returns trigger
language plpgsql
security definer set search_path = public, extensions
as $$
begin
  delete from auth.users where id = old.user_id;
  return old;
end;
$$;
drop trigger if exists bots_cleanup_user on public.bots;
create trigger bots_cleanup_user after delete on public.bots
  for each row execute procedure public.cleanup_bot_user();

-- ---------- BOT TOKENS (только хэш; секрет никогда не читается обратно) ----------
create table if not exists public.bot_tokens (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  token_hash text not null unique,
  token_prefix text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  last_used_at timestamptz
);
create unique index if not exists bot_tokens_one_active on public.bot_tokens(bot_id) where is_active;

-- ---------- BOT INSTALLATIONS (бот <-> сервер, права установки) ----------
create table if not exists public.bot_installations (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  server_id uuid not null references public.servers(id) on delete cascade,
  installed_by uuid references public.profiles(id) on delete set null,
  permissions text[] not null default array['read_messages','send_messages']::text[]
    check (permissions <@ array['read_messages','send_messages','manage_messages']::text[]),
  is_sandbox boolean not null default false,
  created_at timestamptz not null default now(),
  unique (bot_id, server_id)
);
create index if not exists bot_installations_server_idx on public.bot_installations(server_id);
create index if not exists bot_installations_bot_idx on public.bot_installations(bot_id);

-- ---------- BOT INTERACTIONS (клики по кнопкам, очередь для бота) ----------
create table if not exists public.bot_interactions (
  id uuid primary key default gen_random_uuid(),
  bot_id uuid not null references public.bots(id) on delete cascade,
  message_id uuid not null references public.messages(id) on delete cascade,
  channel_id uuid not null references public.channels(id) on delete cascade,
  server_id uuid not null references public.servers(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  custom_id text not null check (char_length(custom_id) between 1 and 100),
  created_at timestamptz not null default now(),
  acked_at timestamptz
);
create index if not exists bot_interactions_pending_idx on public.bot_interactions(bot_id) where acked_at is null;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.bot_applications enable row level security;
alter table public.bots enable row level security;
alter table public.bot_tokens enable row level security;
alter table public.bot_installations enable row level security;
alter table public.bot_interactions enable row level security;

-- applications: имя/иконка/описание не секретны (нужны для страницы согласия
-- на установку бота), поэтому читать может любой залогиненный; писать — только владелец
drop policy if exists "bot_applications_select_all" on public.bot_applications;
create policy "bot_applications_select_all" on public.bot_applications for select using (true);
drop policy if exists "bot_applications_insert_owner" on public.bot_applications;
create policy "bot_applications_insert_owner" on public.bot_applications for insert with check (owner_id = auth.uid());
drop policy if exists "bot_applications_update_owner" on public.bot_applications;
create policy "bot_applications_update_owner" on public.bot_applications for update using (owner_id = auth.uid());
drop policy if exists "bot_applications_delete_owner" on public.bot_applications;
create policy "bot_applications_delete_owner" on public.bot_applications for delete using (owner_id = auth.uid());

-- bots: тоже без секретов (только префикс токена + таймстемпы), видимость всем залогиненным
-- нужна, чтобы страница /authorize могла найти bot_id по application_id (client_id)
drop policy if exists "bots_select_all" on public.bots;
create policy "bots_select_all" on public.bots for select using (true);
drop policy if exists "bots_delete_owner" on public.bots;
create policy "bots_delete_owner" on public.bots for delete using (
  exists (select 1 from public.bot_applications a where a.id = application_id and a.owner_id = auth.uid())
);

-- bot_tokens: НИКТО не может читать напрямую (даже владелец) — единственный
-- способ увидеть сам токен это возврат RPC-функции в момент создания/сброса
drop policy if exists "bot_tokens_delete_owner" on public.bot_tokens;
create policy "bot_tokens_delete_owner" on public.bot_tokens for delete using (
  exists (select 1 from public.bots b join public.bot_applications a on a.id = b.application_id
          where b.id = bot_id and a.owner_id = auth.uid())
);

drop policy if exists "bot_installations_select_member_or_owner" on public.bot_installations;
create policy "bot_installations_select_member_or_owner" on public.bot_installations for select using (
  public.is_server_member(server_id)
  or exists (select 1 from public.bots b join public.bot_applications a on a.id = b.application_id
             where b.id = bot_id and a.owner_id = auth.uid())
);
drop policy if exists "bot_installations_insert_admin" on public.bot_installations;
create policy "bot_installations_insert_admin" on public.bot_installations for insert with check (
  installed_by = auth.uid() and public.has_server_permission(server_id, 'manage_server')
);
drop policy if exists "bot_installations_delete_admin_or_owner" on public.bot_installations;
create policy "bot_installations_delete_admin_or_owner" on public.bot_installations for delete using (
  public.has_server_permission(server_id, 'manage_server')
  or exists (select 1 from public.bots b join public.bot_applications a on a.id = b.application_id
             where b.id = bot_id and a.owner_id = auth.uid())
);

-- bot_interactions: любой участник сервера может создать "клик" по кнопке
-- существующего сообщения в этом канале; читать/подтверждать может только
-- SECURITY DEFINER функция bot_poll (она выполняется от имени владельца таблицы
-- и поэтому не ограничена RLS) — обычным пользователям и владельцу бота
-- select не открываем, чтобы никто кроме самого бота не видел очередь кликов
drop policy if exists "bot_interactions_insert_member" on public.bot_interactions;
create policy "bot_interactions_insert_member" on public.bot_interactions for insert with check (
  user_id = auth.uid()
  and public.is_server_member(server_id)
  and exists (
    select 1 from public.messages m join public.channels c on c.id = m.channel_id
    where m.id = message_id and c.id = channel_id and c.server_id = bot_interactions.server_id
      and m.components is not null
  )
);
drop policy if exists "bot_interactions_delete_owner" on public.bot_interactions;
create policy "bot_interactions_delete_owner" on public.bot_interactions for delete using (
  exists (select 1 from public.bots b join public.bot_applications a on a.id = b.application_id
          where b.id = bot_id and a.owner_id = auth.uid())
);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- cryptographically random token, "parlon_" prefix so it's recognizable
-- (mirrors bot_/xoxb-/sk- style prefixes used by other platforms)
create or replace function public.generate_bot_token()
returns table(token text, token_hash text, token_prefix text)
language plpgsql
as $$
declare
  raw text;
  full_token text;
begin
  raw := encode(gen_random_bytes(32), 'base64');
  raw := replace(replace(replace(raw, '+', '-'), '/', '_'), '=', '');
  full_token := 'parlon_' || raw;
  token := full_token;
  token_hash := encode(digest(full_token, 'sha256'), 'hex');
  token_prefix := substr(full_token, 1, 14) || '…';
  return next;
end;
$$;

-- Creates an application + its bot user profile + first token + a persistent
-- per-application "Sandbox" server (auto-joined owner, general channel, bot
-- pre-installed with full test permissions). Called from the developer portal
-- with the developer's own Supabase session (auth.uid()).
create or replace function public.create_bot_application(p_name text, p_description text, p_icon_url text)
returns jsonb
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_app public.bot_applications;
  v_bot public.bots;
  v_profile_id uuid := gen_random_uuid();
  v_token text; v_hash text; v_prefix text;
  v_sandbox_server public.servers;
  v_sandbox_channel public.channels;
begin
  if auth.uid() is null then
    raise exception 'auth_required';
  end if;

  insert into public.bot_applications (owner_id, name, description, icon_url)
  values (auth.uid(), p_name, coalesce(p_description, ''), p_icon_url)
  returning * into v_app;

  -- profiles.id is a foreign key to auth.users(id), and a real Supabase user
  -- account is needed for the bot's messages to look like a normal member's
  -- (author_id -> profiles.id). Bots never sign in, but we still create a
  -- minimal shadow auth.users row so the FK is satisfied; the existing
  -- on_auth_user_created trigger then auto-creates the matching profiles row
  -- (using raw_user_meta_data.username), which we immediately mark as a bot.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', v_profile_id, 'authenticated', 'authenticated',
    null, '', now(), now(), now(), '{"provider":"bot"}', jsonb_build_object('username', p_name)
  );
  update public.profiles set avatar_url = p_icon_url, is_bot = true where id = v_profile_id;

  insert into public.bots (application_id, user_id)
  values (v_app.id, v_profile_id)
  returning * into v_bot;

  select g.token, g.token_hash, g.token_prefix into v_token, v_hash, v_prefix
  from public.generate_bot_token() g;

  insert into public.bot_tokens (bot_id, token_hash, token_prefix)
  values (v_bot.id, v_hash, v_prefix);

  update public.bots set token_prefix = v_prefix, token_created_at = now() where id = v_bot.id;

  -- persistent sandbox: a normal server row, created exactly once per
  -- application. It lives in the same table as every real server, so it
  -- never resets — reopening the "Playground" tab just re-reads it.
  insert into public.servers (name, label, color, owner_id)
  values (p_name || ' Sandbox', 'BOT', '#57F287', auth.uid())
  returning * into v_sandbox_server;
  insert into public.server_members (server_id, user_id) values (v_sandbox_server.id, auth.uid());
  insert into public.server_roles (server_id, name, position, is_default)
    values (v_sandbox_server.id, '@everyone', 0, true);
  insert into public.channels (server_id, name, type) values (v_sandbox_server.id, 'general', 'text')
    returning * into v_sandbox_channel;
  insert into public.bot_installations (bot_id, server_id, installed_by, permissions, is_sandbox)
    values (v_bot.id, v_sandbox_server.id, auth.uid(),
            array['read_messages','send_messages','manage_messages'], true);

  return jsonb_build_object(
    'application', to_jsonb(v_app),
    'bot_id', v_bot.id,
    'bot_user_id', v_profile_id,
    'token', v_token,
    'token_prefix', v_prefix,
    'sandbox_server_id', v_sandbox_server.id,
    'sandbox_channel_id', v_sandbox_channel.id
  );
end;
$$;

-- Regenerates a bot's token (old one is revoked immediately), exactly like
-- Discord's "Reset Token" button. Only the application owner may call it.
create or replace function public.reset_bot_token(p_bot_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_owner uuid;
  v_token text; v_hash text; v_prefix text;
begin
  select a.owner_id into v_owner
  from public.bots b join public.bot_applications a on a.id = b.application_id
  where b.id = p_bot_id;

  if v_owner is null or v_owner <> auth.uid() then
    raise exception 'not_authorized';
  end if;

  update public.bot_tokens set is_active = false, revoked_at = now()
  where bot_id = p_bot_id and is_active;

  select g.token, g.token_hash, g.token_prefix into v_token, v_hash, v_prefix
  from public.generate_bot_token() g;

  insert into public.bot_tokens (bot_id, token_hash, token_prefix) values (p_bot_id, v_hash, v_prefix);
  update public.bots set token_prefix = v_prefix, token_created_at = now(), token_last_used_at = null
  where id = p_bot_id;

  return jsonb_build_object('token', v_token, 'token_prefix', v_prefix);
end;
$$;

-- Internal helper: resolves a plaintext token to its bot row, or raises.
-- Used by every public bot_* RPC below. Bypasses RLS (security definer,
-- owned by the table owner) — that's required since the SDK calls these
-- with the public anon key and no Supabase auth session at all.
create or replace function public.bot_authenticate(p_token text)
returns public.bots
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_hash text;
  v_bot public.bots;
begin
  if p_token is null or p_token = '' then
    raise exception 'invalid_token';
  end if;
  v_hash := encode(digest(p_token, 'sha256'), 'hex');
  select b.* into v_bot
  from public.bot_tokens t join public.bots b on b.id = t.bot_id
  where t.token_hash = v_hash and t.is_active;
  if v_bot.id is null then
    raise exception 'invalid_token';
  end if;
  update public.bot_tokens set last_used_at = now() where token_hash = v_hash;
  update public.bots set token_last_used_at = now() where id = v_bot.id;
  return v_bot;
end;
$$;

-- Send a message as a bot. p_components follows the shape documented in the
-- PyPI SDK / docs: [{"type":"action_row","buttons":[{"custom_id":"yes",
-- "label":"Yes","style":"primary"}, ...]}]
create or replace function public.bot_send_message(
  p_token text, p_channel_id uuid, p_content text, p_components jsonb default null
)
returns public.messages
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_bot public.bots;
  v_server_id uuid;
  v_perms text[];
  v_app public.bot_applications;
  v_msg public.messages;
begin
  v_bot := public.bot_authenticate(p_token);

  select server_id into v_server_id from public.channels where id = p_channel_id;
  if v_server_id is null then raise exception 'channel_not_found'; end if;

  select permissions into v_perms from public.bot_installations
  where bot_id = v_bot.id and server_id = v_server_id;
  if v_perms is null or not ('send_messages' = any(v_perms)) then
    raise exception 'bot_not_installed_or_missing_permission';
  end if;

  select * into v_app from public.bot_applications where id = v_bot.application_id;

  insert into public.messages (channel_id, author_id, author_name, author_color, author_avatar, content, components, bot_id)
  values (p_channel_id, v_bot.user_id, v_app.name, '#5865F2', v_app.icon_url, coalesce(p_content, ''), p_components, v_bot.id)
  returning * into v_msg;

  return v_msg;
end;
$$;

-- Edit / update a message the bot itself sent earlier (e.g. disable buttons
-- after they were used, or change the text based on an interaction).
create or replace function public.bot_edit_message(
  p_token text, p_message_id uuid, p_content text default null, p_components jsonb default null
)
returns public.messages
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_bot public.bots;
  v_msg public.messages;
  v_clear_components boolean := (p_components is not null and p_components::text = '[]');
begin
  v_bot := public.bot_authenticate(p_token);

  update public.messages
    set content = coalesce(p_content, content),
        components = case
          when v_clear_components then null
          when p_components is not null then p_components
          else components
        end
    where id = p_message_id and bot_id = v_bot.id
    returning * into v_msg;

  if v_msg.id is null then raise exception 'message_not_found_or_not_owner'; end if;
  return v_msg;
end;
$$;

-- Polling "gateway" for the SDK: new messages in installed servers since a
-- timestamp, plus any pending button-click interactions for this bot.
-- v0.1 uses simple short-interval polling (the SDK defaults to ~2s) instead
-- of a persistent socket — good enough for a beta, easy to swap later.
create or replace function public.bot_poll(p_token text, p_since timestamptz default null, p_limit int default 50)
returns jsonb
language plpgsql
security definer set search_path = public, extensions
as $$
declare
  v_bot public.bots;
  v_since timestamptz := coalesce(p_since, now() - interval '2 minutes');
  v_messages jsonb;
  v_interactions jsonb;
  v_now timestamptz := now();
begin
  v_bot := public.bot_authenticate(p_token);

  select coalesce(jsonb_agg(to_jsonb(m) order by m.created_at asc), '[]'::jsonb) into v_messages
  from (
    select msg.* from public.messages msg
    join public.channels c on c.id = msg.channel_id
    join public.bot_installations bi on bi.server_id = c.server_id and bi.bot_id = v_bot.id
    where msg.created_at > v_since
      and msg.bot_id is distinct from v_bot.id
      and 'read_messages' = any(bi.permissions)
    order by msg.created_at asc
    limit p_limit
  ) m;

  select coalesce(jsonb_agg(to_jsonb(i) order by i.created_at asc), '[]'::jsonb) into v_interactions
  from (
    select * from public.bot_interactions
    where bot_id = v_bot.id and acked_at is null
    order by created_at asc
    limit p_limit
  ) i;

  update public.bot_interactions set acked_at = v_now where bot_id = v_bot.id and acked_at is null;

  return jsonb_build_object('server_time', v_now, 'messages', v_messages, 'interactions', v_interactions);
end;
$$;

-- Servers the current user is allowed to install a bot into (owns the
-- server, or holds the 'manage_server' role permission on it). Used by the
-- /authorize consent screen on the developer portal to populate the server
-- picker without needing a service-role backend.
create or replace function public.list_installable_servers()
returns setof public.servers
language sql
security definer set search_path = public, extensions
stable
as $$
  select s.* from public.servers s
  where s.owner_id = auth.uid() or public.has_server_permission(s.id, 'manage_server')
  order by s.name;
$$;

-- ---------- REALTIME (для живого обновления Developer Portal) ----------
do $$
declare
  t text;
begin
  foreach t in array array['bot_installations'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ---------- ДАЛЕЕ ----------
-- 1) Разверните developer-portal/ (2-й сайт) с теми же VITE_SUPABASE_URL /
--    VITE_SUPABASE_PUBLISHABLE_KEY переменными окружения, что и основной сайт.
-- 2) Установите PyPI-библиотеку из sdk/python (см. sdk/python/README.md).
