import type { ReactNode } from 'react'

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string) || 'https://zhqazyivekavtsnsfwgm.supabase.co'
const ANON_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string) || 'sb_publishable_ODxl_hlVpNflwdo_M0aKqw_tzIjKCZd'
const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL as string) || 'https://developer-portal-wine.vercel.app'
const MAIN_APP_URL = (import.meta.env.VITE_MAIN_APP_URL as string) || 'https://parlon-app.vercel.app'

const curlSend = `curl -X POST '${SUPABASE_URL}/rest/v1/rpc/bot_send_message' \\
  -H 'apikey: ${ANON_KEY}' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "p_token": "parlon_ваш_токен",
    "p_channel_id": "uuid-канала",
    "p_content": "Привет из curl!",
    "p_components": [
      {"type":"action_row","buttons":[
        {"type":"button","custom_id":"again","label":"Ещё раз","style":"primary","disabled":false}
      ]}
    ]
  }'`

const curlPoll = `curl -X POST '${SUPABASE_URL}/rest/v1/rpc/bot_poll' \\
  -H 'apikey: ${ANON_KEY}' \\
  -H 'Authorization: Bearer ${ANON_KEY}' \\
  -H 'Content-Type: application/json' \\
  -d '{"p_token": "parlon_ваш_токен", "p_since": null, "p_limit": 50}'`

const pyInstall = `pip install parlon-bot`

const pyQuickstart = `from parlon_bot import Bot, Button, ActionRow

bot = Bot(token="parlon_ваш_токен")  # создаётся на этом портале → "Приложения"

@bot.on_message
def handle_message(message):
    if message.content == "!ping":
        message.reply(
            "Понг! Нажми кнопку:",
            components=[ActionRow(Button(label="Ещё раз", custom_id="ping_again", style="primary"))],
        )

@bot.on_button_click
def handle_click(interaction):
    if interaction.custom_id == "ping_again":
        interaction.respond("Понг! 🏓")
        # или отредактировать исходное сообщение и убрать кнопку:
        # interaction.update_message(components=[])

bot.run()  # блокирующий цикл, опрос раз в ~2 секунды (bot.poll_interval)`

const inviteExample = `${PORTAL_URL}/authorize?client_id=<ID_приложения>&permissions=read_messages,send_messages&redirect_uri=https://ваш-сайт.com/callback`

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="dp-card" id={id}>
      <h2>{title}</h2>
      {children}
    </section>
  )
}

