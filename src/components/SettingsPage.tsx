import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { BOTS, getBotUrl, setBotUrl } from '../config/bots'

const API = (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000'

interface LoginLog {
  id: string
  username: string | null
  logged_in_at: string
}

interface Settings {
  platform: string
  auto_mode: boolean
  auto_delay: number
  max_messages_per_day: number
  tone: number
  length: number
  emoji: string
  detection_enabled: boolean
  detection_target: number
}

const DEFAULTS: Settings = {
  platform: 'chb',
  auto_mode: true,
  auto_delay: 10,
  max_messages_per_day: 200,
  tone: 0,
  length: 0,
  emoji: 'wenig',
  detection_enabled: true,
  detection_target: 30,
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULTS)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`${API}/settings`)
      .then(r => r.json())
      .then(d => { setSettings({ ...DEFAULTS, ...d }); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const update = (key: keyof Settings, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }))
    setSaved(false)
  }

  const save = async () => {
    await fetch(`${API}/settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#4b5563' }}>
      Lade Einstellungen…
    </div>
  )

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Logout */}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button onClick={() => supabase.auth.signOut()} style={{
          background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
          padding: '6px 14px', fontSize: 12, color: 'var(--red)', fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}>
          Abmelden
        </button>
      </div>

      {/* Plattform */}
      <Section title="🌐 Plattform">
        <div style={{ display: 'flex', gap: 10 }}>
          {['chb', 'platform2'].map(p => (
            <PlatformBtn
              key={p}
              active={settings.platform === p}
              onClick={() => update('platform', p)}
              label={p === 'chb' ? 'ChatHomeBase' : 'Plattform 2'}
              soon={p === 'platform2'}
            />
          ))}
        </div>
      </Section>

      {/* Agent-Modus */}
      <Section title="🤖 Agent-Modus">
        <Row label="Sende-Modus">
          <div style={{ display: 'flex', gap: 8 }}>
            <ModeBtn active={settings.auto_mode} onClick={() => update('auto_mode', true)} label="⚡ Automatisch" />
            <ModeBtn active={!settings.auto_mode} onClick={() => update('auto_mode', false)} label="🖐 Manuell" />
          </div>
        </Row>
        {settings.auto_mode && (
          <Row label={`Auto-Delay: ${settings.auto_delay}s`}>
            <input
              type="range" min={5} max={30} step={1}
              value={settings.auto_delay}
              onChange={e => update('auto_delay', Number(e.target.value))}
              style={sliderStyle}
            />
          </Row>
        )}
        <Row label={`Max. Nachrichten/Tag: ${settings.max_messages_per_day}`}>
          <input
            type="range" min={10} max={500} step={10}
            value={settings.max_messages_per_day}
            onChange={e => update('max_messages_per_day', Number(e.target.value))}
            style={sliderStyle}
          />
        </Row>
      </Section>

      {/* Schreibstil */}
      <Section title="🎛️ Schreibstil (Live-Anpassung)">
        <Row label={`Ton: ${toneLabel(settings.tone)}`}>
          <input
            type="range" min={-2} max={2} step={1}
            value={settings.tone}
            onChange={e => update('tone', Number(e.target.value))}
            style={sliderStyle}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4b5563', marginTop: 4 }}>
            <span>Sachlich</span><span>Neutral</span><span>Flirty</span>
          </div>
        </Row>
        <Row label={`Länge: ${lengthLabel(settings.length)}`}>
          <input
            type="range" min={-2} max={2} step={1}
            value={settings.length}
            onChange={e => update('length', Number(e.target.value))}
            style={sliderStyle}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#4b5563', marginTop: 4 }}>
            <span>Kurz</span><span>Normal</span><span>Ausführlich</span>
          </div>
        </Row>
        <Row label="Emojis">
          <div style={{ display: 'flex', gap: 8 }}>
            {(['aus', 'wenig', 'viel'] as const).map(e => (
              <ModeBtn key={e} active={settings.emoji === e} onClick={() => update('emoji', e)}
                label={e === 'aus' ? '🚫 Keine' : e === 'wenig' ? '😊 Wenig' : '🎉 Viele'} />
            ))}
          </div>
        </Row>
      </Section>

      {/* KI-Erkennung */}
      <Section title="🔍 KI-Erkennung">
        <Row label="Aktiv">
          <Toggle value={settings.detection_enabled} onChange={v => update('detection_enabled', v)} />
        </Row>
        {settings.detection_enabled && (
          <Row label={`Ziel-Score: unter ${settings.detection_target}%`}>
            <input
              type="range" min={10} max={50} step={5}
              value={settings.detection_target}
              onChange={e => update('detection_target', Number(e.target.value))}
              style={sliderStyle}
            />
          </Row>
        )}
      </Section>

      {/* Login Logs */}
      <LoginLogsSection />

      {/* Backend URLs */}
      <BackendUrlsSection />

      {/* Speichern */}
      <button onClick={save} style={{
        background: saved ? '#166534' : '#1d4ed8',
        color: '#fff', border: 'none', borderRadius: 10,
        padding: '12px 0', fontSize: 14, fontWeight: 700,
        cursor: 'pointer', transition: 'background 0.2s',
        fontFamily: 'inherit',
      }}>
        {saved ? '✅ Gespeichert' : '💾 Speichern'}
      </button>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toneLabel(v: number) {
  return ['Sehr sachlich', 'Sachlich', 'Neutral', 'Flirty', 'Sehr flirty'][v + 2]
}
function lengthLabel(v: number) {
  return ['Sehr kurz', 'Kurz', 'Normal', 'Lang', 'Sehr lang'][v + 2]
}

const sliderStyle: React.CSSProperties = {
  width: '100%', accentColor: '#3b82f6', cursor: 'pointer',
}

// ─── Login Logs ───────────────────────────────────────────────────────────────
function LoginLogsSection() {
  const [logs, setLogs] = useState<LoginLog[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('login_logs').select('*').order('logged_in_at', { ascending: false }).limit(50)
      .then(({ data }) => { setLogs((data as LoginLog[]) || []); setLoading(false) })
  }, [])

  return (
    <Section title="📋 Login-Protokoll">
      {loading ? (
        <div style={{ fontSize: 12, color: '#6b7280' }}>Lade…</div>
      ) : logs.length === 0 ? (
        <div style={{ fontSize: 12, color: '#6b7280' }}>Keine Einträge</div>
      ) : (
        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {logs.map(log => (
            <div key={log.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              fontSize: 12, padding: '6px 10px', background: '#0a0f1a', borderRadius: 6,
            }}>
              <span style={{ color: '#93c5fd', fontWeight: 600 }}>{log.username || '–'}</span>
              <span style={{ color: '#6b7280', fontSize: 11 }}>
                {new Date(log.logged_in_at).toLocaleString('de-DE')}
              </span>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

// ─── Backend URL Config ───────────────────────────────────────────────────────
function BackendUrlsSection() {
  const [urls, setUrls] = useState<Record<string, string>>(
    () => Object.fromEntries(BOTS.map(b => [b.id, getBotUrl(b)]))
  )
  const [saved, setSaved] = useState(false)

  const save = () => {
    BOTS.forEach(b => { if (urls[b.id]) setBotUrl(b, urls[b.id].trim()) })
    window.dispatchEvent(new Event('botUrlsUpdated'))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Section title="🔌 Backend-Verbindungen">
      {BOTS.map(bot => (
        <div key={bot.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: bot.color, fontWeight: 700 }}>
            {bot.icon} {bot.label}
          </label>
          <input
            type="text"
            value={urls[bot.id]}
            onChange={e => { setUrls(prev => ({ ...prev, [bot.id]: e.target.value })); setSaved(false) }}
            placeholder={bot.defaultUrl}
            style={{
              background: 'var(--bg3)', border: '1px solid var(--border)',
              borderRadius: 8, color: 'var(--text)', padding: '8px 12px',
              fontSize: 12, outline: 'none', fontFamily: 'monospace', width: '100%',
            }}
          />
        </div>
      ))}
      <button onClick={save} style={{
        background: saved ? '#166534' : '#1d4ed8',
        color: '#fff', border: 'none', borderRadius: 8,
        padding: '9px 0', fontSize: 13, fontWeight: 700,
        cursor: 'pointer', transition: 'background 0.2s', fontFamily: 'inherit',
      }}>
        {saved ? '✅ URLs gespeichert' : '💾 URLs speichern'}
      </button>
      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
        Änderungen werden sofort aktiv – WebSocket wird neu verbunden.
      </div>
    </Section>
  )
}

// ─── Sub-Components ───────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--card-border)',
      borderRadius: 12, padding: '16px 18px',
      display: 'flex', flexDirection: 'column', gap: 14,
    }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', letterSpacing: '0.05em' }}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: 12, color: '#9ca3af' }}>{label}</div>
      {children}
    </div>
  )
}

function PlatformBtn({ active, onClick, label, soon }: { active: boolean; onClick: () => void; label: string; soon?: boolean }) {
  return (
    <button onClick={soon ? undefined : onClick} style={{
      background: active ? '#1e3a5f' : '#0f1623',
      color: active ? '#93c5fd' : soon ? '#374151' : '#6b7280',
      border: `1px solid ${active ? '#1e5a9c' : '#1a2335'}`,
      borderRadius: 8, padding: '8px 16px',
      fontSize: 12, fontWeight: 600,
      cursor: soon ? 'not-allowed' : 'pointer',
      fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6,
    }}>
      {label}
      {soon && <span style={{ fontSize: 9, color: '#374151', background: '#1a2335', borderRadius: 4, padding: '1px 5px' }}>BALD</span>}
    </button>
  )
}

function ModeBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button onClick={onClick} style={{
      background: active ? '#1e2d47' : '#0f1623',
      color: active ? '#93c5fd' : '#6b7280',
      border: `1px solid ${active ? '#1e3a5f' : '#1a2335'}`,
      borderRadius: 8, padding: '6px 14px',
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
      fontFamily: 'inherit',
    }}>
      {label}
    </button>
  )
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      width: 42, height: 22, borderRadius: 999,
      background: value ? '#1d4ed8' : '#1a2335',
      border: 'none', cursor: 'pointer', position: 'relative',
      transition: 'background 0.2s',
    }}>
      <span style={{
        position: 'absolute', top: 3,
        left: value ? 22 : 4,
        width: 16, height: 16,
        background: '#fff', borderRadius: '50%',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}
