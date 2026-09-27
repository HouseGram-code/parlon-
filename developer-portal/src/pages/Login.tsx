import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { DiscordIcon } from '../DiscordIcon'

const DISCORD_COMMUNITY_URL = 'https://discord.gg/mZVYwDfCWh'

export function Login({ onNavigateHome, onNavigateDocs }: { onNavigateHome: () => void; onNavigateDocs: () => void }) {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit() {
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { username: username || email.split('@')[0] } },
        })
        if (signUpError) setError(signUpError.message)
        else if (!data.session) setNotice('Проверьте почту и подтвердите адрес, затем войдите.')
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) setError(signInError.message)
      }
    } catch {
      setError('Что-то пошло не так, попробуйте ещё раз.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="dp-auth">
      <div className="dp-auth-card">
        <img className="dp-auth-logo" src="/brand/icon.png" alt="Parlon Developers" onClick={onNavigateHome} />
        <h1>{mode === 'signin' ? 'Вход в Developer Portal' : 'Создать аккаунт'}</h1>
        <p className="dp-muted">
          Это тот же аккаунт, что и в основном мессенджере{' '}
          <a href={import.meta.env.VITE_MAIN_APP_URL || 'https://parlon-app.vercel.app'} target="_blank" rel="noreferrer">
            parlon-app
          </a>
          .
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          {mode === 'signup' && (
            <label className="dp-field">
              <span>Имя пользователя</span>
              <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="dev" />
            </label>
          )}
          <label className="dp-field">
            <span>Email</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="dp-field">
            <span>Пароль</span>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          {error && <div className="dp-error">{error}</div>}
          {notice && <div className="dp-notice">{notice}</div>}
          <button className="dp-btn dp-btn-primary" type="submit" disabled={busy}>
            {busy ? 'Подождите…' : mode === 'signin' ? 'Войти' : 'Создать аккаунт'}
          </button>
        </form>
        <button className="dp-link" onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}>
          {mode === 'signin' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
        </button>
        <div>
          <button className="dp-link" onClick={onNavigateDocs}>
            Читать документацию без входа →
          </button>
        </div>
        <a className="dp-discord-link dp-discord-link-standalone" href={DISCORD_COMMUNITY_URL} target="_blank" rel="noreferrer">
          <DiscordIcon size={16} /> Наше сообщество в Discord
        </a>
      </div>
    </div>
  )
}
