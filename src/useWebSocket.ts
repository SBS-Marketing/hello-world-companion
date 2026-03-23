import { useEffect, useRef, useCallback, useState } from 'react'
import type { Conversation, Stats } from '../types'

const WS_URL = 'ws://localhost:8000/ws'
const RECONNECT_DELAY = 3000

interface WsMessage {
  type: string
  conversation?: Conversation
  conversations?: Conversation[]
  conversation_id?: string
  final_text?: string
  stats?: Stats
  message?: string
  level?: string
  ts?: string
}

export interface LogEntry {
  ts: string
  message: string
  level: string
}

export function useWebSocket(
  onConversation: (conv: Conversation) => void,
  onTyped: (id: string) => void,
  onApproved: (id: string) => void,
  onEdited: (id: string, text: string) => void,
  onRejected: (id: string) => void,
  onSent: (id: string) => void,
  onStats: (stats: Stats) => void,
  onInitState: (convs: Conversation[], stats: Stats) => void,
  onAgentLog: (entry: LogEntry) => void,
) {
  const wsRef = useRef<WebSocket | null>(null)
  const [connected, setConnected] = useState(false)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout>>()

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      console.log('WebSocket connected')
      // Heartbeat alle 30s
      const hb = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) ws.send('ping')
      }, 30000)
      ws.addEventListener('close', () => clearInterval(hb))
    }

    ws.onmessage = (event) => {
      try {
        const msg: WsMessage = JSON.parse(event.data)

        if (msg.stats) onStats(msg.stats)

        switch (msg.type) {
          case 'state':
            if (msg.conversations && msg.stats) {
              onInitState(msg.conversations, msg.stats)
            }
            break
          case 'new_conversation':
            if (msg.conversation) onConversation(msg.conversation)
            break
          case 'conversation_typed':
            if (msg.conversation_id) onTyped(msg.conversation_id)
            break
          case 'conversation_approved':
            if (msg.conversation_id) onApproved(msg.conversation_id)
            break
          case 'conversation_edited':
            if (msg.conversation_id && msg.final_text) onEdited(msg.conversation_id, msg.final_text)
            break
          case 'conversation_rejected':
            if (msg.conversation_id) onRejected(msg.conversation_id)
            break
          case 'message_sent':
            if (msg.conversation_id) onSent(msg.conversation_id)
            break
          case 'agent_log':
            if (msg.message) onAgentLog({ ts: msg.ts ?? '', message: msg.message, level: msg.level ?? 'info' })
            break
        }
      } catch (e) {
        console.error('WS parse error:', e)
      }
    }

    ws.onclose = () => {
      setConnected(false)
      console.log('WebSocket disconnected, reconnecting...')
      reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY)
    }

    ws.onerror = (e) => {
      console.error('WebSocket error:', e)
      ws.close()
    }
  }, [onConversation, onTyped, onApproved, onEdited, onRejected, onSent, onStats, onInitState, onAgentLog])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { connected }
}
