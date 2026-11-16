import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { PortalLayout, PublicLayout } from './layouts/Layouts'
import { CollegeGuard, RequireAuth } from './core/auth'
import { MODULES } from './core/modules'
import Home from './pages/Home'
import Login from './pages/Login'
import Portal from './pages/Portal'
import Chatbot from './pages/Chatbot'
import ModulePlaceholder from './modules/ModulePlaceholder'
import SearchPage from './modules/search/SearchPage'
import ChangePassword from './pages/ChangePassword'
import Accounts from './modules/org/Accounts'
import LabHome from './modules/labs/LabHome'
import EquipmentFlow from './modules/labs/EquipmentFlow'
import EquipmentView from './modules/labs/EquipmentView'
import LabsOverview from './modules/labs/LabsOverview'
import LabDetail from './modules/labs/LabDetail'
import { ExploreCollege, ExploreColleges, ExploreDepartment, ExploreEquipment, ExploreLab } from './modules/labs/Explore'
import AdminColleges from './modules/org/AdminColleges'
import { EventPublic, EventsHome } from './modules/events/EventsPublic'
import EventsManage from './modules/events/EventsManage'
import EventWorkspace from './modules/events/EventWorkspace'

function ScrollToHash() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) setTimeout(() => document.querySelector(hash)?.scrollIntoView({ behavior: 'smooth' }), 50)
    else window.scrollTo(0, 0)
  }, [pathname, hash])
  return null
}

// Modules with a real implementation; everything else shows its planned scope.
const IMPLEMENTED = { admin: <AdminColleges />, search: <SearchPage /> }

export default function App() {
  return (
    <>
      <ScrollToHash />
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/explore" element={<ExploreColleges />} />
          <Route path="/explore/c/:code" element={<ExploreCollege />} />
          <Route path="/explore/c/:code/d/:dept" element={<ExploreDepartment />} />
          <Route path="/explore/lab/:id" element={<ExploreLab />} />
          <Route path="/explore/equipment/:id" element={<ExploreEquipment />} />
          <Route path="/events" element={<EventsHome />} />
          <Route path="/events/:id" element={<EventPublic />} />
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
            <Route path="lab/equipment/:id/fill" element={<RequireAuth roles={['lab_incharge']}><EquipmentFlow /></RequireAuth>} />
            <Route path="lab-details" element={<RequireAuth roles={['hod', 'principal', 'admin']}><LabsOverview /></RequireAuth>} />
            <Route path="lab-details/:labId" element={<RequireAuth roles={['hod', 'principal', 'admin', 'lab_incharge']}><LabDetail /></RequireAuth>} />
            <Route path="equipment/:id" element={<EquipmentView />} />
            <Route path="events" element={<RequireAuth roles={['hod', 'principal', 'admin']}><EventsManage /></RequireAuth>} />
            <Route path="event/:id" element={<EventWorkspace />} />
            <Route path="principal" element={<RequireAuth roles={['admin']}><Accounts kind="principal" /></RequireAuth>} />
          </Route>
          {MODULES.filter((m) => m.key !== 'events').map((m) => {
            const page = IMPLEMENTED[m.key] ?? <ModulePlaceholder module={m} />
            return <Route key={m.key} path={m.path} element={m.needsLogin ? <RequireAuth roles={m.roles}>{page}</RequireAuth> : page} />
          })}
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
