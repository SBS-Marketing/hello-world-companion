import { useState, useEffect } from 'react'
import { useTheme } from './hooks/useTheme'
import { BOTS, getBotUrl } from './config/bots'
import { useBotConnection } from './hooks/useBotConnection'
import { BotChatsPanel } from './components/BotChatsPanel'
import { BotOverviewPage } from './components/BotOverviewPage'
import { LiveFeedPage } from './components/LiveFeedPage'
import { SettingsPage } from './components/SettingsPage'
import { StatsPage } from './components/StatsPage'

type Page = 'overview' | 'chats' | 'feed' | 'stats' | 'settings'

// ─── Top-level multi-bot state ─────────────────────────────────────────────────
// Each bot connects independently; this component just wires them together.
export default function App() {
  const { theme, toggle: toggleTheme } = useTheme()
  const [page,       setPage]       = useState<Page>('overview')
  const [activeBotId, setActiveBotId] = useState<string>(BOTS[0].id)
  const [filter,     setFilter]     = useState<'pending' | 'all'>('pending')
  const [feedBotId,  setFeedBotId]  = useState<string>(BOTS[0].id)

  // Resolve URLs (may be overridden in settings → localStorage)
  const [botUrls, setBotUrls] = useState<Record<string, string>>(() =>
    Object.fromEntries(BOTS.map(b => [b.id, getBotUrl(b)]))
  )

  // Refresh URLs if settings page saves new values
  useEffect(() => {
    const handler = () => setBotUrls(Object.fromEntries(BOTS.map(b => [b.id, getBotUrl(b)])))
    window.addEventListener('botUrlsUpdated', handler)
    return () => window.removeEventListener('botUrlsUpdated', handler)
  }, [])

  // ─── Independent bot connections (all always active in background) ──────────
  const sa  = useBotConnection(botUrls['sa'])
  const fpc = useBotConnection(botUrls['fpc'])
  const chb = useBotConnection(botUrls['chb'])

  const botStates: Record<string, ReturnType<typeof useBotConnection>> = { sa, fpc, chb }

  // ─── Derived totals ─────────────────────────────────────────────────────────
  const totalPending = sa.pendingCount + fpc.pendingCount + chb.pendingCount
  const totalErrors  = sa.errorCount  + fpc.errorCount  + chb.errorCount

  const activeBot   = BOTS.find(b => b.id === activeBotId) ?? BOTS[0]
  const activeState = botStates[activeBot.id]

  // ─── Stats for overview (from first connected bot or null) ──────────────────
  const overviewStats = sa.stats ?? fpc.stats ?? chb.stats

  // ─── Monthly per-bot stats ──────────────────────────────────────────────────
  const botMonthly = BOTS.map(b => ({
    bot: b,
    cur: botStates[b.id].stats?.monthly_messages ?? null,
    tgt: botStates[b.id].stats?.monthly_target ?? null,
  })).filter(m => m.cur != null && m.tgt != null) as { bot: typeof BOTS[0]; cur: number; tgt: number }[]

  const handleFeedOpen = (botId?: string) => {
    if (botId) {
      setFeedBotId(botId)
      botStates[botId].clearErrorCount()
    }
    setPage('feed')
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100dvh', background: 'var(--bg)', overflow: 'hidden',
    }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="glass" style={{
        flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        padding: '10px 14px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          💬 Agent
        </span>

        {/* Per-bot connection dots */}
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {BOTS.map(b => {
            const st = botStates[b.id]
            return (
              <div key={b.id} title={`${b.label}: ${st.connected ? 'verbunden' : 'getrennt'}`} style={{
                display: 'flex', alignItems: 'center', gap: 3,
                background: 'var(--bg3)', borderRadius: 20, padding: '2px 7px',
                border: `1px solid ${st.connected ? b.color + '44' : 'var(--border)'}`,
              }}>
                <div className={st.connected ? 'dot-pulse' : ''} style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: st.connected ? b.color : 'var(--text3)',
                  boxShadow: st.connected ? `0 0 6px ${b.color}` : 'none',
                }} />
                <span style={{ fontSize: 9, color: st.connected ? b.color : 'var(--text3)', fontWeight: 700 }}>
                  {b.id.toUpperCase()}
                </span>
              </div>
            )
          })}
        </div>

        <div style={{ flex: 1 }} />

        {/* Per-bot monthly chips — hidden on mobile */}
        <div className="header-chips" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {botMonthly.map(m => (
            <MonthlyChip key={m.bot.id} cur={m.cur} tgt={m.tgt} label={m.bot.id.toUpperCase()} color={m.bot.color} />
          ))}
        </div>

        {/* Theme toggle */}
        <button onClick={toggleTheme} title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', fontSize: 15, transition: 'all 0.2s',
        }}>
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        <StatChip
          label="Pending"
          value={totalPending}
          color={totalPending > 0 ? 'var(--yellow)' : 'var(--text3)'}
        />
      </header>

      {/* ── Page Content ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>

        {/* Overview */}
        <PageSlot visible={page === 'overview'}>
          <BotOverviewPage
            stats={overviewStats ?? undefined}
            botMonthly={botMonthly}
            apiUrl={botUrls['chb']}
            botUrls={botUrls}
            botLogs={Object.fromEntries(BOTS.map(b => [b.id, botStates[b.id].logs]))}
          />
        </PageSlot>

        {/* Chats — multi-bot panels */}
        <PageSlot visible={page === 'chats'}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

            {/* Bot selector tabs */}
            <div style={{
              flexShrink: 0,
              padding: '10px 12px 0',
              display: 'flex', gap: 6, alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg2)',
            }}>
              {BOTS.map(bot => {
                const st = botStates[bot.id]
                const isActive = activeBotId === bot.id
                return (
                  <button
                    key={bot.id}
                    onClick={() => setActiveBotId(bot.id)}
                    style={{
                      background: isActive ? bot.color + '22' : 'transparent',
                      color: isActive ? bot.color : 'var(--text3)',
                      border: `1px solid ${isActive ? bot.color + '55' : 'transparent'}`,
                      borderBottom: isActive ? `2px solid ${bot.color}` : '2px solid transparent',
                      borderRadius: '8px 8px 0 0',
                      padding: '7px 14px 8px',
                      fontSize: 13, fontWeight: isActive ? 700 : 400,
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                      transition: 'all 0.15s',
                      position: 'relative', bottom: -1,
                    }}
                  >
                    <span>{bot.icon}</span>
                    <span>{bot.label}</span>
                    {st.pendingCount > 0 && (
                      <span style={{
                        background: 'var(--yellow)', color: '#0a0c14',
                        borderRadius: 999, fontSize: 10, fontWeight: 800,
                        padding: '1px 5px', minWidth: 16, textAlign: 'center',
                      }}>
                        {st.pendingCount}
                      </span>
                    )}
                    {!st.connected && (
                      <span style={{
                        width: 5, height: 5, borderRadius: '50%',
                        background: 'var(--red)', flexShrink: 0,
                        display: 'inline-block',
                      }} />
                    )}
                  </button>
                )
              })}

              <div style={{ flex: 1 }} />

              {/* Filter */}
              <div style={{ display: 'flex', gap: 4, paddingBottom: 8 }}>
                <SmallBtn active={filter === 'pending'} onClick={() => setFilter('pending')}>
                  Ausstehend
                </SmallBtn>
                <SmallBtn active={filter === 'all'} onClick={() => setFilter('all')}>
                  Alle
                </SmallBtn>
              </div>
            </div>

            {/* Active bot panel */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <BotChatsPanel
                key={activeBot.id}
                bot={activeBot}
                state={activeState}
                filter={filter}
              />
            </div>
          </div>
        </PageSlot>

        {/* Live Feed — per-bot switcher */}
        <PageSlot visible={page === 'feed'}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            {/* Bot feed selector */}
            <div style={{
              flexShrink: 0, display: 'flex', gap: 6, padding: '8px 12px',
              borderBottom: '1px solid var(--border)', background: 'var(--bg2)',
              flexWrap: 'wrap',
            }}>
              {BOTS.map(bot => {
                const st = botStates[bot.id]
                return (
                  <button key={bot.id}
                    onClick={() => { setFeedBotId(bot.id); st.clearErrorCount() }}
                    style={{
                      background: feedBotId === bot.id ? bot.color + '22' : 'var(--bg3)',
                      color: feedBotId === bot.id ? bot.color : 'var(--text3)',
                      border: `1px solid ${feedBotId === bot.id ? bot.color + '55' : 'var(--border)'}`,
                      borderRadius: 20, padding: '5px 12px',
                      fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {bot.icon} {bot.label}
                    {st.errorCount > 0 && (
                      <span style={{ background: 'var(--red)', color: '#fff', borderRadius: 999, fontSize: 9, fontWeight: 800, padding: '1px 5px' }}>
                        {st.errorCount}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <LiveFeedPage logs={botStates[feedBotId]?.logs ?? []} />
            </div>
          </div>
        </PageSlot>

        {/* Stats */}
        <PageSlot visible={page === 'stats'}>
          <StatsPage botUrls={botUrls} />
        </PageSlot>

        {/* Settings */}
        <PageSlot visible={page === 'settings'}>
          <SettingsPage />
        </PageSlot>
      </div>

      {/* ── Bottom Navigation ────────────────────────────────────────────────── */}
      <nav className="glass" style={{
        flexShrink: 0,
        borderTop: '1px solid var(--border)',
        display: 'flex',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}>
        <NavTab icon="🧭" label="Übersicht" active={page === 'overview'} onClick={() => setPage('overview')} />
        <NavTab
          icon="💬" label="Chats" active={page === 'chats'}
          onClick={() => setPage('chats')}
          badge={totalPending || undefined}
        />
        <NavTab
          icon="📡" label="Feed" active={page === 'feed'}
          onClick={() => handleFeedOpen()}
          badge={totalErrors > 0 ? totalErrors : undefined} badgeRed
        />
        <NavTab icon="📊" label="Stats" active={page === 'stats'} onClick={() => setPage('stats')} />
        <NavTab icon="⚙️" label="Settings" active={page === 'settings'} onClick={() => setPage('settings')} />
      </nav>
    </div>
  )
}

// ─── PageSlot ─────────────────────────────────────────────────────────────────
function PageSlot({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div style={{ position: 'absolute', inset: 0, overflowY: 'auto', display: visible ? 'flex' : 'none', flexDirection: 'column' }}>
      {children}
    </div>
  )
}

// ─── NavTab ──────────────────────────────────────────────────────────────────
function NavTab({ icon, label, active, onClick, badge, badgeRed }: {
  icon: string; label: string; active: boolean
  onClick: () => void; badge?: number; badgeRed?: boolean
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, border: 'none', background: 'transparent',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '12px 4px 10px', cursor: 'pointer', position: 'relative',
      color: active ? 'var(--blue)' : 'var(--text3)',
      fontFamily: 'inherit', transition: 'color 0.2s', gap: 3,
      minHeight: 56,
    }}>
      {badge != null && badge > 0 && (
        <span style={{
          position: 'absolute', top: 6, right: '50%', transform: 'translateX(14px)',
          background: badgeRed ? 'var(--red)' : 'var(--yellow)',
          color: badgeRed ? '#fff' : '#0a0c14',
          borderRadius: 999, fontSize: 9, fontWeight: 800,
          padding: '1px 5px', minWidth: 16, textAlign: 'center', lineHeight: '14px',
          boxShadow: `0 0 8px ${badgeRed ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`,
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      <span style={{ fontSize: 20, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 10, fontWeight: active ? 700 : 400, letterSpacing: '0.02em' }}>{label}</span>
      {active && (
        <span style={{
          position: 'absolute', bottom: 0, left: '25%', right: '25%',
          height: 2.5, background: 'var(--blue)', borderRadius: 999,
          boxShadow: '0 0 8px rgba(59,130,246,0.4)',
        }} />
      )}
    </button>
  )
}

// ─── SmallBtn ────────────────────────────────────────────────────────────────
function SmallBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      background: active ? '#1e2d47' : 'var(--bg3)',
      color: active ? '#93c5fd' : 'var(--text3)',
      border: `1px solid ${active ? '#1e3a5f' : 'var(--border)'}`,
      borderRadius: 6, padding: '4px 10px',
      fontSize: 11, fontWeight: active ? 700 : 400,
      cursor: 'pointer', fontFamily: 'inherit',
    }}>
      {children}
    </button>
  )
}

// ─── StatChip ────────────────────────────────────────────────────────────────
function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', lineHeight: 1 }}>
      <span style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 15, fontWeight: 800, color }}>{value.toLocaleString('de-DE')}</span>
    </div>
  )
}

// ─── MonthlyChip ─────────────────────────────────────────────────────────────
function MonthlyChip({ cur, tgt, label, color: botColor }: { cur: number; tgt: number; label?: string; color?: string }) {
  const pct      = Math.min(100, Math.round((cur / tgt) * 100))
  const expected = Math.round((tgt / 30) * new Date().getDate())
  const onTrack  = cur >= expected * 0.9
  const done     = cur >= tgt
  const trackColor = done ? 'var(--green)' : onTrack ? (botColor ?? 'var(--blue)') : 'var(--yellow)'
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 3,
      padding: '4px 8px',
      background: 'var(--bg3)', border: `1px solid ${botColor ? botColor + '33' : 'var(--border)'}`, borderRadius: 10,
      minWidth: 70,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {label && <span style={{ fontSize: 9, color: botColor ?? 'var(--text3)', fontWeight: 700 }}>{label}</span>}
        <span style={{ fontSize: 10, fontWeight: 800, color: trackColor }}>
          {done ? '🎉' : onTrack ? '✓' : '⚠'} {cur}/{tgt}
        </span>
      </div>
      <div style={{ background: 'var(--border)', borderRadius: 999, height: 3 }}>
        <div style={{ background: trackColor, borderRadius: 999, height: 3, width: `${pct}%`, transition: 'width 0.4s' }} />
      </div>
    </div>
  )
}
