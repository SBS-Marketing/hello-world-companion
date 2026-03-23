import { useState } from 'react'
import type { Conversation } from '../types'

const COUNTDOWN_TOTAL = 10

interface Props {
  conv: Conversation
  countdown?: number
  onApprove: (id: string) => Promise<void>
  onEdit: (id: string, text: string) => Promise<void>
  onReject: (id: string) => Promise<void>
  onThumbsUp: (id: string) => Promise<void>
  onThumbsDown: (id: string) => Promise<void>
  onStop: (id: string) => Promise<void>
  onCancelCountdown: (id: string) => void
}

const STATUS_COLORS: Record<string, string> = {
  pending:  '#fbbf24',
  typed:    '#34d399',
  approved: '#22c55e',
  edited:   '#60a5fa',
  rejected: '#ef4444',
  sent:     '#a78bfa',
  error:    '#f87171',
}
const STATUS_LABELS: Record<string, string> = {
  pending:  '⏳ Generiert',
  typed:    '✍️ Eingetippt',
  approved: '👍 Bestätigt',
  edited:   '✏️ Bearbeitet',
  rejected: '👎 Abgelehnt',
  sent:     '📤 Gesendet',
  error:    '⚠️ Fehler',
}

function scoreColor(s: number): string {
  if (s <= 20) return '#34d399'
  if (s <= 50) return '#f59e0b'
  return '#ef4444'
}

function getCountdownColor(s: number): string {
  if (s > 6) return '#22c55e'
  if (s > 3) return '#f59e0b'
  return '#ef4444'
}

