import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PortalLayout, PublicLayout } from './layouts/Layouts'
import { CollegeGuard, RequireAuth } from './core/auth'
import { MODULES } from './core/modules'
import Home from './pages/Home'
import Login from './pages/Login'
import Portal from './pages/Portal'
import Chatbot from './pages/Chatbot'
import Documents from './pages/Documents'
import ModulePlaceholder from './modules/ModulePlaceholder'
import ChangePassword from './pages/ChangePassword'
import Accounts from './modules/org/Accounts'
import LabHome from './modules/org/LabHome'
import AdminColleges from './modules/org/AdminColleges'

function ScrollToHash() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 50)
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

// Modules with a real implementation; everything else shows its planned scope.
const IMPLEMENTED = { admin: <AdminColleges />, events: <Documents />, search: <ModulePlaceholder module={MODULES.find((m) => m.key === 'search')} /> }

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
          <Route path="/change-password" element={<RequireAuth allowDefaultPassword><ChangePassword /></RequireAuth>} />
          {/* Each college has its own route space: /c/<code>/... Same screens, scoped to that college by the API. */}
          <Route path="/c/:college" element={<CollegeGuard />}>
            <Route path="hods" element={<RequireAuth roles={['principal']}><Accounts kind="hod" /></RequireAuth>} />
            <Route path="labs" element={<RequireAuth roles={['hod']}><Accounts kind="lab_incharge" /></RequireAuth>} />
            <Route path="lab" element={<RequireAuth roles={['lab_incharge']}><LabHome /></RequireAuth>} />
            <Route path="principal" element={<RequireAuth roles={['admin']}><Accounts kind="principal" /></RequireAuth>} />
          </Route>
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
