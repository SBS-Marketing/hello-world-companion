/**
 * Self-contained hook for one bot backend.
 * Manages its own WebSocket, conversations, countdowns and API calls.
 * Completely independent from other bot connections.
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import type { Conversation, Stats } from '../types'

const COUNTDOWN_SECONDS = 10
const MAX_LOGS = 150
const RECONNECT_DELAY = 4000

export interface BotLogEntry {
  ts: string
  message: string
  level: string
  agent?: string
}

export interface BotState {
  conversations: Conversation[]
  stats: Stats | null
  logs: BotLogEntry[]
  connected: boolean
  pendingCount: number
  errorCount: number
  // Actions
  approve: (id: string) => Promise<void>
  edit: (id: string, text: string) => Promise<void>
  reject: (id: string) => Promise<void>
  countdowns: Record<string, number>
  clearErrorCount: () => void
}

const DEFAULT_STATS: Stats = {
  today_messages: 0,
  today_examples: 0,
  total_examples: 0,
  pending_count: 0,
  active_conversations: 0,
  next_milestone: { count: 500, current: 0, label: '', progress: 0, remaining: 500 },
  model: '',
}

export function useBotConnection(apiUrl: string): BotState {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [stats, setStats]                 = useState<Stats | null>(null)
  const [logs, setLogs]                   = useState<BotLogEntry[]>([])
  const [connected, setConnected]         = useState(false)
  const [countdowns, setCountdowns]       = useState<Record<string, number>>({})
  const [errorCount, setErrorCount]       = useState(0)

  const wsRef             = useRef<WebSocket | null>(null)
  const reconnectRef      = useRef<ReturnType<typeof setTimeout>>()
  const countdownRefs     = useRef<Record<string, ReturnType<typeof setInterval>>>({})
  const apiUrlRef         = useRef(apiUrl)

  // Keep apiUrl ref in sync (URL can change from settings)
  useEffect(() => { apiUrlRef.current = apiUrl }, [apiUrl])

  // ─── Countdown ───────────────────────────────────────────────────────────────
  const clearCountdown = useCallback((id: string) => {
    if (countdownRefs.current[id]) { clearInterval(countdownRefs.current[id]); delete countdownRefs.current[id] }
    setCountdowns(prev => { if (!(id in prev)) return prev; const n = { ...prev }; delete n[id]; return n })
  }, [])

  const startCountdown = useCallback((id: string) => {
    if (countdownRefs.current[id]) clearInterval(countdownRefs.current[id])
    setCountdowns(prev => ({ ...prev, [id]: COUNTDOWN_SECONDS }))
    const interval = setInterval(() => {
      setCountdowns(prev => {
        const cur = prev[id]
        if (cur === undefined) { clearInterval(interval); return prev }
        if (cur <= 1) {
          clearInterval(interval); delete countdownRefs.current[id]
          fetch(`${apiUrlRef.current}/approve/${id}`, { method: 'POST' })
          const n = { ...prev }; delete n[id]; return n
        }
        return { ...prev, [id]: cur - 1 }
      })
    }, 1000)
    countdownRefs.current[id] = interval
  }, [])

  useEffect(() => () => { Object.values(countdownRefs.current).forEach(clearInterval) }, [])

  // ─── WebSocket ───────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const wsUrl = apiUrl.replace(/^http/, 'ws') + '/ws'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      const hb = setInterval(() => { if (ws.readyState === WebSocket.OPEN) ws.send('ping') }, 30000)
      ws.addEventListener('close', () => clearInterval(hb))
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        if (msg.stats) setStats(msg.stats)

        switch (msg.type) {
          case 'state':
            if (msg.conversations) {
              setConversations(msg.conversations.filter((c: Conversation) =>
                c.status === 'pending' || c.status === 'typed'
              ))
            }
            break
          case 'new_conversation':
            if (msg.conversation) {
              setConversations(prev => {
                const exists = prev.find(c => c.id === msg.conversation.id)
                return exists
                  ? prev.map(c => c.id === msg.conversation.id ? msg.conversation : c)
                  : [msg.conversation, ...prev]
              })
            }
            break
          case 'conversation_typed':
            if (msg.conversation_id) {
              setConversations(prev => prev.map(c =>
                c.id === msg.conversation_id ? { ...c, status: 'typed' as const } : c
              ))
              startCountdown(msg.conversation_id)
            }
            break
          case 'conversation_approved':
            if (msg.conversation_id) {
              clearCountdown(msg.conversation_id)
              setConversations(prev => prev.map(c =>
                c.id === msg.conversation_id ? { ...c, status: 'approved' as const } : c
              ))
            }
            break
          case 'conversation_edited':
            if (msg.conversation_id) {
              clearCountdown(msg.conversation_id)
              setConversations(prev => prev.map(c =>
                c.id === msg.conversation_id ? { ...c, status: 'edited' as const, final_text: msg.final_text } : c
              ))
            }
            break
          case 'conversation_rejected':
            if (msg.conversation_id) {
              clearCountdown(msg.conversation_id)
              setConversations(prev => prev.map(c =>
                c.id === msg.conversation_id ? { ...c, status: 'rejected' as const } : c
              ))
            }
            break
          case 'message_sent':
            if (msg.conversation_id) {
              clearCountdown(msg.conversation_id)
              setConversations(prev => prev.map(c =>
                c.id === msg.conversation_id ? { ...c, status: 'sent' as const } : c
              ))
            }
            break
          case 'agent_log':
            if (msg.message) {
              const entry: BotLogEntry = { ts: msg.ts ?? '', message: msg.message, level: msg.level ?? 'info', agent: msg.agent }
              setLogs(prev => [...prev.slice(-(MAX_LOGS - 1)), entry])
              if (msg.level === 'error') setErrorCount(n => n + 1)
            }
            break
        }
      } catch (e) {
        // ignore parse errors
      }
    }

    ws.onclose = () => {
      setConnected(false)
      reconnectRef.current = setTimeout(connect, RECONNECT_DELAY)
    }

    ws.onerror = () => ws.close()
  }, [apiUrl, startCountdown, clearCountdown])

  useEffect(() => {
    connect()
    return () => {
      clearTimeout(reconnectRef.current)
      wsRef.current?.close()
    }
  }, [connect])

  // ─── API Actions ─────────────────────────────────────────────────────────────
  const approve = useCallback(async (id: string) => {
    clearCountdown(id)
    await fetch(`${apiUrlRef.current}/approve/${id}`, { method: 'POST' })
  }, [clearCountdown])

  const edit = useCallback(async (id: string, text: string) => {
    clearCountdown(id)
    await fetch(`${apiUrlRef.current}/edit/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  }, [clearCountdown])

  const reject = useCallback(async (id: string) => {
    clearCountdown(id)
    await fetch(`${apiUrlRef.current}/reject/${id}`, { method: 'POST' })
  }, [clearCountdown])

  const pendingCount = conversations.filter(c => c.status === 'pending' || c.status === 'typed').length
  const clearErrorCount = useCallback(() => setErrorCount(0), [])

  return { conversations, stats, logs, connected, pendingCount, errorCount, approve, edit, reject, countdowns, clearErrorCount }
}
