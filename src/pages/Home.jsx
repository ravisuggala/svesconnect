import { Link } from 'react-router-dom'
import { ArrowRight, Bot, Building2, FlaskConical, GraduationCap, Layers, Network, QrCode, Search, ShieldCheck, Sparkles, Users } from 'lucide-react'
import { Badge, Button, Card } from '../ui'
import { MODULES } from '../core/modules'
import './home.css'

const pillars = [
  { icon: Layers, t: 'One institutional platform', d: 'Infrastructure, services, competencies, projects and products of every SVES institution, discoverable in a single place.' },
  { icon: Bot, t: 'AI-ready by design', d: 'Semantic search, natural-language questions and equipment recommendations built on a retrieval-augmented assistant.' },
  { icon: GraduationCap, t: 'Built with our students', d: 'Student teams from four colleges build the portal under faculty guidance, gaining real, institution-wide project experience.' },
  { icon: Network, t: 'Open and scalable', d: 'Open-source technologies (React, Node.js, MySQL) that the Society can own, extend and host on its own infrastructure.' },
]
const steps = [
  { n: '01', t: 'Register', d: 'Faculty and lab in-charges record equipment, labs and facilities using guided, department-specific forms.' },
  { n: '02', t: 'Verify & approve', d: 'HODs verify and Principals approve, so every entry is accurate, traceable and audit-ready.' },
  { n: '03', t: 'Discover', d: 'Anyone can search by name, category, location or status, or simply ask the AI assistant.' },
  { n: '04', t: 'Collaborate', d: 'Enquiries, consultancy and shared use of facilities connect industry, faculty and students.' },
]
const institutions = ['Shri Vishnu Engineering College for Women (SVECW)', 'BVRIT Narsapur (BVRITN)', 'Vishnu Institute of Technology (VIT)', 'BVRIT Hyderabad College of Engineering for Women (BVRITH)']
const audience = [
  { icon: Users, t: 'Students', d: 'Find labs and equipment for projects, and showcase work and events.' },
  { icon: Building2, t: 'Faculty & HODs', d: 'Manage lab assets, research and consultancy with less paperwork.' },
  { icon: ShieldCheck, t: 'Management', d: 'Real-time dashboards and reports for planning, audits and accreditation.' },
  { icon: Sparkles, t: 'Industry', d: 'Discover SVES capabilities and send enquiries for testing, design and consultancy.' },
]

export default function Home() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="fade-up">
            <Badge tone="primary">Sri Vishnu Educational Society</Badge>
            <h1>SVES <span className="grad">Connect</span></h1>
            <p className="lead">One connected portal to showcase, manage and discover the infrastructure, equipment, competencies and projects across every SVES institution.</p>
            <div className="row">
              <Button as={Link} to="/explore" variant="accent" size="lg"><FlaskConical size={18} /> Explore labs & equipment</Button>
              <Button as={Link} to="/login" variant="light" size="lg">Sign in to the portal <ArrowRight size={18} /></Button>
            </div>
          </div>
          <div className="hero-art fade-up" aria-hidden="true"><img src="/logo.jpg" alt="Vishnu Universal Learning logo" /></div>
        </div>
      </section>

      <section className="container section">
        <h2>What is SVES Connect?</h2>
        <p className="muted wide">SVES Connect is a strategic initiative of the Society: a centralized, web-based platform that brings the labs, equipment, services, research and student projects of all our colleges into one searchable, governed catalogue. It replaces scattered spreadsheets and documents with accurate, traceable records, and opens the Society&apos;s capabilities to collaboration with industry and the wider community.</p>
        <div className="grid cols-4" style={{ marginTop: 'var(--s-5)' }}>
          {pillars.map((p) => <Card hover key={p.t}><p.icon className="ico" size={26} /><h3>{p.t}</h3><p className="muted">{p.d}</p></Card>)}
        </div>
      </section>

      <section id="modules" className="container section">
        <h2>Modules</h2>
        <p className="muted wide">Each part of the portal is a separate module with its own area, so teams can build, test and release them independently.</p>
        <div className="grid cols-3" style={{ marginTop: 'var(--s-5)' }}>
          {MODULES.filter((m) => m.key !== 'admin').map((m) => (
            <Card hover key={m.key}>
              <m.icon className="ico" size={26} />
              <h3>{m.label}</h3>
              <p className="muted">{m.summary}</p>
              <Link to={m.path} className="row">Explore <ArrowRight size={14} /></Link>
            </Card>
          ))}
          <Card hover><Search className="ico" size={26} /><h3>AI Assistant</h3><p className="muted">Ask questions about equipment and facilities in plain language. Try it now.</p><Link to="/assistant" className="row">Open assistant <ArrowRight size={14} /></Link></Card>
        </div>
      </section>

      <section className="band">
        <div className="container section">
          <h2>How it works</h2>
          <div className="grid cols-4" style={{ marginTop: 'var(--s-5)' }}>
            {steps.map((s) => <div key={s.n} className="step"><span className="num">{s.n}</span><h3>{s.t}</h3><p>{s.d}</p></div>)}
          </div>
        </div>
      </section>

      <section className="container section">
        <h2>Built for everyone at SVES</h2>
        <div className="grid cols-4" style={{ marginTop: 'var(--s-5)' }}>
          {audience.map((a) => <Card key={a.t}><a.icon className="ico" size={26} /><h3>{a.t}</h3><p className="muted">{a.d}</p></Card>)}
        </div>
      </section>

      <section className="container section">
        <div className="grid cols-2">
          <Card>
            <h3>Designed for trust</h3>
            <ul className="ticks">
              <li>Role-based access for Admin, HOD, Lab In-charge, Principal, Faculty and Students</li>
              <li>Validation, approvals and audit trails on every record</li>
              <li>QR codes for fast physical asset identification <QrCode size={14} /></li>
              <li>Supports accreditation evidence and faster reporting</li>
            </ul>
          </Card>
          <Card>
            <h3>Participating institutions</h3>
            <ul className="ticks">{institutions.map((i) => <li key={i}>{i}</li>)}</ul>
            <p className="muted" style={{ marginTop: 'var(--s-3)' }}>Project lead: Dr. Ravi Kumar Suggala, Dept. of IT, SVECW, with faculty coordinators from each college.</p>
          </Card>
        </div>
      </section>

      <section className="container section">
        <div className="cta">
          <div><h2 style={{ color: '#fff' }}>Explore SVES capabilities</h2><p>Search equipment, ask the assistant, or sign in to contribute records for your department.</p></div>
          <Button as={Link} to="/assistant" variant="light" size="lg">Get started <ArrowRight size={18} /></Button>
        </div>
      </section>
    </>
  )
}
