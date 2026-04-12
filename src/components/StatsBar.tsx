import type { Stats } from '../types'

interface Props {
  stats: Stats
  connected: boolean
}

export function StatsBar({ stats, connected }: Props) {
  const modelLabel = stats.model?.startsWith('local:')
    ? `🤖 Lokal (${stats.model.replace('local:', '')})`
    : '⚡ Grok'

  return (
    <div style={{
      background: '#1a1d27',
      borderBottom: '1px solid #2d3748',
      padding: '8px clamp(10px, 2vw, 24px)',
      display: 'flex',
      alignItems: 'center',
      gap: 'clamp(12px, 2vw, 28px)',
      flexWrap: 'wrap',
      rowGap: '8px',
    }}>
      {/* Logo */}
      <div style={{ fontWeight: 700, fontSize: 16, color: '#e2e8f0', marginRight: 8 }}>
        💬 Moderator
      </div>

      {/* Verbindungsstatus */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{
          width: 8, height: 8, borderRadius: '50%',
          background: connected ? '#22c55e' : '#ef4444',
          boxShadow: connected ? '0 0 6px #22c55e' : 'none',
        }} />
        <span style={{ fontSize: 13, color: '#94a3b8' }}>
          {connected ? 'Verbunden' : 'Getrennt…'}
        </span>
      </div>

      <Divider />

      <Stat label="Heute Nachrichten" value={stats.today_messages} />
      <Stat label="Trainingsbeispiele heute" value={stats.today_examples} />
      <Stat label="Gesamt Trainingsdaten" value={stats.total_examples} color="#a78bfa" />

      <Divider />

      <Stat
        label="Ausstehend"
        value={stats.pending_count}
        color={stats.pending_count > 0 ? '#fbbf24' : '#94a3b8'}
      />

      {stats.avg_ai_score != null && (
        <>
          <Divider />
          <ScoreStat label="Ø KI-Score heute" score={stats.avg_ai_score} />
        </>
      )}

      {stats.avg_response_time != null && (
        <>
          <Divider />
          <Stat label="Ø Zeit / Nachricht" value={stats.avg_response_time} suffix="s" color="#94a3b8" />
        </>
      )}

      {stats.monthly_target != null && stats.monthly_messages != null && (
        <>
          <Divider />
          <MonthlyCounter current={stats.monthly_messages} target={stats.monthly_target} />
        </>
      )}

      <div style={{ marginLeft: 'auto', fontSize: 12, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span>Modell:</span>
        <span style={{ color: '#94a3b8', fontWeight: 600 }}>{modelLabel}</span>
      </div>
    </div>
  )
}

function MonthlyCounter({ current, target }: { current: number; target: number }) {
  const pct = Math.min(100, Math.round((current / target) * 100))
  const expected = Math.round((target / 30) * new Date().getDate())
  const onTrack = current >= expected * 0.9
  const done = current >= target
  const color = done ? '#22c55e' : onTrack ? '#60a5fa' : '#f59e0b'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 120 }}>
      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Monatsziel</span>
      <span style={{ fontSize: 16, fontWeight: 700, color, lineHeight: 1 }}>
        {done ? '🎉' : onTrack ? '✓' : '⚠'} {current.toLocaleString('de-DE')}/{target.toLocaleString('de-DE')}
      </span>
      <div style={{ background: '#1f2937', borderRadius: 999, height: 4, width: 120 }}>
        <div style={{ background: color, borderRadius: 999, height: 4, width: `${pct}%`, transition: 'width 0.3s' }} />
      </div>
    </div>
  )
}

function ScoreStat({ label, score }: { label: string; score: number }) {
  const color = score <= 20 ? '#22c55e' : score <= 40 ? '#fbbf24' : '#ef4444'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>
        {score}%
      </span>
    </div>
  )
}

function Stat({ label, value, color = '#e2e8f0', suffix = '' }: { label: string; value: number; color?: string; suffix?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 11, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </span>
      <span style={{ fontSize: 18, fontWeight: 700, color, lineHeight: 1 }}>
        {value.toLocaleString('de-DE')}{suffix}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ width: 1, height: 32, background: '#2d3748' }} />
}
