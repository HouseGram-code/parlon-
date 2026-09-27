import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabaseClient'
import { BotApplication } from '../types'

export function Apps({ session, navigate }: { session: Session; navigate: (to: string) => void }) {
  const [apps, setApps] = useState<BotApplication[] | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('bot_applications')
      .select('*')
      .eq('owner_id', session.user.id)
      .order('created_at', { ascending: false })
    if (!error) setApps((data ?? []) as BotApplication[])
  }

  useEffect(() => {
    load()
  }, [])

  async function createApp() {
    setError(null)
    if (name.trim().length < 2) {
      setError('Название должно быть не короче 2 символов')
      return
    }
    setBusy(true)
    try {
      const { data, error } = await supabase.rpc('create_bot_application', {
        p_name: name.trim(),
        p_description: description.trim(),
        p_icon_url: iconUrl.trim() || null,
      })
      if (error) {
        setError(error.message)
        return
      }
      const appId = data.application.id as string
      // stash the one-time plaintext token so the detail page can reveal it once
      sessionStorage.setItem(`parlon_reveal_${appId}`, JSON.stringify({ token: data.token, token_prefix: data.token_prefix }))
      navigate(`/apps/${appId}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dp-page">
      <div className="dp-page-header">
        <h1>Мои приложения (боты)</h1>
        <button className="dp-btn dp-btn-primary" onClick={() => setShowCreate(true)}>
          + Новое приложение
        </button>
      </div>
      <p className="dp-muted">
        Здесь вы создаёте бота и получаете токен — как в Discord Developer Portal. Каждому приложению
        автоматически создаётся персональный тестовый сервер («песочница»), который никогда не сбрасывается.
      </p>

      {apps === null && <p className="dp-muted">Загрузка…</p>}
      {apps && apps.length === 0 && <p className="dp-muted">Пока нет ни одного приложения.</p>}

      <div className="dp-app-grid">
        {apps?.map((a) => (
          <button key={a.id} className="dp-app-card" onClick={() => navigate(`/apps/${a.id}`)}>
            <div className="dp-app-icon" style={{ backgroundImage: a.icon_url ? `url(${a.icon_url})` : undefined }}>
              {!a.icon_url && a.name.slice(0, 1).toUpperCase()}
            </div>
            <div className="dp-app-name">{a.name}</div>
            <div className="dp-app-desc">{a.description || 'Без описания'}</div>
          </button>
        ))}
      </div>

      {showCreate && (
        <div className="dp-modal-backdrop" onClick={() => setShowCreate(false)}>
          <div className="dp-modal" onClick={(e) => e.stopPropagation()}>
            <h2>Новое приложение</h2>
            <label className="dp-field">
              <span>Название</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Мой первый бот" autoFocus />
            </label>
            <label className="dp-field">
              <span>Описание (необязательно)</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <label className="dp-field">
              <span>URL иконки (необязательно)</span>
              <input value={iconUrl} onChange={(e) => setIconUrl(e.target.value)} placeholder="https://…/icon.png" />
            </label>
            {error && <div className="dp-error">{error}</div>}
            <div className="dp-modal-actions">
              <button className="dp-btn" onClick={() => setShowCreate(false)}>
                Отмена
              </button>
              <button className="dp-btn dp-btn-primary" disabled={busy} onClick={createApp}>
                {busy ? 'Создаём…' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
