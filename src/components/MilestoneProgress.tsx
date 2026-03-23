import type { Milestone } from '../types'

interface Props {
  milestone: Milestone
}

export function MilestoneProgress({ milestone }: Props) {
  const pct = Math.min(milestone.progress * 100, 100)
  const isComplete = milestone.progress >= 1

  return (
    <div style={{
      background: '#1a1d27',
      borderBottom: '1px solid #2d3748',
      padding: '10px 20px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>
          {isComplete ? '🏆' : '🎯'} Nächster Meilenstein: <strong style={{ color: '#e2e8f0' }}>{milestone.label}</strong>
        </span>
        <span style={{ fontSize: 13, color: '#94a3b8' }}>
          <strong style={{ color: '#a78bfa' }}>{milestone.current.toLocaleString('de-DE')}</strong>
          {' / '}
          <strong style={{ color: '#e2e8f0' }}>{milestone.count.toLocaleString('de-DE')}</strong>
          {' Beispiele'}
          {!isComplete && (
            <span style={{ color: '#6b7280', marginLeft: 8 }}>
              ({milestone.remaining.toLocaleString('de-DE')} fehlen)
            </span>
          )}
        </span>
      </div>
      <div style={{
        height: 6,
        background: '#2d3748',
        borderRadius: 999,
        overflow: 'hidden',
      }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: isComplete
            ? 'linear-gradient(90deg, #22c55e, #86efac)'
            : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
          borderRadius: 999,
          transition: 'width 0.5s ease',
        }} />
      </div>
    </div>
  )
}
