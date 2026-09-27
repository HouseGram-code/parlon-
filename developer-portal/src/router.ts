import { useEffect, useState } from 'react'

/** Tiny history-API router — no extra dependency, this portal only has 4 routes. */
export function useRouter() {
  const [path, setPath] = useState(window.location.pathname)
  const [search, setSearch] = useState(window.location.search)

  useEffect(() => {
    function onPop() {
      setPath(window.location.pathname)
      setSearch(window.location.search)
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  function navigate(to: string) {
    const url = new URL(to, window.location.origin)
    window.history.pushState({}, '', url.pathname + url.search)
    setPath(url.pathname)
    setSearch(url.search)
  }

  return { path, search, params: new URLSearchParams(search), navigate }
}
