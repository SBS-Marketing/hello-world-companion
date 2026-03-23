import { useState, useEffect } from 'react'

const API = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000'

interface Analytics {
  by_hour: Record<string, number>
  by_day: Record<string, number>
  response_times: { avg: number | null; min: number | null; max: number | null; count: number }
  statuses: Record<string, number>
  total: number
}

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null)

  useEffect(() => {
    const load = () => fetch(`${API}/analytics`).then(r => r.json()).then(setData).catch(() => {})
    load()
    const iv = setInterval(load, 10000)
    return () => clearInterval(iv)
  }, [])

  if (!data) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#4b5563', fontFamily: 'monospace' }}>
      Lade Statistiken…
    </div>
  )

  const hourValues = Array.from({ length: 24 }, (_, i) => data.by_hour[String(i)] ?? 0)
  const maxHour = Math.max(...hourValues, 1)

  const dayEntries = Object.entries(data.by_day)
  const maxDay = Math.max(...dayEntries.map(([, v]) => v), 1)

  const statusColors: Record<string, string> = {
    sent: '#22c55e', approved: '#3b82f6', typed: '#a78bfa',
    pending: '#fbbf24', rejected: '#ef4444', edited: '#06b6d4', error: '#f87171',
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16, fontFamily: 'inherit' }}>

      {/* Kennzahlen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <Kpi label="Gesamt" value={String(data.total)} />
        <Kpi label="Ø Antwortzeit" value={data.response_times.avg ? `${data.response_times.avg}s` : '—'} />
        <Kpi label="Schnellste" value={data.response_times.min ? `${data.response_times.min}s` : '—'} color="#22c55e" />
        <Kpi label="Langsamste" value={data.response_times.max ? `${data.response_times.max}s` : '—'} color="#f87171" />
      </div>

      {/* Status-Verteilung */}
      <Card title="📊 Status-Verteilung">
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {Object.entries(data.statuses).map(([s, n]) => (
            <div key={s} style={{
              background: '#0a0c14', border: `1px solid ${statusColors[s] ?? '#1a2335'}`,
              borderRadius: 8, padding: '6px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: statusColors[s] ?? '#6b7280' }}>{n}</span>
              <span style={{ fontSize: 10, color: '#4b5563', textTransform: 'capitalize' }}>{s}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Aktivität nach Uhrzeit */}
      <Card title="🕐 Aktivität nach Uhrzeit">
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
          {hourValues.map((v, h) => {
            const pct = v / maxHour
            const isNow = new Date().getHours() === h
            return (
              <div key={h} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div title={`${h}:00 – ${v} Nachrichten`} style={{
                  width: '100%', height: Math.max(4, pct * 68),
                  background: isNow ? '#3b82f6' : v > 0 ? '#1e3a5f' : '#0f1623',
                  borderRadius: 3, transition: 'height 0.3s',
                  border: isNow ? '1px solid #60a5fa' : 'none',
                }} />
                {h % 4 === 0 && (
                  <span style={{ fontSize: 8, color: '#374151' }}>{h}h</span>
                )}
              </div>
            )
          })}
        </div>
        <div style={{ fontSize: 10, color: '#4b5563', marginTop: 6, textAlign: 'right' }}>
          Blau = aktuelle Stunde
        </div>
      </Card>

      {/* Nachrichten letzte 14 Tage */}
      {dayEntries.length > 0 && (
        <Card title="📅 Nachrichten letzte 14 Tage">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80 }}>
            {dayEntries.map(([day, v]) => {
              const pct = v / maxDay
              const isToday = day === new Date().toISOString().slice(0, 10)
              return (
                <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div title={`${day}: ${v}`} style={{
                    width: '100%', height: Math.max(4, pct * 64),
                    background: isToday ? '#22c55e' : '#1e3a5f',
                    borderRadius: 3,
                    border: isToday ? '1px solid #4ade80' : 'none',
                  }} />
                  <span style={{ fontSize: 8, color: '#374151', writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}>
                    {day.slice(5)}
                  </span>
                </div>
              )
            })}
          </div>
          <div style={{ fontSize: 10, color: '#4b5563', marginTop: 4, textAlign: 'right' }}>
            Grün = heute
          </div>
        </Card>
      )}

      <div style={{ fontSize: 10, color: '#1f2937', textAlign: 'center' }}>
        Aktualisiert alle 10s • Daten seit letztem Backend-Start
      </div>
    </div>
  )
}

function Kpi({ label, value, color = '#93c5fd' }: { label: string; value: string; color?: string }) {
  return (
    <div style={{
      background: '#0f1623', border: '1px solid #1a2335',
      borderRadius: 10, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4,
    }}>
      <span style={{ fontSize: 10, color: '#4b5563' }}>{label}</span>
      <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: '#0f1623', border: '1px solid #1a2335',
      borderRadius: 12, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280' }}>{title}</div>
      {children}
    </div>
  )
}
