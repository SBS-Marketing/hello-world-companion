import { useEffect, useRef, useState } from 'react'
import type { LogEntry } from '../hooks/useWebSocket'

interface Props {
  logs: LogEntry[]
}

type Filter = 'all' | 'error' | 'warning' | 'info'

const levelColor: Record<string, string> = {
  error:   '#f87171',
  warning: '#fbbf24',
  info:    '#4ade80',
}

const levelBg: Record<string, string> = {
  error:   '#2a0d0d',
  warning: '#1f1500',
  info:    'transparent',
}

const levelIcon: Record<string, string> = {
  error:   '❌',
  warning: '⚠️',
  info:    '›',
}

function msgIcon(msg: string) {
  if (msg.includes('KI-CODE') || msg.includes('KI-Code')) return '🔑'
  if (msg.includes('❌') || msg.includes('Fehler'))       return '❌'
  if (msg.includes('✅') || msg.includes('korrekt'))      return '✅'
  if (msg.includes('💬') || msg.includes('Nachricht'))    return '💬'
  if (msg.includes('🤖') || msg.includes('Grok'))         return '🤖'
  if (msg.includes('🔍') || msg.includes('Scan'))         return '🔍'
  if (msg.includes('⚡') || msg.includes('LLM'))          return '⚡'
  if (msg.includes('📤') || msg.includes('Gesendet'))     return '📤'
  if (msg.includes('📝') || msg.includes('Tippe'))        return '📝'
  return ''
}

export function LiveFeedPage({ logs }: Props) {
  const [filter, setFilter] = useState<Filter>('all')
  const [autoScroll, setAutoScroll] = useState(true)
  const [search, setSearch] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const errorCount   = logs.filter(l => l.level === 'error').length
  const warningCount = logs.filter(l => l.level === 'warning').length

  const filtered = logs.filter(l => {
    if (filter === 'error'   && l.level !== 'error')   return false
    if (filter === 'warning' && l.level !== 'warning') return false
    if (filter === 'info'    && l.level !== 'info')    return false
    if (search && !l.message.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  useEffect(() => {
    if (autoScroll) bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, autoScroll])

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', background: 'var(--bg)',
    }}>
      {/* Toolbar */}
      <div style={{
        flexShrink: 0,
        padding: '10px 14px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg2)',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}>
        {/* Filter buttons */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <FeedFilterBtn active={filter === 'all'} onClick={() => setFilter('all')} color="var(--text2)">
            Alle ({logs.length})
          </FeedFilterBtn>
          <FeedFilterBtn active={filter === 'error'} onClick={() => setFilter('error')} color="#f87171">
            Fehler ({errorCount})
          </FeedFilterBtn>
          <FeedFilterBtn active={filter === 'warning'} onClick={() => setFilter('warning')} color="#fbbf24">
            Warnungen ({warningCount})
          </FeedFilterBtn>
          <FeedFilterBtn active={filter === 'info'} onClick={() => setFilter('info')} color="#4ade80">
            Info
          </FeedFilterBtn>

          <div style={{ flex: 1 }} />

          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(v => !v)}
            style={{
              background: autoScroll ? '#0f2a1a' : 'var(--bg3)',
              color: autoScroll ? '#4ade80' : 'var(--text3)',
              border: `1px solid ${autoScroll ? '#166534' : 'var(--border)'}`,
              borderRadius: 8, padding: '5px 10px',
              fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {autoScroll ? '⬇ Auto' : '⏸ Pausiert'}
          </button>
        </div>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Suche in Logs…"
          style={{
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 8, color: 'var(--text)', padding: '7px 12px',
            fontSize: 13, outline: 'none', fontFamily: 'monospace',
            width: '100%',
          }}
        />
      </div>

      {/* Log entries */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '6px 0 80px',
        fontFamily: 'monospace',
      }}>
        {filtered.length === 0 ? (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 60, color: 'var(--text3)', fontSize: 13,
          }}>
            {logs.length === 0 ? 'Warte auf Agent-Logs…' : 'Keine Treffer'}
          </div>
        ) : (
          filtered.map((l, i) => {
            const icon = msgIcon(l.message) || levelIcon[l.level] || '›'
            const col  = levelColor[l.level] || '#4ade80'
            const bg   = levelBg[l.level] || 'transparent'
            return (
              <div
                key={i}
                className="slide-up"
                style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  padding: '4px 14px',
                  background: bg,
                  borderLeft: l.level === 'error' ? '3px solid #ef4444' : l.level === 'warning' ? '3px solid #fbbf24' : '3px solid transparent',
                }}
              >
                <span style={{ color: 'var(--text3)', fontSize: 11, flexShrink: 0, marginTop: 1, minWidth: 42 }}>
                  {l.ts}
                </span>
                <span style={{ flexShrink: 0, fontSize: 12, marginTop: 1 }}>{icon}</span>
                {l.agent && (
                  <span style={{
                    flexShrink: 0, fontSize: 10, color: '#60a5fa',
                    background: '#1e3a5f33', borderRadius: 4,
                    padding: '1px 5px', marginTop: 2, fontWeight: 700,
                  }}>
                    {l.agent}
                  </span>
                )}
                <span style={{
                  color: col, fontSize: 12, lineHeight: 1.5,
                  wordBreak: 'break-word', flex: 1,
                }}>
                  {l.message}
                </span>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function FeedFilterBtn({ active, onClick, color, children }: {
  active: boolean; onClick: () => void; color: string; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? color + '22' : 'var(--bg3)',
        color: active ? color : 'var(--text3)',
        border: `1px solid ${active ? color + '55' : 'var(--border)'}`,
        borderRadius: 20, padding: '5px 12px',
        fontSize: 12, fontWeight: active ? 700 : 400,
        cursor: 'pointer', fontFamily: 'inherit',
        transition: 'all 0.15s',
      }}
    >
      {children}
    </button>
  )
}
