import { useEffect, useState, useCallback, useRef } from 'react'
import type { Stats } from '../types'

// ─── Startup-Feedback-Popup ───────────────────────────────────────────────────
const STARTUP_STEPS = [
  { key: 'start',    icon: '▶',  label: 'Bot gestartet'    },
  { key: 'browser',  icon: '🌐', label: 'Browser öffnet'   },
  { key: 'login',    icon: '🔐', label: 'Einloggen'        },
  { key: 'active',   icon: '✅', label: 'Aktiv'            },
]

function detectStep(logs: string[]): number {
  const last20 = logs.slice(-20).join(' ').toLowerCase()
  if (last20.includes('scan_new_messages') || last20.includes('aktiv') || last20.includes('gestartet')) return 3
  if (last20.includes('login') || last20.includes('anmeld') || last20.includes('passwort')) return 2
  if (last20.includes('browser') || last20.includes('playwright') || last20.includes('chromium')) return 1
  return 0
}

function StartupPopup({ botId, meta, logs, onClose }: {
  botId: string
  meta: { color: string; icon: string; label: string }
  logs: string[]
  onClose: () => void
}) {
  const step = detectStep(logs)
  const recentLogs = logs.slice(-5)

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 16, zIndex: 1000,
      background: '#0d1220', border: `1px solid ${meta.color}55`,
      borderRadius: 16, padding: '14px 16px', width: 300,
      boxShadow: '0 8px 32px #00000066',
      animation: 'slideUp 0.2s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: meta.color }}>
          {meta.icon} {meta.label} startet…
        </span>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: 'var(--text3)',
          cursor: 'pointer', fontSize: 16, padding: '0 4px', lineHeight: 1,
        }}>×</button>
      </div>

      {/* Steps */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {STARTUP_STEPS.map((s, i) => {
          const done = i < step
          const active = i === step
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: done ? meta.color + '33' : active ? meta.color + '22' : 'var(--bg3)',
                border: `1px solid ${done ? meta.color : active ? meta.color + '88' : 'var(--border)'}`,
                fontSize: 11,
              }}>
                {done ? '✓' : active ? (
                  <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', fontSize: 10 }}>⟳</span>
                ) : s.icon}
              </div>
              <span style={{
                fontSize: 12,
                color: done ? meta.color : active ? 'var(--text)' : 'var(--text3)',
                fontWeight: active ? 700 : 400,
              }}>{s.label}</span>
            </div>
          )
        })}
      </div>

      {/* Live logs */}
      {recentLogs.length > 0 && (
        <div style={{
          background: 'var(--bg)', borderRadius: 8, padding: '8px 10px',
          fontFamily: 'monospace', fontSize: 10, color: 'var(--text3)',
          maxHeight: 80, overflowY: 'auto',
        }}>
          {recentLogs.map((l, i) => (
            <div key={i} style={{ color: l.toLowerCase().includes('error') || l.toLowerCase().includes('fehler') ? '#ef4444' : 'var(--text3)' }}>
              {l.replace(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2},\d{3} \[.*?\] [\w.]+: /, '')}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const DEFAULT_API = 'https://chb.sbs-marketing.de'

type BotStatus = 'online' | 'offline' | 'idle'
type AgentRunState = 'running' | 'stopped'

interface BotOverview {
  id: string
  name: string
  status: BotStatus
  last_activity: string | null
  last_error: { at: string | null; detail: string; message: string } | null
  errors_10m: number
  sent_10m: number
  customer_10m: number
  avg_score_10m: number | null
  last_lines: string[]
}

interface BotOverviewResponse {
  bots: BotOverview[]
  summary: {
    online: number
    total: number
    errors_10m: number
    sent_10m: number
    customers_10m: number
    active_conversations: number
    pending: number
  }
  timestamp: string
}

const statusColor: Record<BotStatus, string> = {
  online: '#22c55e',
  idle: '#f59e0b',
  offline: '#ef4444',
}

const statusLabel: Record<BotStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  offline: 'Offline',
}

const BOT_META: Record<string, { color: string; icon: string; label: string }> = {
  sa:  { color: '#f472b6', icon: '💋', label: 'SexyAffair' },
  fpc: { color: '#a78bfa', icon: '🎯', label: 'FPC' },
  chb: { color: '#60a5fa', icon: '🏠', label: 'ChatHomeBase' },
}

interface BotMonthly { bot: { id: string; label: string; color: string }; cur: number; tgt: number }

interface Props {
  stats?: Stats
  botMonthly?: BotMonthly[]
  apiUrl?: string
  botUrls?: Record<string, string>
  botLogs?: Record<string, { message: string; level: string; ts: string }[]>
}

export function BotOverviewPage({ stats, botMonthly, apiUrl, botUrls = {}, botLogs = {} }: Props) {
  const API = apiUrl || DEFAULT_API
  const [data, setData] = useState<BotOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState<Record<string, boolean>>({})
  const [agentStatus, setAgentStatus] = useState<Record<string, AgentRunState>>({})
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [notausStep, setNotausStep] = useState<0 | 1>(0)
  const [startingBot, setStartingBot] = useState<string | null>(null)
  const [notausConfirmed, setNotausConfirmed] = useState(false)

  const getBotUrl = (botId: string) =>
    botUrls[botId] || `https://${botId}.sbs-marketing.de`

  const refreshAgentStatus = useCallback(async () => {
    try {
      const r = await fetch(`${API}/agent/status`)
      const d = await r.json()
      setAgentStatus(d)
    } catch {}
  }, [API])

  const handleReset = async (botId: string) => {
    setResetting(prev => ({ ...prev, [botId]: true }))
    try {
      await fetch(`${API}/agent-reset/${botId}`, { method: 'POST' })
    } finally {
      setTimeout(() => setResetting(prev => ({ ...prev, [botId]: false })), 2000)
    }
  }

  const handleAgent = async (botId: string, action: 'start' | 'stop') => {
    const url = getBotUrl(botId)
    setActionLoading(prev => ({ ...prev, [botId]: true }))
    if (action === 'start') {
      setStartingBot(botId)
    } else {
      setStartingBot(null)
    }
    try {
      await fetch(`${url}/agent/${action}/${botId}`, { method: 'POST' })
      await refreshAgentStatus()
    } finally {
      setActionLoading(prev => ({ ...prev, [botId]: false }))
    }
  }

  const handleNotaus = async () => {
    if (notausStep === 0) {
      setNotausStep(1)
      // Auto-reset after 4s if not confirmed
      setTimeout(() => setNotausStep(0), 4000)
      return
    }
    // Step 2: stop all agents on all backends
    setNotausStep(0)
    await Promise.all(['sa', 'fpc', 'chb'].map(id => {
      const url = getBotUrl(id)
      return fetch(`${url}/agent/stop/${id}`, { method: 'POST' }).catch(() => {})
    }))
    await refreshAgentStatus()
    setNotausConfirmed(true)
    setTimeout(() => setNotausConfirmed(false), 4000)
  }

  useEffect(() => {
    const load = () => {
      fetch(`${API}/bots/overview`)
        .then(r => r.json())
        .then(d => { setData(d); setLoading(false) })
        .catch(() => setLoading(false))
    }
    load()
    refreshAgentStatus()
    const iv = setInterval(() => { load(); refreshAgentStatus() }, 10000)
    return () => clearInterval(iv)
  }, [refreshAgentStatus])

  const anyRunning = Object.values(agentStatus).some(s => s === 'running')

  if (loading && !data) {
    return <CenteredText>Lade Bot-Übersicht…</CenteredText>
  }
  if (!data) {
    return <CenteredText>Bot-Übersicht nicht erreichbar</CenteredText>
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '16px 16px 80px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Notaus + Quick controls ──────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'stretch' }}>

        {/* Per-bot start/stop row */}
        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
          {['sa', 'fpc', 'chb'].map(botId => {
            const meta = BOT_META[botId]
            const running = agentStatus[botId] === 'running'
            const busy = actionLoading[botId]
            return (
              <button
                key={botId}
                onClick={() => handleAgent(botId, running ? 'stop' : 'start')}
                disabled={busy}
                style={{
                  flex: 1,
                  background: running ? meta.color + '18' : 'var(--bg2)',
                  border: `1px solid ${running ? meta.color + '55' : 'var(--border)'}`,
                  borderRadius: 12, padding: '10px 8px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
                  opacity: busy ? 0.5 : 1, transition: 'all 0.15s',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: running ? meta.color : 'var(--text3)',
                    boxShadow: running ? `0 0 5px ${meta.color}` : 'none',
                  }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: running ? meta.color : 'var(--text3)' }}>
                    {meta.icon} {meta.label}
                  </span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: running ? '#ef4444' : meta.color,
                }}>
                  {busy ? '…' : running ? '⏹ Stop' : '▶ Start'}
                </span>
              </button>
            )
          })}
        </div>

        {/* Notaus */}
        <button
          onClick={handleNotaus}
          style={{
            minWidth: 80,
            background: notausStep === 1 ? '#7f1d1d' : '#1f1215',
            border: `2px solid ${notausStep === 1 ? '#ef4444' : '#ef444466'}`,
            borderRadius: 12, padding: '10px 14px',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}
        >
          <span style={{ fontSize: 20 }}>🛑</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: notausStep === 1 ? '#ef4444' : '#fca5a5' }}>
            {notausStep === 1 ? 'Sicher?' : 'Notaus'}
          </span>
        </button>
      </div>

      {/* ── Monthly Progress ─────────────────────────────────────────────────── */}
      {botMonthly && botMonthly.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${botMonthly.length}, 1fr)`, gap: 12 }}>
          {botMonthly.map(m => <MonthlyCard key={m.bot.id} bot={m.bot} cur={m.cur} tgt={m.tgt} />)}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12 }}>
        <Kpi label="Bots online" value={`${data.summary.online}/${data.summary.total}`} color="#22c55e" />
        <Kpi label="Fehler 10m" value={String(data.summary.errors_10m)} color={data.summary.errors_10m > 0 ? '#ef4444' : '#93c5fd'} />
        <Kpi label="Gesendet 10m" value={String(data.summary.sent_10m)} color="#a78bfa" />
        <Kpi label="Kunden 10m" value={String(data.summary.customers_10m)} color="#60a5fa" />
        <Kpi label="Aktive Cases" value={String(data.summary.active_conversations)} color="#f59e0b" />
        <Kpi label="Pending" value={String(data.summary.pending)} color="#fbbf24" />
      </div>

      {/* ── Notaus Bestätigung ───────────────────────────────────────────────── */}
      {notausConfirmed && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: '#1a0a0a', border: '1px solid #ef4444',
          borderRadius: 14, padding: '14px 24px', zIndex: 1000,
          display: 'flex', alignItems: 'center', gap: 10,
          boxShadow: '0 8px 32px #ef444433',
          animation: 'slideUp 0.2s ease-out',
        }}>
          <span style={{ fontSize: 20 }}>🛑</span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#ef4444' }}>Notaus aktiviert</div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Alle Agents werden gestoppt & Browser geschlossen</div>
          </div>
        </div>
      )}

      {/* ── Startup Popup ────────────────────────────────────────────────────── */}
      {startingBot && BOT_META[startingBot] && (
        <StartupPopup
          botId={startingBot}
          meta={BOT_META[startingBot]}
          logs={(botLogs[startingBot] || []).map(l => l.message)}
          onClose={() => setStartingBot(null)}
        />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        {data.bots.map(bot => (
          <div key={bot.id} style={{
            background: '#0f1623', border: '1px solid #1a2335', borderRadius: 16,
            padding: 16, boxShadow: '0 6px 24px #00000033', display: 'flex', flexDirection: 'column', gap: 14,
            opacity: bot.status === 'offline' ? 0.38 : 1,
            filter: bot.status === 'offline' ? 'grayscale(0.6)' : 'none',
            transition: 'opacity 0.3s',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#e5eefb' }}>{bot.name}</div>
                <div style={{ fontSize: 11, color: '#4b5563', marginTop: 4 }}>ID: {bot.id}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  padding: '6px 10px', borderRadius: 999, border: `1px solid ${statusColor[bot.status]}55`,
                  background: `${statusColor[bot.status]}18`, color: statusColor[bot.status], fontWeight: 700, fontSize: 12,
                }}>
                  {statusLabel[bot.status]}
                </div>
                <button
                  onClick={() => handleReset(bot.id)}
                  disabled={resetting[bot.id]}
                  title="Agent-State zurücksetzen"
                  style={{
                    background: resetting[bot.id] ? '#1f2937' : '#172032',
                    border: '1px solid #1e3a5f', borderRadius: 8,
                    color: resetting[bot.id] ? '#6b7280' : '#60a5fa',
                    fontSize: 14, cursor: resetting[bot.id] ? 'not-allowed' : 'pointer',
                    padding: '6px 10px', fontWeight: 700,
                  }}
                >
                  {resetting[bot.id] ? '…' : '🔄'}
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <MiniStat label="Letzte Aktivität" value={formatTime(bot.last_activity)} />
              <MiniStat label="Ø KI-Score 10m" value={bot.avg_score_10m == null ? 'n/a' : `${bot.avg_score_10m}%`} color={bot.avg_score_10m == null ? '#94a3b8' : bot.avg_score_10m <= 20 ? '#22c55e' : bot.avg_score_10m <= 40 ? '#f59e0b' : '#ef4444'} />
              <MiniStat label="Gesendet 10m" value={String(bot.sent_10m)} color="#a78bfa" />
              <MiniStat label="Kunden 10m" value={String(bot.customer_10m)} color="#60a5fa" />
            </div>

            <div style={{
              background: bot.last_error ? '#2a1214' : '#0b1320',
              border: `1px solid ${bot.last_error ? '#7f1d1d' : '#1f2937'}`,
              borderRadius: 12, padding: '12px 14px',
            }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6 }}>Letzter Fehler</div>
              {bot.last_error ? (
                <>
                  <div style={{ color: '#fca5a5', fontWeight: 700, fontSize: 13 }}>{bot.last_error.detail}</div>
                  <div style={{ color: '#cbd5e1', fontSize: 12, marginTop: 4 }}>{bot.last_error.message}</div>
                  <div style={{ color: '#64748b', fontSize: 10, marginTop: 6 }}>{formatDateTime(bot.last_error.at)}</div>
                </>
              ) : (
                <div style={{ color: '#94a3b8', fontSize: 12 }}>Keine Fehler erkannt</div>
              )}
            </div>

            <div style={{
              background: '#0a0f18', border: '1px solid #141c2a', borderRadius: 12,
              padding: '10px 12px', fontFamily: 'monospace', fontSize: 11,
            }}>
              <div style={{ color: '#6b7280', marginBottom: 8 }}>Letzte Logzeilen</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {bot.last_lines.length === 0 ? (
                  <div style={{ color: '#475569' }}>Keine Logdaten</div>
                ) : bot.last_lines.map((line, idx) => (
                  <div key={idx} style={{ color: '#cbd5e1', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{line}</div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Kpi({ label, value, color = '#e5eefb' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#0f1623', border: '1px solid #1a2335', borderRadius: 14, padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
    </div>
  )
}

function MiniStat({ label, value, color = '#e5eefb' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: '#0b1320', border: '1px solid #182234', borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: '#64748b', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color }}>{value}</div>
    </div>
  )
}

function CenteredText({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#64748b' }}>{children}</div>
}

function formatTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatDateTime(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('de-DE')
}

function MonthlyCard({ cur, tgt, bot }: { cur: number; tgt: number; bot?: { label: string; color: string } }) {
  const today      = new Date().getDate()
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const remaining  = daysInMonth - today
  const pct        = Math.min(100, Math.round((cur / tgt) * 100))
  const expected   = Math.round((tgt / daysInMonth) * today)
  const dailyNeeded = remaining > 0 ? Math.ceil((tgt - cur) / remaining) : 0
  const onTrack    = cur >= expected * 0.9
  const done       = cur >= tgt
  const accentColor = bot?.color ?? '#3b82f6'
  const color      = done ? '#22c55e' : onTrack ? accentColor : '#f59e0b'
  const deficit    = expected - cur

  return (
    <div style={{
      background: '#0f1623', border: `1px solid ${color}33`,
      borderRadius: 16, padding: '16px 20px',
      display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {bot && (
        <div style={{ fontSize: 12, fontWeight: 700, color: bot.color, letterSpacing: '0.04em' }}>
          {bot.label}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
            Monatsziel {new Date().toLocaleString('de-DE', { month: 'long' })}
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 900, color, lineHeight: 1 }}>
              {cur.toLocaleString('de-DE')}
            </span>
            <span style={{ fontSize: 14, color: '#475569' }}>/ {tgt.toLocaleString('de-DE')} Nachrichten</span>
            <span style={{ fontSize: 18, marginLeft: 4 }}>{done ? '🎉' : onTrack ? '✓' : '⚠️'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          <StatMini label="Täglich nötig" value={dailyNeeded.toLocaleString('de-DE')} color={dailyNeeded > 200 ? '#f59e0b' : '#60a5fa'} />
          <StatMini label="Noch heute" value={onTrack ? 'Im Plan' : `−${deficit.toLocaleString('de-DE')}`} color={onTrack ? '#22c55e' : '#f59e0b'} />
          <StatMini label="Tage übrig" value={String(remaining)} color="#94a3b8" />
        </div>
      </div>

      <div style={{ position: 'relative', background: '#1a2030', borderRadius: 999, height: 8 }}>
        <div style={{
          position: 'absolute', left: `${Math.min(100, Math.round((expected / tgt) * 100))}%`,
          top: -4, bottom: -4, width: 2, background: '#334155', borderRadius: 1,
          transform: 'translateX(-50%)',
        }} />
        <div style={{
          background: color, borderRadius: 999, height: 8,
          width: `${pct}%`, transition: 'width 0.4s',
          boxShadow: `0 0 8px ${color}66`,
        }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#374151' }}>
        <span>{pct}% erreicht</span>
        <span style={{ color: '#475569' }}>
          Soll heute: {expected.toLocaleString('de-DE')} · Erwartet: {Math.round(tgt / daysInMonth).toLocaleString('de-DE')}/Tag
        </span>
      </div>
    </div>
  )
}

function StatMini({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
      <span style={{ fontSize: 10, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
      <span style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>{value}</span>
    </div>
  )
}
