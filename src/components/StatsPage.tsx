import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts'
import { BOTS, getBotUrl } from '../config/bots'

interface MonthData {
  month: string
  sa: number
  fpc: number
  chb: number
}

interface AgentStatus {
  sa: 'running' | 'stopped'
  fpc: 'running' | 'stopped'
  chb: 'running' | 'stopped'
}

const BOT_COLORS: Record<string, string> = {
  sa:  '#f472b6',
  fpc: '#a78bfa',
  chb: '#60a5fa',
}

function formatMonth(m: string) {
  const [y, mo] = m.split('-')
  const names = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
  return `${names[parseInt(mo) - 1]} ${y.slice(2)}`
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: '#0d1220', border: '1px solid #1e2d3d',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.dataKey} style={{ color: p.color, display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{p.name}</span>
          <span style={{ fontWeight: 700 }}>{p.value.toLocaleString('de-DE')}</span>
        </div>
      ))}
    </div>
  )
}

export function StatsPage({ botUrls }: { botUrls: Record<string, string> }) {
  const [months, setMonths] = useState<MonthData[]>([])
  const [agentStatus, setAgentStatus] = useState<AgentStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [currentPeriod, setCurrentPeriod] = useState<Record<string, number>>({})

  const chbUrl = botUrls['chb'] || 'https://chb.sbs-marketing.de'

  useEffect(() => {
    const fetchAll = () => Promise.all([
      fetch(`${chbUrl}/stats/monthly`).then(r => r.json()).catch(() => ({ months: [] })),
      fetch(`${chbUrl}/agent/status`).then(r => r.json()).catch(() => null),
      // Fetch current-period monthly_messages per bot (reset-date filtered)
      ...BOTS.map(b => {
        const url = botUrls[b.id] || `https://${b.id}.sbs-marketing.de`
        return fetch(`${url}/stats`).then(r => r.json()).then(d => ({ id: b.id, val: d.monthly_messages ?? 0 })).catch(() => ({ id: b.id, val: 0 }))
      }),
    ]).then(([monthly, status, ...botStats]) => {
      setMonths((monthly as any).months || [])
      setAgentStatus(status)
      const period: Record<string, number> = {}
      ;(botStats as { id: string; val: number }[]).forEach(b => { period[b.id] = b.val })
      setCurrentPeriod(period)
      setLoading(false)
    })

    fetchAll()
    const iv = setInterval(() => {
      fetch(`${chbUrl}/agent/status`).then(r => r.json()).then(setAgentStatus).catch(() => {})
    }, 5000)
    return () => clearInterval(iv)
  }, [chbUrl])

  const handleAgent = async (botId: string, action: 'start' | 'stop') => {
    const url = botUrls[botId] || `https://${botId}.sbs-marketing.de`
    setActionLoading(prev => ({ ...prev, [botId]: true }))
    try {
      await fetch(`${url}/agent/${action}/${botId}`, { method: 'POST' })
      // Refresh status
      const status = await fetch(`${chbUrl}/agent/status`).then(r => r.json()).catch(() => null)
      if (status) setAgentStatus(status)
    } finally {
      setActionLoading(prev => ({ ...prev, [botId]: false }))
    }
  }

  // All-time totals (for charts reference)
  const allTimeTotals = months.reduce(
    (acc, m) => ({ sa: acc.sa + m.sa, fpc: acc.fpc + m.fpc, chb: acc.chb + m.chb }),
    { sa: 0, fpc: 0, chb: 0 }
  )

  return (
    <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>

      {/* ── Bot Controls ─────────────────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
          Bot-Steuerung
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {BOTS.map(bot => {
            const status = agentStatus?.[bot.id as keyof AgentStatus] ?? 'stopped'
            const running = status === 'running'
            const busy = actionLoading[bot.id]
            return (
              <div key={bot.id} style={{
                background: 'var(--bg2)', border: `1px solid ${running ? bot.color + '44' : 'var(--border)'}`,
                borderRadius: 12, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: running ? bot.color : 'var(--text3)',
                  boxShadow: running ? `0 0 6px ${bot.color}` : 'none',
                }} />
                <span style={{ fontSize: 16 }}>{bot.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{bot.label}</div>
                  <div style={{ fontSize: 11, color: running ? bot.color : 'var(--text3)' }}>
                    {running ? 'Aktiv' : 'Gestoppt'}
                  </div>
                </div>
                <button
                  onClick={() => handleAgent(bot.id, running ? 'stop' : 'start')}
                  disabled={busy}
                  style={{
                    background: running ? '#1f2d1f' : bot.color + '22',
                    color: running ? '#ef4444' : bot.color,
                    border: `1px solid ${running ? '#ef444444' : bot.color + '55'}`,
                    borderRadius: 8, padding: '6px 14px',
                    fontSize: 12, fontWeight: 700,
                    cursor: busy ? 'wait' : 'pointer', fontFamily: 'inherit',
                    opacity: busy ? 0.5 : 1,
                  }}
                >
                  {busy ? '…' : running ? '⏹ Stop' : '▶ Start'}
                </button>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Aktueller Zeitraum ───────────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
          Dieser Monat
        </h2>
        <div style={{ display: 'flex', gap: 10 }}>
          {BOTS.map(bot => {
            const cur = currentPeriod[bot.id] ?? 0
            const pct = Math.min(100, Math.round((cur / 1500) * 100))
            return (
              <div key={bot.id} style={{
                flex: 1, background: 'var(--bg2)', border: `1px solid ${bot.color}33`,
                borderRadius: 10, padding: '10px 12px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 10, color: bot.color, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{bot.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>
                  {cur.toLocaleString('de-DE')}
                </div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>/ 1.500</div>
                <div style={{ background: 'var(--border)', borderRadius: 999, height: 3, marginTop: 6 }}>
                  <div style={{ background: bot.color, borderRadius: 999, height: 3, width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── All-time ─────────────────────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
          Gesamt (alle Zeit)
        </h2>
        <div style={{ display: 'flex', gap: 10 }}>
          {BOTS.map(bot => (
            <div key={bot.id} style={{
              flex: 1, background: 'var(--bg2)', border: `1px solid ${bot.color}22`,
              borderRadius: 10, padding: '10px 12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 10, color: bot.color, fontWeight: 700, textTransform: 'uppercase' }}>{bot.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text3)', marginTop: 2 }}>
                {allTimeTotals[bot.id as keyof typeof allTimeTotals].toLocaleString('de-DE')}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Bar Chart ────────────────────────────────────────────────────────── */}
      <section>
        <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
          Nachrichten pro Monat
        </h2>
        <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '14px 8px 8px', border: '1px solid var(--border)' }}>
          {loading ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 24 }}>Lade…</div>
          ) : months.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 13, padding: 24 }}>Noch keine Daten</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={months.map(m => ({ ...m, month: formatMonth(m.month) }))} barCategoryGap="30%">
                <XAxis dataKey="month" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Bar dataKey="sa"  name="SA"  fill={BOT_COLORS.sa}  radius={[3,3,0,0]} />
                <Bar dataKey="fpc" name="FPC" fill={BOT_COLORS.fpc} radius={[3,3,0,0]} />
                <Bar dataKey="chb" name="CHB" fill={BOT_COLORS.chb} radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* ── Line Chart (Verlauf) ─────────────────────────────────────────────── */}
      {months.length > 1 && (
        <section>
          <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
            Verlauf
          </h2>
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: '14px 8px 8px', border: '1px solid var(--border)' }}>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={months.map(m => ({ ...m, month: formatMonth(m.month) }))}>
                <XAxis dataKey="month" tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#4b5563', fontSize: 10 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <Line type="monotone" dataKey="sa"  name="SA"  stroke={BOT_COLORS.sa}  strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="fpc" name="FPC" stroke={BOT_COLORS.fpc} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="chb" name="CHB" stroke={BOT_COLORS.chb} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      <div style={{ height: 8 }} />
    </div>
  )
}
