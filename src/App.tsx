import { useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Archive from './pages/Archive'
import EntryForm from './pages/EntryForm'
import EntryDetail from './pages/EntryDetail'
import Settings from './pages/Settings'
import { getSettings } from './lib/settings'
import { requestPersistence } from './db/repo'

function StartupRedirect() {
  const navigate = useNavigate()
  const location = useLocation()
  useEffect(() => {
    requestPersistence()
    if (location.pathname !== '/') return
    getSettings().then((s) => {
      if (s.startOnNew) navigate('/new?camera=1')
    })
    // solo all'avvio
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    if (pathname !== '/') window.scrollTo(0, 0)
  }, [pathname])
  return null
}

export default function App() {
  return (
    <HashRouter>
      <StartupRedirect />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Archive />} />
        <Route path="/new" element={<EntryForm key="new" />} />
        <Route path="/e/:id" element={<EntryDetail />} />
        <Route path="/e/:id/edit" element={<EntryForm key="edit" />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Archive />} />
      </Routes>
    </HashRouter>
  )
}