// ─── Pipeline ──────────────────────────────────────────────────────────────
function Pipeline({ conv }: { conv: Conversation }) {
  const scores = conv.detection_scores ?? []
  const hasGen  = !!(conv.raw_suggestion || conv.suggestion)
  const isReady = ['typed', 'approved', 'edited', 'sent'].includes(conv.status)
  const isOptimized = scores.length > 1

  type Step = {
    icon: string; label: string
    done: boolean; active: boolean
    badge?: string; badgeColor?: string
  }

  const steps: Step[] = [
    { icon: '💬', label: 'Anfrage',  done: true,               active: false },
    { icon: '⚡', label: 'Grok',     done: hasGen,              active: !hasGen },
    {
      icon: '🔍', label: 'KI-Check',
      done: scores.length > 0 || isReady,
      active: hasGen && scores.length === 0 && !isReady,
      badge:      scores.length > 0 ? `${scores[0]}%`            : undefined,
      badgeColor: scores.length > 0 ? scoreColor(scores[0])      : undefined,
    },
    ...(isOptimized ? [{
      icon: '📉', label: 'Senken',
      done: true, active: false,
      badge:      `${scores[scores.length - 1]}%`,
      badgeColor: scoreColor(scores[scores.length - 1]),
    }] : []),
    {
      icon: '✅', label: 'Bereit',
      done:   isReady,
      active: !isReady && hasGen && scores.length > 0,
    },
  ]

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 3,
      marginBottom: 14, overflowX: 'auto', paddingBottom: 2,
    }}>
      {steps.map((step, i) => {
        const col     = step.done ? '#34d399' : step.active ? '#60a5fa' : '#2d3748'
        const textCol = step.done ? '#34d399' : step.active ? '#93c5fd' : '#4b5563'
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
            {i > 0 && (
              <div style={{
                width: 18, height: 2, flexShrink: 0,
                background: steps[i - 1].done ? '#34d39933' : '#1f2937',
                borderRadius: 1,
              }} />
            )}
            <div
              className={step.active ? 'step-active' : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 4,
                padding: '3px 9px', borderRadius: 20,
                background: (step.done || step.active) ? col + '18' : 'transparent',
                border: `1px solid ${col}55`,
                fontSize: 11, fontWeight: step.done || step.active ? 700 : 400,
                color: textCol,
                transition: 'all 0.3s',
                cursor: 'default',
              }}
            >
              <span style={{ fontSize: 12 }}>{step.icon}</span>
              <span>{step.label}</span>
              {step.badge && (
                <span style={{
                  background: step.badgeColor,
                  color: '#000', fontWeight: 900, fontSize: 10,
                  padding: '1px 5px', borderRadius: 999,
                }}>
                  {step.badge}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Score Badge ────────────────────────────────────────────────────────────
function ScoreBadge({ scores }: { scores?: number[] }) {
  if (!scores || scores.length === 0) return null
  const final  = scores[scores.length - 1]
  const first  = scores[0]
  const improved = scores.length > 1
  const col    = scoreColor(final)
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', flexShrink: 0,
      width: 64, height: 64, borderRadius: 12,
      border: `2px solid ${col}66`,
      background: col + '12',
    }}>
      <span style={{ fontSize: 19, fontWeight: 900, color: col, lineHeight: 1 }}>{final}%</span>
      <span style={{ fontSize: 9, color: col + 'bb', marginTop: 2, fontWeight: 600, letterSpacing: '0.05em' }}>KI-SCORE</span>
      {improved && (
        <span style={{ fontSize: 9, color: '#6b7280', marginTop: 1 }}>↓ war {first}%</span>
      )}
    </div>
  )
}

// ─── Main Card ──────────────────────────────────────────────────────────────
export function ConversationCard({
  conv, countdown,
  onApprove, onEdit, onReject, onThumbsUp, onThumbsDown, onStop, onCancelCountdown,
}: Props) {
  const [editMode,  setEditMode]  = useState(false)
  const [editText,  setEditText]  = useState(conv.suggestion || '')
  const [loading,   setLoading]   = useState(false)
  const [showLog,   setShowLog]   = useState(false)

  const isPending    = conv.status === 'pending'
  const isTyped      = conv.status === 'typed'
  const isActionable = isPending || isTyped
  const hasCountdown = isTyped && countdown !== undefined

  const progressPct     = hasCountdown ? ((countdown ?? 0) / COUNTDOWN_TOTAL) * 100 : 0
  const countdownColor  = hasCountdown ? getCountdownColor(countdown ?? 0) : '#22c55e'

  const wrap = async (fn: () => Promise<void>) => {
    setLoading(true); await fn(); setLoading(false)
  }

  const lastCustomerMsg = [...conv.history].reverse().find(m => m.role === 'user')

  return (
    <div
      className="card-new"
      style={{
        background: '#12151f',
        border: `1px solid ${hasCountdown ? countdownColor + '55' : '#1e2433'}`,
        borderRadius: 14,
        marginBottom: 12,
        overflow: 'hidden',
        opacity: loading ? 0.75 : 1,
        transition: 'opacity 0.2s, border-color 0.3s',
        boxShadow: hasCountdown
          ? `0 0 20px ${countdownColor}22`
          : '0 2px 12px #00000044',
      }}
    >
      {/* ── Top stripe (Status + Zeit + Modell) ───────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px',
        borderBottom: '1px solid #1e2433',
        background: '#0e1118',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            fontSize: 12, fontWeight: 700,
            color: STATUS_COLORS[conv.status] ?? '#94a3b8',
          }}>
            {STATUS_LABELS[conv.status] ?? conv.status}
          </span>
          {conv.send_image && (
            <span style={{
              fontSize: 10, color: '#60a5fa', background: '#1e3a5f33',
              padding: '1px 7px', borderRadius: 999, border: '1px solid #1e3a5f',
            }}>
              📷 Bild empfohlen
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {conv.model_used && (
            <span style={{ fontSize: 10, color: '#4b5563', fontFamily: 'monospace' }}>
              {conv.model_used}
            </span>
          )}
          <span style={{ fontSize: 11, color: '#374151' }}>
            {new Date(conv.created_at).toLocaleTimeString('de-DE')}
          </span>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────── */}
      <div style={{ padding: '14px 16px' }}>

        {/* Pipeline */}
        <Pipeline conv={conv} />

        {/* Letzte Kundennachricht */}
        {lastCustomerMsg && (
          <div style={{
            background: '#0f1117', border: '1px solid #1e2433',
            borderRadius: 10, padding: '10px 14px', marginBottom: 12,
          }}>
            <div style={{ fontSize: 10, color: '#4b5563', marginBottom: 5, fontWeight: 600, letterSpacing: '0.06em' }}>
              KUNDE
            </div>
            <div style={{ fontSize: 13, color: '#cbd5e1', lineHeight: 1.55 }}>
              {lastCustomerMsg.content}
            </div>
          </div>
        )}

        {/* KI-Vorschlag: Original + Humanized */}
        {conv.suggestion && (
          <div style={{
            background: '#0b1628', border: '1px solid #1e3a5f55',
            borderRadius: 10, padding: 14, marginBottom: 12,
          }}>

            {/* Zwei-Spalten: Original | Humanized */}
            {conv.original_text && conv.humanized_text && conv.original_text !== conv.humanized_text ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {/* Original (Grok) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: '#6b7280', fontWeight: 700, letterSpacing: '0.07em' }}>
                      🤖 GROK ORIGINAL
                    </span>
                    {conv.original_score != null && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px',
                        borderRadius: 5, background: scoreColor(conv.original_score) + '20',
                        color: scoreColor(conv.original_score),
                      }}>
                        {conv.original_score}%
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 12, color: '#9ca3af', lineHeight: 1.55, whiteSpace: 'pre-wrap',
                    background: '#070d1a', borderRadius: 7, padding: '8px 10px',
                    border: '1px solid #1f2937',
                  }}>
                    {conv.original_text}
                  </div>
                </div>

                {/* Humanized (Undetectable) */}
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: '#34d399', fontWeight: 700, letterSpacing: '0.07em' }}>
                      ✨ HUMANIZED
                    </span>
                    {conv.humanized_score != null && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '1px 6px',
                        borderRadius: 5, background: scoreColor(conv.humanized_score) + '20',
                        color: scoreColor(conv.humanized_score),
                      }}>
                        {conv.humanized_score}%
                      </span>
                    )}
                    {conv.original_score != null && conv.humanized_score != null && conv.humanized_score < conv.original_score && (
                      <span style={{ fontSize: 10, color: '#34d399' }}>
                        ↓ {conv.original_score - conv.humanized_score}pp
                      </span>
                    )}
                  </div>
                  <div style={{
                    fontSize: 12, color: '#e2e8f0', lineHeight: 1.55, whiteSpace: 'pre-wrap',
                    background: '#0a1f12', borderRadius: 7, padding: '8px 10px',
                    border: '1px solid #14532d55',
                  }}>
                    {conv.humanized_text}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 10, color: '#60a5fa', fontWeight: 700, letterSpacing: '0.07em' }}>
                  💡 KI-VORSCHLAG
                </span>
                {conv.original_score != null ? (
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '1px 7px',
                    borderRadius: 5, background: scoreColor(conv.original_score) + '20',
                    color: scoreColor(conv.original_score),
                  }}>
                    {conv.original_score}% KI
                  </span>
                ) : (
                  <span style={{ color: '#374151', fontWeight: 400, fontSize: 10 }}>· kein Score</span>
                )}
              </div>
            )}

            {/* Finale Antwort (editierbar) */}
            <div style={{ fontSize: 10, color: '#3b82f6', fontWeight: 700, letterSpacing: '0.07em', marginBottom: 6 }}>
              📤 WIRD GESENDET
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                {editMode ? (
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    style={{
                      width: '100%', minHeight: 80,
                      background: '#0f1f3d', border: '1px solid #3b5998',
                      borderRadius: 8, color: '#e2e8f0', fontSize: 13,
                      padding: 10, resize: 'vertical', outline: 'none',
                      fontFamily: 'inherit', lineHeight: 1.55,
                    }}
                  />
                ) : (
                  <div style={{
                    fontSize: 14, color: '#e2e8f0', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    background: '#0d1e36', borderRadius: 8, padding: '10px 12px',
                    border: '1px solid #1e3a5f',
                  }}>
                    {conv.final_text ?? conv.suggestion}
                  </div>
                )}
              </div>
              <ScoreBadge scores={conv.detection_scores} />
            </div>
          </div>
        )}

        {/* Fehler */}
        {conv.error && (
          <div style={{
            background: '#1a0808', border: '1px solid #7f1d1d55',
            borderRadius: 8, padding: '10px 14px', marginBottom: 12,
            color: '#fca5a5', fontSize: 13,
          }}>
            ⚠️ {conv.error}
          </div>
        )}

        {/* Logbuch (aufklappbar) */}
        {conv.logbook && (
          <div style={{ marginBottom: 10 }}>
            <button
              onClick={() => setShowLog(v => !v)}
              style={{
                background: 'transparent', border: 'none',
                color: '#374151', fontSize: 11, cursor: 'pointer',
                padding: '2px 0', fontFamily: 'inherit',
              }}
            >
              {showLog ? '▼' : '▶'} Logbuch
            </button>
            {showLog && (
              <div style={{
                background: '#07090f', borderRadius: 6, padding: '8px 10px',
                fontSize: 11, color: '#6b7280', lineHeight: 1.6, marginTop: 4,
                border: '1px solid #1e2433',
              }}>
                {conv.logbook}
              </div>
            )}
          </div>
        )}

        {/* ── COUNTDOWN ─────────────────────────────────────────────── */}
        {hasCountdown && !editMode && (
          <div style={{
            background: '#0a0e1a',
            border: `2px solid ${countdownColor}55`,
            borderRadius: 10, padding: '12px 14px', marginBottom: 12,
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 10,
            }}>
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>
                ⏱ Auto-Senden in
              </span>
              <span style={{
                fontSize: 34, fontWeight: 900, color: countdownColor,
                fontFamily: 'monospace', lineHeight: 1,
                textShadow: `0 0 16px ${countdownColor}66`,
                transition: 'color 0.3s',
              }}>
                {countdown}s
              </span>
            </div>
            <div style={{
              height: 5, background: '#1f2937', borderRadius: 999,
              overflow: 'hidden', marginBottom: 12,
            }}>
              <div style={{
                height: '100%', width: `${progressPct}%`,
                background: countdownColor, borderRadius: 999,
                transition: 'width 0.9s linear, background 0.3s',
                boxShadow: `0 0 6px ${countdownColor}88`,
              }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <StopButton onClick={() => wrap(onStop.bind(null, conv.id))} disabled={loading} />
              <Btn color="#15803d" hover="#166534" onClick={() => wrap(onThumbsUp.bind(null, conv.id))} disabled={loading}>
                ✅ Jetzt senden
              </Btn>
              <Btn color="#1f2937" hover="#374151" onClick={() => { onCancelCountdown(conv.id); setEditMode(true) }} disabled={loading}>
                ✏️ Bearbeiten
              </Btn>
            </div>
          </div>
        )}

        {/* ── ACTION BUTTONS ────────────────────────────────────────── */}
        {isActionable && conv.suggestion && !hasCountdown && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {isTyped && !editMode && (
              <>
                <Btn color="#15803d" hover="#166534" onClick={() => wrap(onThumbsUp.bind(null, conv.id))} disabled={loading}>
                  👍 Senden
                </Btn>
                <Btn color="#1d4ed8" hover="#1e40af" onClick={() => { onCancelCountdown(conv.id); setEditMode(true) }} disabled={loading}>
                  ✏️ Bearbeiten
                </Btn>
                <Btn color="#7f1d1d" hover="#991b1b" onClick={() => wrap(onThumbsDown.bind(null, conv.id))} disabled={loading}>
                  👎 Ablehnen
                </Btn>
              </>
            )}
            {isPending && !editMode && (
              <>
                <Btn color="#15803d" hover="#166534" onClick={() => wrap(onApprove.bind(null, conv.id))} disabled={loading}>
                  ✅ Senden
                </Btn>
                <Btn color="#1d4ed8" hover="#1e40af" onClick={() => setEditMode(true)} disabled={loading}>
                  ✏️ Bearbeiten
                </Btn>
                <Btn color="#7f1d1d" hover="#991b1b" onClick={() => wrap(onReject.bind(null, conv.id))} disabled={loading}>
                  ❌ Ablehnen
                </Btn>
              </>
            )}
            {editMode && (
              <>
                <Btn color="#3b82f6" hover="#2563eb"
                  onClick={async () => {
                    if (!editText.trim()) return
                    setLoading(true)
                    await onEdit(conv.id, editText.trim())
                    setLoading(false); setEditMode(false)
                  }}
                  disabled={loading || !editText.trim()}
                >
                  ✅ Bearbeitet senden
                </Btn>
                <Btn color="#374151" hover="#4b5563"
                  onClick={() => { setEditMode(false); setEditText(conv.suggestion ?? '') }}
                  disabled={loading}
                >
                  Abbrechen
                </Btn>
              </>
            )}
          </div>
        )}

        {/* Edit während Countdown */}
        {isTyped && editMode && !hasCountdown && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Btn color="#3b82f6" hover="#2563eb"
              onClick={async () => {
                if (!editText.trim()) return
                setLoading(true)
                await onEdit(conv.id, editText.trim())
                setLoading(false); setEditMode(false)
              }}
              disabled={loading || !editText.trim()}
            >
              ✅ Bearbeitet senden
            </Btn>
            <Btn color="#374151" hover="#4b5563"
              onClick={() => { setEditMode(false); setEditText(conv.suggestion ?? '') }}
              disabled={loading}
            >
              Abbrechen
            </Btn>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function StopButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: h ? '#991b1b' : '#dc2626', color: '#fff',
        border: '2px solid #ef4444', borderRadius: 8,
        padding: '9px 18px', fontSize: 14, fontWeight: 900,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, fontFamily: 'inherit',
        transition: 'background 0.15s, transform 0.1s',
        transform: h ? 'scale(1.03)' : 'scale(1)',
        boxShadow: h ? '0 0 14px #ef444466' : '0 0 6px #ef444433',
      }}
    >
      🛑 STOPP
    </button>
  )
}

function Btn({
  children, onClick, disabled, color, hover: hoverCol, style: s,
}: {
  children: React.ReactNode; onClick: () => void
  disabled?: boolean; color: string; hover: string
  style?: React.CSSProperties
}) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        background: h ? hoverCol : color, color: '#fff', border: 'none',
        borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1, fontFamily: 'inherit',
        transition: 'background 0.15s', ...s,
      }}
    >
      {children}
    </button>
  )
}
