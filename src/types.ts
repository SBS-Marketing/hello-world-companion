export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export interface Conversation {
  id: string
  history: Message[]
  suggestion: string | null
  raw_suggestion?: string | null
  send_image: boolean
  model_used: string
  status: 'pending' | 'typed' | 'approved' | 'edited' | 'rejected' | 'sent' | 'error'
  created_at: string
  platform_url: string
  logbook?: string
  error?: string
  final_text?: string
  detection_scores?: number[]
  original_text?: string | null
  humanized_text?: string | null
  original_score?: number | null
  humanized_score?: number | null
}

export interface Milestone {
  count: number
  current: number
  label: string
  progress: number
  remaining: number
}

export interface Stats {
  today_messages: number
  today_examples: number
  total_examples: number
  pending_count: number
  active_conversations: number
  next_milestone: Milestone
  model: string
  avg_ai_score?: number | null
  avg_response_time?: number | null
}
