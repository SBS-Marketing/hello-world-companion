import { useEffect, useState } from 'react'

const API = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000'

type BotStatus = 'online' | 'offline' | 'idle'

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

export function BotOverviewPage() {
  const [data, setData] = useState<BotOverviewResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [resetting, setResetting] = useState<Record<string, boolean>>({})

  const handleReset = async (botId: string) => {
    setResetting(prev => ({ ...prev, [botId]: true }))
    try {
      await fetch(`${API}/agent-reset/${botId}`, { method: 'POST' })
    } finally {
      setTimeout(() => setResetting(prev => ({ ...prev, [botId]: false })), 2000)
    }
  }

  useEffect(() => {
    const load = () => {
      fetch(`${API}/bots/overview`)
        .then(r => r.json())
        .then(d => {
          setData(d)
          setLoading(false)
        })
        .catch(() => setLoading(false))
    }

    load()
    const iv = setInterval(load, 10000)
    return () => clearInterval(iv)
  }, [])

  if (loading && !data) {
    return <CenteredText>Lade Bot-Übersicht…</CenteredText>
  }

  if (!data) {
    return <CenteredText>Bot-Übersicht nicht erreichbar</CenteredText>
  }

  return (
    <div style={{ maxWidth: 1180, margin: '0 auto', padding: '22px 16px 40px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 12 }}>
        <Kpi label="Bots online" value={`${data.summary.online}/${data.summary.total}`} color="#22c55e" />
        <Kpi label="Fehler 10m" value={String(data.summary.errors_10m)} color={data.summary.errors_10m > 0 ? '#ef4444' : '#93c5fd'} />
        <Kpi label="Gesendet 10m" value={String(data.summary.sent_10m)} color="#a78bfa" />
        <Kpi label="Kunden 10m" value={String(data.summary.customers_10m)} color="#60a5fa" />
        <Kpi label="Aktive Cases" value={String(data.summary.active_conversations)} color="#f59e0b" />
        <Kpi label="Pending" value={String(data.summary.pending)} color="#fbbf24" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 14 }}>
        {data.bots.map(bot => (
          <div key={bot.id} style={{
            background: '#0f1623', border: '1px solid #1a2335', borderRadius: 16,
            padding: 16, boxShadow: '0 6px 24px #00000033', display: 'flex', flexDirection: 'column', gap: 14,
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
