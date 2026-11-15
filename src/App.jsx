import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PortalLayout, PublicLayout } from './layouts/Layouts'
import { RequireAuth } from './core/auth'
import { MODULES } from './core/modules'
import Home from './pages/Home'
import Login from './pages/Login'
import Portal from './pages/Portal'
import Chatbot from './pages/Chatbot'
import Documents from './pages/Documents'
import ModulePlaceholder from './modules/ModulePlaceholder'

function ScrollToHash() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 50)
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

// Modules with a real implementation; everything else shows its planned scope.
const IMPLEMENTED = { events: <Documents />, search: <ModulePlaceholder module={MODULES.find((m) => m.key === 'search')} /> }

export default function App() {
  return (
    <>
      <ScrollToHash />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
        </Route>
        <Route element={<PortalLayout />}>
          <Route path="/portal" element={<RequireAuth><Portal /></RequireAuth>} />
          <Route path="/assistant" element={<Chatbot />} />
          {MODULES.map((m) => {
            const page = IMPLEMENTED[m.key] ?? <ModulePlaceholder module={m} />
            return <Route key={m.key} path={m.path} element={m.needsLogin ? <RequireAuth roles={m.roles}>{page}</RequireAuth> : page} />
          })}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
