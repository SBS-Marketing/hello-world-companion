import { useState, useCallback, useRef, useEffect } from 'react'
import { useWebSocket } from './hooks/useWebSocket'
import type { LogEntry } from './hooks/useWebSocket'
import { ConversationCard } from './components/ConversationCard'
import { SettingsPage } from './components/SettingsPage'
import { BotOverviewPage } from './components/BotOverviewPage'
import { LiveFeedPage } from './components/LiveFeedPage'
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

const MAX_LOGS = 200
const COUNTDOWN_SECONDS = 10

type Page = 'overview' | 'chats' | 'feed' | 'settings'

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [stats,         setStats]         = useState<Stats>(DEFAULT_STATS)
  const [filter,        setFilter]        = useState<'pending' | 'all'>('pending')
  const [logs,          setLogs]          = useState<LogEntry[]>([])
  const [page,          setPage]          = useState<Page>('overview')
  const [errorCount,    setErrorCount]    = useState(0)

  const countdownRefs = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const [countdowns, setCountdowns] = useState<Record<string, number>>({})

  // ─── Countdown ─────────────────────────────────────────────────────────────
  const clearCountdown = useCallback((id: string) => {
    if (countdownRefs.current[id]) { clearInterval(countdownRefs.current[id]); delete countdownRefs.current[id] }
    setCountdowns(prev => { if (!(id in prev)) return prev; const n = { ...prev }; delete n[id]; return n })
  }, [])

  const startCountdown = useCallback((id: string) => {
    if (countdownRefs.current[id]) clearInterval(countdownRefs.current[id])
    setCountdowns(prev => ({ ...prev, [id]: COUNTDOWN_SECONDS }))
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const cur = prev[id]
        if (cur === undefined) { clearInterval(interval); return prev }
        if (cur <= 1) {
          clearInterval(interval); delete countdownRefs.current[id]
          fetch(`${API}/approve/${id}`, { method: 'POST' })
          const n = { ...prev }; delete n[id]; return n
        }
        return { ...prev, [id]: cur - 1 }
      })
    }, 1000)
    countdownRefs.current[id] = interval
  }, [])

  useEffect(() => () => { Object.values(countdownRefs.current).forEach(clearInterval) }, [])

  // ─── WebSocket Callbacks ────────────────────────────────────────────────────
  const handleNewConv = useCallback((conv: Conversation) => {
    setConversations(prev => {
      const exists = prev.find(c => c.id === conv.id)
      return exists ? prev.map(c => c.id === conv.id ? conv : c) : [conv, ...prev]
    })
  }, [])

  const handleTyped    = useCallback((id: string) => {
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'typed' as const } : c))
    startCountdown(id)
  }, [startCountdown])

  const handleApproved = useCallback((id: string) => {
    clearCountdown(id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'approved' as const } : c))
  }, [clearCountdown])

  const handleEdited   = useCallback((id: string, text: string) => {
    clearCountdown(id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'edited' as const, final_text: text } : c))
  }, [clearCountdown])

  const handleRejected = useCallback((id: string) => {
    clearCountdown(id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'rejected' as const } : c))
  }, [clearCountdown])

  const handleSent     = useCallback((id: string) => {
    clearCountdown(id)
    setConversations(prev => prev.map(c => c.id === id ? { ...c, status: 'sent' as const } : c))
  }, [clearCountdown])

  const handleStats     = useCallback((s: Stats) => setStats(s), [])
  const handleInitState = useCallback((convs: Conversation[], s: Stats) => {
    setConversations(convs); setStats(s)
  }, [])
  const handleAgentLog = useCallback((entry: LogEntry) => {
    setLogs(prev => [...prev.slice(-(MAX_LOGS - 1)), entry])
    if (entry.level === 'error') setErrorCount(n => n + 1)
  }, [])

  const { connected } = useWebSocket(
    handleNewConv, handleTyped, handleApproved, handleEdited,
    handleRejected, handleSent, handleStats, handleInitState, handleAgentLog,
  )

  // ─── API Calls ──────────────────────────────────────────────────────────────
  const approve  = async (id: string) => { clearCountdown(id); await fetch(`${API}/approve/${id}`, { method: 'POST' }) }
  const edit     = async (id: string, text: string) => {
    clearCountdown(id)
    await fetch(`${API}/edit/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) })
  }
  const reject   = async (id: string) => { clearCountdown(id); await fetch(`${API}/reject/${id}`, { method: 'POST' }) }
  const thumbsUp   = async (id: string) => { clearCountdown(id); await fetch(`${API}/approve/${id}`, { method: 'POST' }) }
  const thumbsDown = async (id: string) => { clearCountdown(id); await fetch(`${API}/reject/${id}`, { method: 'POST' }) }
  const handleStop = async (id: string) => { clearCountdown(id); await fetch(`${API}/reject/${id}`, { method: 'POST' }) }
  const cancelCountdownForEdit = (id: string) => clearCountdown(id)

  // ─── Derived ────────────────────────────────────────────────────────────────
  const filtered     = filter === 'pending'
    ? conversations.filter(c => c.status === 'pending' || c.status === 'typed')
    : conversations
  const pendingCount = conversations.filter(c => c.status === 'pending' || c.status === 'typed').length

  const handleFeedOpen = () => { setPage('feed'); setErrorCount(0) }

  // ─── Monthly helper ─────────────────────────────────────────────────────────
  const monthly = stats.monthly_messages != null && stats.monthly_target != null
    ? { cur: stats.monthly_messages, tgt: stats.monthly_target } : null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', background: 'var(--bg)',
      overflow: 'hidden',
    }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0,
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          💬 Agent
        </span>

        {/* Connection dot */}
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: connected ? 'var(--green)' : 'var(--red)',
          boxShadow: connected ? '0 0 6px var(--green)' : 'none',
          flexShrink: 0,
        }} className={connected ? 'dot-pulse' : ''} />

        <div style={{ flex: 1 }} />

        {/* Stats chips */}
        {monthly && (
          <MonthlyChip cur={monthly.cur} tgt={monthly.tgt} />
        )}
        <StatChip label="Heute" value={stats.today_messages} color="var(--text2)" />
        <StatChip label="Pending" value={stats.pending_count} color={stats.pending_count > 0 ? 'var(--yellow)' : 'var(--text2)'} />
      </header>

      {/* ── Page Content ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Overview */}
        <PageSlot visible={page === 'overview'}>
          <BotOverviewPage stats={stats} />
        </PageSlot>

        {/* Chats */}
        <PageSlot visible={page === 'chats'}>
          <div style={{ padding: '12px 12px 0' }}>
            {/* Filter toggle */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <FilterBtn active={filter === 'pending'} onClick={() => setFilter('pending')}>
                Ausstehend {pendingCount > 0 && <Badge>{pendingCount}</Badge>}
              </FilterBtn>
              <FilterBtn active={filter === 'all'} onClick={() => setFilter('all')}>
                Alle <Badge muted>{conversations.length}</Badge>
              </FilterBtn>
            </div>
          </div>

          <div style={{ overflowY: 'auto', height: 'calc(100% - 60px)', padding: '0 12px 80px' }}>
            {filtered.length === 0 ? (
              <EmptyState
                icon={filter === 'pending' ? '✅' : '💬'}
                title={filter === 'pending' ? 'Keine ausstehenden Chats' : 'Noch keine Chats'}
                sub={filter === 'pending' ? 'Agent scannt alle 5 Sekunden…' : 'Warte auf eingehende Nachrichten'}
              />
            ) : filtered.map(conv => (
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
        </PageSlot>

        {/* Live Feed */}
        <PageSlot visible={page === 'feed'}>
          <LiveFeedPage logs={logs} />
        </PageSlot>

        {/* Settings */}
        <PageSlot visible={page === 'settings'}>
          <SettingsPage />
        </PageSlot>
      </div>

      {/* ── Bottom Navigation ────────────────────────────────────────────────── */}
      <nav style={{
        flexShrink: 0,
        background: 'var(--bg2)',
        borderTop: '1px solid var(--border)',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <NavTab icon="🧭" label="Übersicht" active={page === 'overview'} onClick={() => setPage('overview')} />
        <NavTab
          icon="💬" label="Chats" active={page === 'chats'}
          onClick={() => setPage('chats')} badge={pendingCount || undefined}
        />
        <NavTab
          icon="📡" label="Live Feed" active={page === 'feed'}
          onClick={handleFeedOpen} badge={errorCount > 0 ? errorCount : undefined} badgeRed
        />
        <NavTab icon="⚙️" label="Einstellungen" active={page === 'settings'} onClick={() => setPage('settings')} />
      </nav>
    </div>
  )
}

// ─── PageSlot ──────────────────────────────────────────────────────────────────
function PageSlot({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div style={{
      position: 'absolute', inset: 0,
      overflowY: 'auto',
      display: visible ? 'block' : 'none',
    }}>
      {children}
    </div>
  )
}

// ─── NavTab ────────────────────────────────────────────────────────────────────
function NavTab({ icon, label, active, onClick, badge, badgeRed }: {
  icon: string; label: string; active: boolean
  onClick: () => void; badge?: number; badgeRed?: boolean
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, border: 'none', background: 'transparent',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '10px 4px 8px', cursor: 'pointer', position: 'relative',
        color: active ? 'var(--blue)' : 'var(--text3)',
        fontFamily: 'inherit', transition: 'color 0.15s',
        gap: 3,
      }}
    >
      {badge != null && badge > 0 && (
        <span style={{
          position: 'absolute', top: 6, right: '50%', transform: 'translateX(12px)',
          background: badgeRed ? 'var(--red)' : 'var(--yellow)',
          color: badgeRed ? '#fff' : '#0a0c14',
          borderRadius: 999, fontSize: 9, fontWeight: 800,
          padding: '1px 5px', minWidth: 16, textAlign: 'center',
          lineHeight: '14px',
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, letterSpacing: '0.02em' }}>{label}</span>
      {active && (
        <span style={{
          position: 'absolute', bottom: 0, left: '20%', right: '20%',
          height: 2, background: 'var(--blue)', borderRadius: 999,
        }} />
      )}
    </button>
  )
}

// ─── FilterBtn ────────────────────────────────────────────────────────────────
function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? '#1e2d47' : 'var(--bg3)',
        color: active ? '#93c5fd' : 'var(--text2)',
        border: `1px solid ${active ? '#1e3a5f' : 'var(--border)'}`,
        borderRadius: 20, padding: '6px 14px',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: 'inherit', transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}

// ─── Badge ────────────────────────────────────────────────────────────────────
function Badge({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <span style={{
      background: muted ? 'var(--bg3)' : 'var(--yellow)',
      color: muted ? 'var(--text3)' : '#0a0c14',
      borderRadius: 999, padding: '0 6px',
      fontSize: 11, fontWeight: 800,
    }}>
      {children}
    </span>
  )
}

// ─── StatChip ─────────────────────────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
      lineHeight: 1,
    }}>
      <span style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color }}>{value.toLocaleString('de-DE')}</span>
    </div>
  )
}

// ─── MonthlyChip ──────────────────────────────────────────────────────────────
function MonthlyChip({ cur, tgt }: { cur: number; tgt: number }) {
  const pct      = Math.min(100, Math.round((cur / tgt) * 100))
  const expected = Math.round((tgt / 30) * new Date().getDate())
  const onTrack  = cur >= expected * 0.9
  const done     = cur >= tgt
  const color    = done ? 'var(--green)' : onTrack ? 'var(--blue)' : 'var(--yellow)'

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 3,
      padding: '4px 10px',
      background: 'var(--bg3)', border: '1px solid var(--border)',
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <span style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monat</span>
        <span style={{ fontSize: 11, fontWeight: 800, color }}>
          {done ? '🎉' : onTrack ? '✓' : '⚠'} {cur.toLocaleString('de-DE')}/{tgt.toLocaleString('de-DE')}
        </span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 999, height: 3 }}>
        <div style={{ background: color, borderRadius: 999, height: 3, width: `${pct}%`, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '80px 20px', color: 'var(--text3)',
    }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 13, color: 'var(--text3)' }}>{sub}</div>
    </div>
  )
}
