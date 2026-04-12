import type { BotConfig } from '../config/bots'
import type { BotState } from '../hooks/useBotConnection'
import { ConversationCard } from './ConversationCard'

interface Props {
  bot: BotConfig
  state: BotState
  filter: 'pending' | 'all'
}

export function BotChatsPanel({ bot, state, filter }: Props) {
  const { conversations, connected, pendingCount, approve, edit, reject, countdowns } = state

  const filtered = filter === 'pending'
    ? conversations.filter(c => c.status === 'pending' || c.status === 'typed')
    : conversations

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Bot Header */}
      <div style={{
        flexShrink: 0,
        padding: '10px 14px',
        borderBottom: `1px solid ${bot.color}33`,
        background: `${bot.color}0a`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 18 }}>{bot.icon}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: bot.color }}>{bot.label}</span>

        {/* Connection dot */}
        <div style={{
          width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
          background: connected ? 'var(--green)' : 'var(--red)',
          boxShadow: connected ? '0 0 5px var(--green)' : 'none',
        }} />

        <div style={{ flex: 1 }} />

        {pendingCount > 0 && (
          <span style={{
            background: 'var(--yellow)', color: '#0a0c14',
            borderRadius: 999, fontSize: 11, fontWeight: 800,
            padding: '2px 8px',
          }}>
            {pendingCount} ausstehend
          </span>
        )}

        {state.stats && (
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>
            {state.stats.today_messages} heute
          </span>
        )}
      </div>

      {/* Chat List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px 20px' }}>
        {filtered.length === 0 ? (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            padding: '40px 20px', color: 'var(--text3)', gap: 8,
          }}>
            <span style={{ fontSize: 32 }}>{connected ? '✅' : '🔌'}</span>
            <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>
              {connected
                ? filter === 'pending' ? 'Keine ausstehenden Chats' : 'Keine Chats'
                : 'Nicht verbunden'}
            </span>
            <span style={{ fontSize: 12 }}>
              {connected ? 'Agent scannt…' : 'Backend nicht erreichbar'}
            </span>
          </div>
        ) : (
          filtered.map(conv => (
            <ConversationCard
              key={conv.id}
              conv={conv}
              countdown={countdowns[conv.id]}
              onApprove={approve}
              onEdit={edit}
              onReject={reject}
              onThumbsUp={approve}
              onThumbsDown={reject}
              onStop={reject}
              onCancelCountdown={() => {/* countdown cleared by edit action */}}
            />
          ))
        )}
      </div>
    </div>
  )
}
