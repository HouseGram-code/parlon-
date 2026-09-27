import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabaseClient'
import { useRouter } from './router'
import { Login } from './pages/Login'
import { Apps } from './pages/Apps'
import { AppDetail } from './pages/AppDetail'
import { Authorize } from './pages/Authorize'
import { Docs } from './pages/Docs'
import { DiscordIcon } from './DiscordIcon'

const DISCORD_COMMUNITY_URL = 'https://discord.gg/mZVYwDfCWh'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const { path, params, navigate } = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  if (loading) return <div className="dp-loading">Загрузка…</div>

  // /docs is public — no need to sign in just to read the documentation.
  if (path === '/docs') {
    return (
      <div className="dp-shell">
        <header className="dp-topbar">
          <img
            src="/brand/icon.png"
            alt=""
            className="dp-topbar-logo"
            onClick={() => navigate(session ? '/apps' : '/')}
          />
          <span className="dp-topbar-title" onClick={() => navigate(session ? '/apps' : '/')}>
            Parlon Developers
          </span>
          <span className="dp-topbar-badge">api beta 0.1</span>
          <div className="dp-topbar-spacer" />
          <a className="dp-discord-link" href={DISCORD_COMMUNITY_URL} target="_blank" rel="noreferrer" title="Наше сообщество в Discord">
            <DiscordIcon />
          </a>
          {session ? (
            <button className="dp-link" onClick={() => navigate('/apps')}>
              Приложения
            </button>
          ) : (
            <button className="dp-link" onClick={() => navigate('/login')}>
              Войти
            </button>
          )}
        </header>
        <main>
          <Docs />
        </main>
      </div>
    )
  }

  if (!session) {
    // preserve the full destination (path + query, e.g. an /authorize invite link)
    // across the login detour so an "Add to server" link keeps working post-login
    if (path !== '/login' && path !== '/') {
      sessionStorage.setItem('parlon_login_next', path + window.location.search)
    }
    return <Login onNavigateHome={() => navigate('/')} onNavigateDocs={() => navigate('/docs')} />
  }

  if (path === '/' || path === '/login') {
    const next = sessionStorage.getItem('parlon_login_next')
    if (next) {
      sessionStorage.removeItem('parlon_login_next')
      navigate(next)
      return <div className="dp-loading">Загрузка…</div>
    }
    navigate('/apps')
    return <div className="dp-loading">Загрузка…</div>
  }

  return (
    <div className="dp-shell">
      <header className="dp-topbar">
        <img src="/brand/icon.png" alt="" className="dp-topbar-logo" onClick={() => navigate('/apps')} />
        <span className="dp-topbar-title" onClick={() => navigate('/apps')}>
          Parlon Developers
        </span>
        <span className="dp-topbar-badge">api beta 0.1</span>
        <div className="dp-topbar-spacer" />
        <a className="dp-discord-link" href={DISCORD_COMMUNITY_URL} target="_blank" rel="noreferrer" title="Наше сообщество в Discord">
          <DiscordIcon />
        </a>
        <button className="dp-link" onClick={() => navigate('/docs')}>
          Документация
        </button>
        <button className="dp-link" onClick={() => supabase.auth.signOut()}>
          Выйти
        </button>
      </header>
      <main>
        {path === '/apps' && <Apps session={session} navigate={navigate} />}
        {path.startsWith('/apps/') && <AppDetail session={session} appId={path.slice('/apps/'.length)} navigate={navigate} />}
        {path === '/authorize' && <Authorize session={session} params={params} navigate={navigate} />}
        {path !== '/apps' && !path.startsWith('/apps/') && path !== '/authorize' && (
          <div className="dp-page dp-muted">Страница не найдена. <button className="dp-link" onClick={() => navigate('/apps')}>К приложениям</button></div>
        )}
      </main>
    </div>
  )
}
