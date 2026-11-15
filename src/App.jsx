import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import Documents from './pages/Documents'
import Chatbot from './pages/Chatbot'

export default function App() {
  return (
    <>
      <nav className="sves-nav">
        <span className="brand">SVES CONNECT</span>
        <NavLink to="/documents">Document Portal</NavLink>
        <NavLink to="/chatbot">AI Chatbot</NavLink>
      </nav>
      <Routes>
        <Route path="/" element={<Navigate to="/documents" replace />} />
        <Route path="/documents" element={<Documents />} />
        <Route path="/chatbot" element={<Chatbot />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
