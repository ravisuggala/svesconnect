import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bot, RefreshCw, Send } from 'lucide-react'
import { Button, Card } from '../ui'
import { api } from '../core/api'
import { useAuth } from '../core/auth'
import './chatbot.css'

const GREETING = { sender: 'bot', text: 'Hello 👋 I’m the SVES AI assistant. I help you find details about equipment, laboratories, facilities and infrastructure resources. Ask me anything!' }
const KEY = 'sves_chat_messages'

export default function Chatbot() {
  const { user } = useAuth()
  const internal = user && ['principal', 'hod', 'lab_incharge', 'admin'].includes(user.role)
  const [pubChoice, setPub] = useState(null) // null = follow the default for this user (the user loads after the first render)
  const pub = pubChoice ?? !internal
  const [messages, setMessages] = useState(() => {
    try { const s = localStorage.getItem(KEY); return s ? JSON.parse(s) : [GREETING] } catch { return [GREETING] }
  })
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { try { localStorage.setItem(KEY, JSON.stringify(messages)) } catch { /* storage unavailable */ } }, [messages])

  const clearChat = () => { try { localStorage.removeItem(KEY) } catch { /* ignore */ } setMessages([GREETING]) }

  const sendMessage = async () => {
    const q = input.trim()
    if (!q || loading) return
    setMessages((p) => [...p, { sender: 'user', text: q }])
    setInput(''); setLoading(true)
    try {
      const res = await api('/chatbot/chat', { method: 'POST', body: { question: q, scope: pub ? 'public' : 'mine' } })
      setMessages((p) => [...p, { sender: 'bot', text: res.answer, sources: res.sources, scope: res.scope?.label }])
    } catch {
      setMessages((p) => [...p, { sender: 'bot', text: 'Server error. Try again later.' }])
    }
    setLoading(false)
  }

  return (
    <div className="chat-wrap fade-up">
      <Card className="chat">
        <div className="chat-head"><Bot size={22} /><div><b>SVES AI Assistant</b><small>{pub ? 'Answers from published labs and equipment' : 'Answers from your college / department records'}</small></div>
          {internal && <span className="spacer" />}
          {internal && <div className="row" style={{ gap: 6 }}><button className={`chip ${!pub ? 'on' : ''}`} onClick={() => setPub(false)}>Mine</button><button className={`chip ${pub ? 'on' : ''}`} onClick={() => setPub(true)}>All published</button></div>}</div>
        <div className="chat-body" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`bubble ${m.sender}`}>{m.text}
              {m.sources?.length > 0 && <div className="sources">{m.sources.map((s) => <Link key={`${s.kind}-${s.id}`} to={s.url} className="src">{s.title}</Link>)}</div>}
            </div>))}
          {loading && <div className="bubble bot typing"><span /><span /><span /></div>}
          <div ref={bottomRef} />
        </div>
        <div className="chat-foot">
          <input className="input" placeholder="Type your question…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} aria-label="Your question" />
          <Button onClick={sendMessage} disabled={loading}><Send size={16} /> Send</Button>
          <Button variant="ghost" onClick={clearChat} aria-label="Clear chat"><RefreshCw size={16} /></Button>
        </div>
      </Card>
    </div>
  )
}
