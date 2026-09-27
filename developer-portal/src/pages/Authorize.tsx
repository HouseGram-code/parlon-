import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { BOT_PERMISSIONS, BotApplication, BotPermission, BotRow, PERMISSION_LABELS, ServerRow } from '../types'

export function Authorize({ session, params, navigate }: { session: Session; params: URLSearchParams; navigate: (to: string) => void }) {
  const clientId = params.get('client_id') ?? ''
  const redirectUri = params.get('redirect_uri') ?? ''
  const state = params.get('state') ?? ''
  const requestedPerms = (params.get('permissions') ?? 'read_messages,send_messages')
    .split(',')
    .map((p) => p.trim())
    .filter((p): p is BotPermission => (BOT_PERMISSIONS as readonly string[]).includes(p))

  const [app, setApp] = useState<BotApplication | null>(null)
  const [bot, setBot] = useState<BotRow | null>(null)
  const [servers, setServers] = useState<ServerRow[]>([])
  const [serverId, setServerId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ serverName: string } | null>(null)

  useEffect(() => {
    if (!clientId) {
      setError('Отсутствует client_id в ссылке.')
      return
    }
    async function load() {
      const [{ data: appRow }, { data: botRow }, { data: serverRows, error: serverErr }] = await Promise.all([
        supabase.from('bot_applications').select('*').eq('id', clientId).maybeSingle(),
        supabase.from('bots').select('*').eq('application_id', clientId).maybeSingle(),
        supabase.rpc('list_installable_servers'),
      ])
      if (!appRow || !botRow) {
        setError('Бот не найден.')
        return
      }
      setApp(appRow as BotApplication)
      setBot(botRow as BotRow)
      if (!serverErr) setServers((serverRows ?? []) as ServerRow[])
    }
    load()
  }, [clientId])

  async function authorize() {
    if (!bot || !serverId) return
    setBusy(true)
    setError(null)
    try {
      const { error } = await supabase
        .from('bot_installations')
        .upsert(
          { bot_id: bot.id, server_id: serverId, installed_by: session.user.id, permissions: requestedPerms },
          { onConflict: 'bot_id,server_id' }
        )
      if (error) {
        setError(error.message)
        return
      }
      const server = servers.find((s) => s.id === serverId)
      if (redirectUri) {
        const url = new URL(redirectUri)
        url.searchParams.set('installed', '1')
        url.searchParams.set('server_id', serverId)
        if (state) url.searchParams.set('state', state)
        window.location.href = url.toString()
        return
      }
      setDone({ serverName: server?.name ?? 'сервер' })
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <div className="dp-page dp-authorize">
        <div className="dp-card">
          <p className="dp-error">{error}</p>
          <button className="dp-btn" onClick={() => navigate('/apps')}>
            На главную
          </button>
        </div>
      </div>
    )
  }
  if (!app || !bot) return <div className="dp-page dp-muted">Загрузка…</div>

  if (done) {
    return (
      <div className="dp-page dp-authorize">
        <div className="dp-card dp-callout-success">
          <h2>Готово ✅</h2>
          <p>
            «{app.name}» добавлен на сервер «{done.serverName}».
          </p>
          <button className="dp-btn dp-btn-primary" onClick={() => navigate('/apps')}>
            Мои приложения
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="dp-page dp-authorize">
      <div className="dp-card">
        <div className="dp-authorize-header">
          <div className="dp-app-icon" style={{ backgroundImage: app.icon_url ? `url(${app.icon_url})` : undefined }}>
            {!app.icon_url && app.name.slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h2>{app.name}</h2>
            <p className="dp-muted">{app.description || 'хочет получить доступ к вашему серверу'}</p>
          </div>
        </div>

        <h3>Запрошенные права:</h3>
        <ul className="dp-perm-summary">
          {requestedPerms.map((p) => (
            <li key={p}>{PERMISSION_LABELS[p].ru}</li>
          ))}
          {requestedPerms.length === 0 && <li>без особых прав</li>}
        </ul>

        <label className="dp-field">
          <span>Выберите сервер</span>
          <select value={serverId} onChange={(e) => setServerId(e.target.value)}>
            <option value="">— выбрать —</option>
            {servers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        {servers.length === 0 && (
          <p className="dp-muted">
            У вас нет серверов, на которых вы можете управлять ботами (нужны права владельца или «manage_server»).
          </p>
        )}

        <div className="dp-modal-actions">
          <button className="dp-btn" onClick={() => navigate('/apps')}>
            Отмена
          </button>
          <button className="dp-btn dp-btn-primary" disabled={!serverId || busy} onClick={authorize}>
            {busy ? 'Подождите…' : 'Разрешить'}
          </button>
        </div>
      </div>
    </div>
  )
}