export function Docs() {
  return (
    <div className="dp-page dp-docs">
      <div className="dp-page-header">
        <h1>Документация · api beta 0.1</h1>
      </div>
      <p className="dp-muted">
        Как в Discord: мессенджер (<a href={MAIN_APP_URL} target="_blank" rel="noreferrer">parlon-app</a>) и платформа для ботов —
        два разных продукта на одном аккаунте. Здесь — всё, что нужно, чтобы создать бота, получить токен, установить
        его на сервер и отправлять сообщения с кнопками через REST API или Python-библиотеку.
      </p>

      <nav className="dp-docs-nav">
        <a href="#start">1. Быстрый старт</a>
        <a href="#model">2. Как это устроено</a>
        <a href="#api">3. REST API</a>
        <a href="#python">4. Python-библиотека</a>
        <a href="#buttons">5. Кнопки (компоненты)</a>
        <a href="#invite">6. Ссылка авторизации</a>
        <a href="#limits">7. Что уже есть / что дальше</a>
      </nav>

      <Section id="start" title="1. Быстрый старт">
        <ol className="dp-doc-steps">
          <li>Зайдите или зарегистрируйтесь на этом портале — это тот же аккаунт, что в <a href={MAIN_APP_URL} target="_blank" rel="noreferrer">parlon-app</a>.</li>
          <li>Откройте «Приложения» → «Создать приложение», задайте имя.</li>
          <li>Скопируйте токен — он показывается только один раз (как в Discord Developer Portal).</li>
          <li>Готово: приложению уже создан персистентный тестовый сервер «… Sandbox» с установленным ботом — он никогда не сбрасывается, откройте <a href={MAIN_APP_URL} target="_blank" rel="noreferrer">parlon-app</a> тем же аккаунтом и увидите его в списке серверов слева.</li>
          <li>
            Отправьте первое сообщение: <code>pip install parlon-bot</code>, вставьте токен в пример из раздела{' '}
            <a href="#python">Python-библиотека</a> и запустите.
          </li>
        </ol>
      </Section>

      <Section id="model" title="2. Как это устроено (по модели Discord)">
        <ul className="dp-doc-list">
          <li><b>Приложение и токен</b> — на странице приложения можно один раз увидеть токен и сбросить его («Reset Token»); старый токен сразу отключается.</li>
          <li><b>Sandbox, который никогда не сбрасывается</b> — обычная запись в таблице серверов, создаётся один раз при создании приложения и живёт как любой другой сервер: переживает деплои и перезапуски.</li>
          <li>
            <b>«Add to server» / авторизация</b> — вы создаёте ссылку вида <code>/authorize?client_id=...&permissions=...</code>, отдаёте
            её владельцу сервера; он открывает её, выбирает сервер и подтверждает — «ты даёшь доступ мне, я даю доступ тебе», как OAuth2-инвайт бота в Discord.
          </li>
          <li><b>Только HTTP</b> — библиотека и любой другой клиент общаются с ботом через несколько защищённых SQL-функций (RPC) поверх обычного REST, без отдельного бэкенда.</li>
        </ul>
      </Section>

      <Section id="api" title="3. REST API">
        <p className="dp-muted">
          Базовый URL: <code>{SUPABASE_URL}</code>. Каждый вызов — <code>POST /rest/v1/rpc/&lt;функция&gt;</code> с заголовками{' '}
          <code>apikey</code> и <code>Authorization: Bearer</code>, где значение — публичный anon-ключ ниже (он не даёт прав сам по себе,
          все проверки идут по вашему токену бота внутри функции):
        </p>
        <pre className="dp-code">{`apikey: ${ANON_KEY}`}</pre>

        <table className="dp-table">
          <thead>
            <tr><th>Функция</th><th>Параметры</th><th>Возвращает</th></tr>
          </thead>
          <tbody>
            <tr>
              <td><code>bot_send_message</code></td>
              <td><code>p_token, p_channel_id, p_content, p_components?</code></td>
              <td>отправленное сообщение (строка <code>messages</code>)</td>
            </tr>
            <tr>
              <td><code>bot_edit_message</code></td>
              <td><code>p_token, p_message_id, p_content?, p_components?</code></td>
              <td>обновлённое сообщение; <code>p_components: []</code> убирает кнопки</td>
            </tr>
            <tr>
              <td><code>bot_poll</code></td>
              <td><code>p_token, p_since?, p_limit?</code> (по умолчанию 50)</td>
              <td><code>{'{ server_time, messages: [], interactions: [] }'}</code></td>
            </tr>
            <tr>
              <td><code>bot_authenticate</code></td>
              <td><code>p_token</code></td>
              <td>строка бота, если токен активен (иначе ошибка)</td>
            </tr>
            <tr>
              <td><code>reset_bot_token</code></td>
              <td><code>p_bot_id</code> (нужна сессия владельца — вызывается порталом)</td>
              <td><code>{'{ token, token_prefix }'}</code> — новый токен, старый отозван</td>
            </tr>
          </tbody>
        </table>

        <p className="dp-muted" style={{ marginTop: 14 }}>Пример: отправить сообщение с кнопкой —</p>
        <pre className="dp-code">{curlSend}</pre>
        <p className="dp-muted" style={{ marginTop: 14 }}>Пример: опросить новые сообщения и клики по кнопкам —</p>
        <pre className="dp-code">{curlPoll}</pre>
      </Section>

      <Section id="python" title="4. Python-библиотека parlon-bot">
        <p className="dp-muted">
          Опубликована на PyPI: <a href="https://pypi.org/project/parlon-bot/" target="_blank" rel="noreferrer">pypi.org/project/parlon-bot</a>.
          Внутри — тот же REST API из раздела выше, обёрнутый в удобный класс <code>Bot</code>.
        </p>
        <pre className="dp-code">{pyInstall}</pre>
        <pre className="dp-code">{pyQuickstart}</pre>
        <table className="dp-table">
          <thead><tr><th>Класс / метод</th><th>Что делает</th></tr></thead>
          <tbody>
            <tr><td><code>Bot(token=...)</code></td><td>клиент бота; необязательно: <code>poll_interval</code> (сек, по умолчанию 2.0)</td></tr>
            <tr><td><code>@bot.on_message</code></td><td>вызывается на каждое новое сообщение на сервере, где установлен бот</td></tr>
            <tr><td><code>@bot.on_button_click</code></td><td>вызывается при клике по кнопке, которую отправил бот</td></tr>
            <tr><td><code>message.reply(text, components=...)</code></td><td>ответить в тот же канал</td></tr>
            <tr><td><code>interaction.respond(...)</code> / <code>.update_message(...)</code></td><td>ответить новым сообщением или отредактировать исходное</td></tr>
            <tr><td><code>Button(label, custom_id, style, disabled)</code></td><td>style: primary / secondary / success / danger</td></tr>
            <tr><td><code>ActionRow(*buttons)</code></td><td>до 5 кнопок в одном ряду</td></tr>
            <tr><td><code>bot.run()</code></td><td>блокирующий цикл опроса; <code>bot.stop()</code> — остановить</td></tr>
          </tbody>
        </table>
      </Section>

      <Section id="buttons" title="5. Кнопки (компоненты)">
        <p className="dp-muted">
          В api beta 0.1 поддерживаются текст и кнопки. Кнопка — JSON вида{' '}
          <code>{'{"type":"button","custom_id":"...","label":"...","style":"primary","disabled":false}'}</code>, кнопки
          группируются в <code>action_row</code> (до 5 в ряд). Мессенджер сам рисует кнопки под сообщением бота; клик
          участника попадает в <code>bot_poll()</code> как <code>interaction</code> с тем же <code>custom_id</code>.
          Картинки/вложения в кнопках и сообщениях — сознательно отложены на будущую версию, добавятся через сайт.
        </p>
      </Section>

      <Section id="invite" title="6. Ссылка авторизации («Add to server»)">
        <p className="dp-muted">На странице приложения такая ссылка генерируется автоматически. Формат:</p>
        <pre className="dp-code">{inviteExample}</pre>
        <p className="dp-muted">
          <code>client_id</code> — id приложения · <code>permissions</code> — через запятую: <code>read_messages</code>,{' '}
          <code>send_messages</code>, <code>manage_messages</code> · <code>redirect_uri</code> — необязательно, куда вернуть
          пользователя после подтверждения. Владелец сервера открывает ссылку, выбирает сервер из своих, подтверждает —
          бот устанавливается с выбранными правами.
        </p>
      </Section>

      <Section id="limits" title="7. Что уже есть / что дальше">
        <ul className="dp-doc-list">
          <li>✅ Токены приложений, сброс токена, персистентный sandbox, REST API, библиотека на PyPI, кнопки, invite-ссылки.</li>
          <li>🚧 Позже: изображения/вложения в сообщениях и кнопках, вебхуки вместо опроса, слэш-команды.</li>
        </ul>
      </Section>
    </div>
  )
}
