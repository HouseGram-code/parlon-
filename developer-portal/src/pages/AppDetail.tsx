import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { BOT_PERMISSIONS, BotApplication, BotPermission, BotRow, PERMISSION_LABELS } from '../types'

const PORTAL_URL = (import.meta.env.VITE_PORTAL_URL as string) || window.location.origin
const MAIN_APP_URL = (import.meta.env.VITE_MAIN_APP_URL as string) || 'https://parlon-app.vercel.app'

function timeAgo(iso: string | null) {
  if (!iso) return 'никогда'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'только что'
  if (s < 3600) return `${Math.floor(s / 60)} мин назад`
  if (s < 86400) return `${Math.floor(s / 3600)} ч назад`
  return `${Math.floor(s / 86400)} дн назад`
}

export function AppDetail({ session, appId, navigate }: { session: Session; appId: string; navigate: (to: string) => void }) {
  const [app, setApp] = useState<BotApplication | null>(null)
  const [bot, setBot] = useState<BotRow | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [revealToken, setRevealToken] = useState<string | null>(null)
  const [resetBusy, setResetBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [perms, setPerms] = useState<BotPermission[]>(['read_messages', 'send_messages'])
  const [redirectUri, setRedirectUri] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconUrl, setIconUrl] = useState('')

  async function load() {
    const { data: appRow } = await supabase.from('bot_applications').select('*').eq('id', appId).maybeSingle()
    if (!appRow || appRow.owner_id !== session.user.id) {
      setNotFound(true)
      return
    }
    setApp(appRow as BotApplication)
    setName(appRow.name)
    setDescription(appRow.description ?? '')
    setIconUrl(appRow.icon_url ?? '')
    const { data: botRow } = await supabase.from('bots').select('*').eq('application_id', appId).maybeSingle()
    setBot((botRow as BotRow) ?? null)

    const pending = sessionStorage.getItem(`parlon_reveal_${appId}`)
    if (pending) {
      const { token } = JSON.parse(pending)
      setRevealToken(token)
      sessionStorage.removeItem(`parlon_reveal_${appId}`)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId])

  async function saveDetails() {
    setSaveBusy(true)
    try {
      const { error } = await supabase
        .from('bot_applications')
        .update({ name: name.trim(), description: description.trim(), icon_url: iconUrl.trim() || null })
        .eq('id', appId)
      if (!error) load()
    } finally {
      setSaveBusy(false)
    }
  }

  async function resetToken() {
    if (!bot) return
    if (!window.confirm('Старый токен сразу перестанет работать. Продолжить?')) return
    setResetBusy(true)
    try {
      const { data, error } = await supabase.rpc('reset_bot_token', { p_bot_id: bot.id })
      if (!error) {
        setRevealToken(data.token as string)
        load()
      }
    } finally {
      setResetBusy(false)
    }
  }

  async function deleteApp() {
    if (!window.confirm(`Удалить приложение «${app?.name}»? Это отключит бота от всех серверов и удалит токен.`)) return
    await supabase.from('bot_applications').delete().eq('id', appId)
    navigate('/apps')
  }

  function copy(text: string, label: string) {
    navigator.clipboard?.writeText(text)
    setCopied(label)
    setTimeout(() => setCopied(null), 1500)
  }

  if (notFound) {
    return (
      <div className="dp-page">
        <p className="dp-muted">Приложение не найдено, или оно вам не принадлежит.</p>
        <button className="dp-btn" onClick={() => navigate('/apps')}>
          ← К списку приложений
        </button>
      </div>
    )
  }
  if (!app || !bot) return <div className="dp-page dp-muted">Загрузка…</div>

  const inviteUrl = `${PORTAL_URL}/authorize?client_id=${app.id}&permissions=${perms.join(',')}${
    redirectUri.trim() ? `&redirect_uri=${encodeURIComponent(redirectUri.trim())}` : ''
  }`

  const pySnippet = `pip install parlon-bot

from parlon_bot import Bot, Button, ActionRow

bot = Bot(token="${revealToken ?? 'PARLON_BOT_TOKEN'}")

@bot.on_message
async def handle_message(message):
    if message.content == "!ping":
        await message.channel.send(
            "Понг! Нажми кнопку:",
            components=[ActionRow(Button(label="Ещё раз", custom_id="ping_again", style="primary"))],
        )

@bot.on_button_click
async def handle_click(interaction):
    if interaction.custom_id == "ping_again":
        await interaction.channel.send("Понг! 🏓")

bot.run()`

  return (
    <div className="dp-page">
      <button className="dp-link" onClick={() => navigate('/apps')}>
        ← Все приложения
      </button>
      <div className="dp-page-header">
        <h1>{app.name}</h1>
      </div>

      {revealToken && (
        <div className="dp-callout dp-callout-warn">
          <b>Токен показывается только один раз — сохраните его сейчас.</b>
          <div className="dp-token-row">
            <code>{revealToken}</code>
            <button className="dp-btn dp-btn-small" onClick={() => copy(revealToken, 'token')}>
              {copied === 'token' ? 'Скопировано ✓' : 'Скопировать'}
            </button>
          </div>
        </div>
      )}

      <section className="dp-card">
        <h2>Основное</h2>
        <label className="dp-field">
          <span>Название</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="dp-field">
          <span>Описание</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
        <label className="dp-field">
          <span>URL иконки</span>
          <input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} />
        </label>
        <button className="dp-btn dp-btn-primary" disabled={saveBusy} onClick={saveDetails}>
          {saveBusy ? 'Сохраняем…' : 'Сохранить'}
        </button>
      </section>

      <section className="dp-card">
        <h2>Токен бота</h2>
        <p className="dp-muted">
          Префикс: <code>{bot.token_prefix ?? '—'}</code> · создан {timeAgo(bot.token_created_at)} · последнее использование{' '}
          {timeAgo(bot.token_last_used_at)}
        </p>
        <button className="dp-btn dp-btn-danger" disabled={resetBusy} onClick={resetToken}>
          {resetBusy ? 'Сбрасываем…' : 'Сбросить токен'}
        </button>
      </section>

      <section className="dp-card">
        <h2>Песочница (playground)</h2>
        <p className="dp-muted">
          При создании приложения мы один раз создали постоянный тестовый сервер «{app.name} Sandbox» и уже
          установили туда бота. Он не пересоздаётся и не сбрасывается — просто откройте{' '}
          <a href={MAIN_APP_URL} target="_blank" rel="noreferrer">
            основное приложение Parlon
          </a>{' '}
          под тем же аккаунтом и найдите этот сервер в списке слева.
        </p>
      </section>

      <section className="dp-card">
        <h2>Ссылка для добавления бота на сервер</h2>
        <p className="dp-muted">Как в Discord: вы даёте эту ссылку администратору сервера, он открывает её и подтверждает доступ.</p>
        <div className="dp-perm-list">
          {BOT_PERMISSIONS.map((p) => (
            <label key={p} className="dp-checkbox">
              <input
                type="checkbox"
                checked={perms.includes(p)}
                onChange={(e) =>
                  setPerms((prev) => (e.target.checked ? [...prev, p] : prev.filter((x) => x !== p)))
                }
              />
              {PERMISSION_LABELS[p].ru}
            </label>
          ))}
        </div>
        <label className="dp-field">
          <span>Redirect URL после подтверждения (необязательно)</span>
          <input value={redirectUri} onChange={(e) => setRedirectUri(e.target.value)} placeholder="https://ваш-сайт.com/callback" />
        </label>
        <div className="dp-token-row">
          <code className="dp-invite-url">{inviteUrl}</code>
          <button className="dp-btn dp-btn-small" onClick={() => copy(inviteUrl, 'invite')}>
            {copied === 'invite' ? 'Скопировано ✓' : 'Скопировать'}
          </button>
        </div>
      </section>

      <section className="dp-card">
        <h2>PyPI-библиотека — быстрый старт</h2>
        <pre className="dp-code">{pySnippet}</pre>
      </section>

      <section className="dp-card dp-card-danger">
        <h2>Опасная зона</h2>
        <button className="dp-btn dp-btn-danger" onClick={deleteApp}>
          Удалить приложение
        </button>
      </section>
    </div>
  )
}
