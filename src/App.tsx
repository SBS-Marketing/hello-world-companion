import { useState, useCallback, useRef, useEffect } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import type { LogEntry } from './hooks/useWebSocket'
import { StatsBar } from './components/StatsBar'
import { MilestoneProgress } from './components/MilestoneProgress'
import { ConversationCard } from './components/ConversationCard'
import { SettingsPage } from './components/SettingsPage'
import { AnalyticsPage } from './components/AnalyticsPage'
import { BotOverviewPage } from './components/BotOverviewPage'
import type { Conversation, Stats } from './types'

const API = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000'

const DEFAULT_STATS: Stats = {
  today_messages: 0,
  today_examples: 0,
  total_examples: 0,
  pending_count: 0,
  active_conversations: 0,
  next_milestone: { count: 500, current: 0, label: 'Erstes Fine-Tuning möglich!', progress: 0, remaining: 500 },
  model: 'grok',
}

const MAX_LOGS = 100
const COUNTDOWN_SECONDS = 10

// ─── Log-Level Farben ───────────────────────────────────────────────────────
const logColor = (level: string) => {
  if (level === 'error')   return '#f87171'
  if (level === 'warning') return '#fbbf24'
  return '#4ade80'
}

// ─── Log-Icons ──────────────────────────────────────────────────────────────
const logIcon = (msg: string) => {
  if (msg.includes('❌') || msg.includes('Fehler')) return '❌'
  if (msg.includes('✅') || msg.includes('korrekt')) return '✅'
  if (msg.includes('📝') || msg.includes('Textarea')) return '📝'
  if (msg.includes('💬') || msg.includes('Nachricht')) return '💬'
  if (msg.includes('🤖') || msg.includes('Grok'))     return '🤖'
  if (msg.includes('🔍') || msg.includes('Scan'))     return '🔍'
  if (msg.includes('⚡') || msg.includes('LLM'))      return '⚡'
  return '›'
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [stats,         setStats]         = useState<Stats>(DEFAULT_STATS)
  const [filter,        setFilter]        = useState<'pending' | 'all'>('pending')
  const [logs,          setLogs]          = useState<LogEntry[]>([])
  const [showLogs,      setShowLogs]      = useState(false)
  const [page,          setPage]          = useState<'overview' | 'chats' | 'analytics' | 'settings'>('overview')
  const logEndRef = useRef<HTMLDivElement>(null)

  // Countdown state: conv_id → remaining seconds
  const [countdowns, setCountdowns] = useState<Record<string, number>>({})
  const countdownRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})

  // ─── Countdown Helpers ────────────────────────────────────────────────────
  const clearCountdown = useCallback((id: string) => {
    if (countdownRefs.current[id]) {
      clearInterval(countdownRefs.current[id])
      delete countdownRefs.current[id]
    }
    setCountdowns(prev => {
      if (!(id in prev)) return prev
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  const startCountdown = useCallback((id: string) => {
    if (countdownRefs.current[id]) clearInterval(countdownRefs.current[id])
    setCountdowns(prev => ({ ...prev, [id]: COUNTDOWN_SECONDS }))
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const cur = prev[id]
        if (cur === undefined) { clearInterval(interval); return prev }
        if (cur <= 1) {
          clearInterval(interval)
          delete countdownRefs.current[id]
          fetch(`${API}/approve/${id}`, { method: 'POST' })
          const next = { ...prev }; delete next[id]; return next
        }
        return { ...prev, [id]: cur - 1 }
      })
    }, 1000)
    countdownRefs.current[id] = interval
  }, [])

  useEffect(() => () => { Object.values(countdownRefs.current).forEach(clearInterval) }, [])

  // ─── WebSocket Callbacks ──────────────────────────────────────────────────
  const handleNewConv = useCallback((conv: Conversation) => {
    setConversations(prev => {
      const exists = prev.find(c => c.id === conv.id)
      if (exists) return prev.map(c => c.id === conv.id ? conv : c)
      return [conv, ...prev]
    })
  }, [])

  const handleTyped     = useCallback((id: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'typed' as const } : c))
    startCountdown(id)
  }, [startCountdown])

  const handleApproved  = useCallback((id: string) => {
    clearCountdown(id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'approved' as const } : c))
  }, [clearCountdown])

  const handleEdited    = useCallback((id: string, text: string) => {
    clearCountdown(id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'edited' as const, final_text: text } : c))
  }, [clearCountdown])

  const handleRejected  = useCallback((id: string) => {
    clearCountdown(id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected' as const } : c))
  }, [clearCountdown])

  const handleSent      = useCallback((id: string) => {
    clearCountdown(id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'sent' as const } : c))
  }, [clearCountdown])

  const handleStats     = useCallback((s: Stats) => setStats(s), [])
  const handleInitState = useCallback((convs: Conversation[], s: Stats) => {
    setConversations(convs); setStats(s)
  }, [])
  const handleAgentLog  = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev.slice(-(MAX_LOGS - 1)), entry])
  }, [])

  useEffect(() => {
    if (showLogs) logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, showLogs])

  const { connected } = useWebSocket(
    handleNewConv, handleTyped, handleApproved, handleEdited,
    handleRejected, handleSent, handleStats, handleInitState, handleAgentLog,
  )

  // ─── API Calls ────────────────────────────────────────────────────────────
  const approve = async (id: string) => { clearCountdown(id); await fetch(`${API}/approve/${id}`, { method: 'POST' }) }
  const edit    = async (id: string, text: string) => {
    clearCountdown(id)
    await fetch(`${API}/edit/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
  }
  const reject  = async (id: string) => { clearCountdown(id); await fetch(`${API}/reject/${id}`, { method: 'POST' }) }
  const thumbsUp   = async (id: string) => { clearCountdown(id); await fetch(`${API}/approve/${id}`, { method: 'POST' }) }
  const handleStop = async (id: string) => { clearCountdown(id); await fetch(`${API}/reject/${id}`, { method: 'POST' }) }
  const thumbsDown = async (id: string) => { clearCountdown(id); await fetch(`${API}/reject/${id}`, { method: 'POST' }) }
  const cancelCountdownForEdit = (id: string) => clearCountdown(id)

  // ─── Filter ───────────────────────────────────────────────────────────────
  const filtered     = filter === 'pending'
    ? conversations.filter(c => c.status === 'pending' || c.status === 'typed')
    : conversations
  const pendingCount = conversations.filter(c => c.status === 'pending' || c.status === 'typed').length
  const lastLog      = logs[logs.length - 1]

  return (
    <div style={{ minHeight: '100vh', background: '#0a0c14', display: 'flex', flexDirection: 'column' }}>

      {/* ── Stats + Milestone ─────────────────────────────────────────── */}
      <StatsBar stats={stats} connected={connected} />
      <MilestoneProgress milestone={stats.next_milestone} />

      {/* ── Agent Live-Feed (kompakt, aufklappbar) ────────────────────── */}
      <div style={{ borderBottom: '1px solid #131820' }}>
        <button
          onClick={() => setShowLogs(v => !v)}
          style={{
            background: 'transparent', border: 'none',
            color: '#374151', padding: '5px 18px',
            fontSize: 11, cursor: 'pointer', width: '100%',
            textAlign: 'left', fontFamily: 'monospace',
            display: 'flex', alignItems: 'center', gap: 8,
          }}
        >
          <span style={{ color: '#1f2937' }}>{showLogs ? '▼' : '▶'}</span>
          <span>Agent Live-Feed</span>
          {logs.length > 0 && (
            <span style={{
              background: '#1f2937', color: '#4b5563',
              borderRadius: 999, padding: '0 6px', fontSize: 10,
            }}>
              {logs.length}
            </span>
          )}
          {/* Letzte Log-Zeile als Vorschau wenn eingeklappt */}
          {!showLogs && lastLog && (
            <span className="log-preview" style={{
              color: logColor(lastLog.level),
              fontSize: 10, fontFamily: 'monospace',
              marginLeft: 4,
            }}>
              {lastLog.ts} {lastLog.message}
            </span>
          )}
        </button>

        {showLogs && (
          <div style={{
            background: '#070910', fontFamily: 'monospace', fontSize: 11,
            maxHeight: 180, overflowY: 'auto', padding: '6px 18px 8px',
            borderTop: '1px solid #131820',
          }}>
            {logs.length === 0
              ? <span style={{ color: '#1f2937' }}>Warte auf Agent-Logs…</span>
              : logs.map((l, i) => (
                <div key={i} style={{
                  color: logColor(l.level),
                  lineHeight: 1.6, display: 'flex', gap: 6,
                }}>
                  <span style={{ color: '#2d3748', flexShrink: 0 }}>{l.ts}</span>
                  <span style={{ color: '#374151', flexShrink: 0 }}>{logIcon(l.message)}</span>
                  <span>{l.message}</span>
                </div>
              ))
            }
            <div ref={logEndRef} />
          </div>
        )}
      </div>

      {/* ── Navigation ─────────────────────────────────────────────────── */}
      <div style={{
        padding: '10px 18px',
        borderBottom: '1px solid #131820',
        display: 'flex', alignItems: 'center', gap: 8,
        background: '#0a0c14',
      }}>
        <Tab active={page === 'overview'} onClick={() => setPage('overview')}>
          🧭 Übersicht
        </Tab>
        <Tab active={page === 'chats' && filter === 'pending'} onClick={() => { setPage('chats'); setFilter('pending') }}>
          💬 Chats
          {pendingCount > 0 && (
            <span style={{
              background: '#fbbf24', color: '#0a0c14',
              borderRadius: 999, padding: '0 6px',
              fontSize: 10, fontWeight: 800, marginLeft: 6,
            }}>
              {pendingCount}
            </span>
          )}
        </Tab>
        <Tab active={page === 'chats' && filter === 'all'} onClick={() => { setPage('chats'); setFilter('all') }}>
          Alle
          <span style={{
            background: '#1f2937', color: '#6b7280',
            borderRadius: 999, padding: '0 6px',
            fontSize: 10, fontWeight: 600, marginLeft: 6,
          }}>
            {conversations.length}
          </span>
        </Tab>
        <div style={{ flex: 1 }} />
        <Tab active={page === 'analytics'} onClick={() => setPage('analytics')}>
          📊 Statistiken
        </Tab>
        <Tab active={page === 'settings'} onClick={() => setPage('settings')}>
          ⚙️ Einstellungen
        </Tab>
      </div>

      {/* ── Inhalt ─────────────────────────────────────────────────────── */}
      {page === 'overview' ? (
        <BotOverviewPage />
      ) : page === 'settings' ? (
        <SettingsPage />
      ) : page === 'analytics' ? (
        <AnalyticsPage />
      ) : (
        <div className="content-area">
          {filtered.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              padding: '80px 20px', color: '#2d3748',
            }}>
              <div style={{ fontSize: 44, marginBottom: 14 }}>
                {filter === 'pending' ? '✅' : '💬'}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#374151' }}>
                {filter === 'pending' ? 'Keine ausstehenden Chats' : 'Noch keine Chats'}
              </div>
              <div style={{ fontSize: 12, color: '#1f2937', marginTop: 6 }}>
                {filter === 'pending'
                  ? 'Agent scannt alle 5 Sekunden…'
                  : 'Warte auf eingehende Nachrichten'}
              </div>
            </div>
          ) : (
            <div className="cards-grid">
              {filtered.map(conv => (
                <ConversationCard
                  key={conv.id}
                  conv={conv}
                  countdown={countdowns[conv.id]}
                  onApprove={approve}
                  onEdit={edit}
                  onReject={reject}
                  onThumbsUp={thumbsUp}
                  onThumbsDown={thumbsDown}
                  onStop={handleStop}
                  onCancelCountdown={cancelCountdownForEdit}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Tab Button ────────────────────────────────────────────────────────────
function Tab({ children, active, onClick }: { children: React.ReactNode; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#1e2d47' : 'transparent',
        color: active ? '#93c5fd' : '#4b5563',
        border: `1px solid ${active ? '#1e3a5f' : '#1a2030'}`,
        borderRadius: 8, padding: '5px 14px',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center',
        fontFamily: 'inherit', transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}
