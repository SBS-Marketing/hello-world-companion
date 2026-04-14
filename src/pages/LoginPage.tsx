import React, { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

const toEmail = (username: string) => `${username.toLowerCase().trim()}@agent.local`

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const email = toEmail(username)

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: window.location.origin,
          data: { display_name: username.trim() },
        },
      })
      if (error) setError(error.message)
      else setMessage('Konto erstellt! Du wirst eingeloggt…')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError(error.message === 'Invalid login credentials'
          ? 'Benutzername oder Passwort falsch'
          : error.message)
      }
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at 50% 0%, #0d1a2f 0%, var(--bg) 70%)',
      padding: 16, position: 'relative', overflow: 'hidden',
    }}>
      {/* Subtle background glow */}
      <div style={{
        position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)',
        width: 600, height: 600, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <form onSubmit={handleSubmit} className="fade-in" style={{
        width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16,
        background: 'rgba(13, 18, 32, 0.9)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: 20, padding: '36px 28px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(59,130,246,0.05)',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{
            fontSize: 36, lineHeight: 1, marginBottom: 8,
            filter: 'drop-shadow(0 0 8px rgba(59,130,246,0.3))',
          }}>💬</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: 0, letterSpacing: '-0.03em' }}>
            Agent
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text2)', margin: '6px 0 0' }}>
            {isSignUp ? 'Konto erstellen' : 'Willkommen zurück'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text" required placeholder="Benutzername"
              autoComplete="username"
              value={username} onChange={e => setUsername(e.target.value)}
              pattern="[a-zA-Z0-9_]{3,30}"
              title="3–30 Zeichen, nur Buchstaben, Zahlen und Unterstriche"
              style={inputStyle}
            />
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type="password" required placeholder="Passwort" minLength={6}
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
              value={password} onChange={e => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {error && (
          <div style={{
            color: 'var(--red)', fontSize: 12, margin: 0,
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 10, padding: '8px 12px',
          }}>{error}</div>
        )}
        {message && (
          <div style={{
            color: 'var(--green)', fontSize: 12, margin: 0,
            background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)',
            borderRadius: 10, padding: '8px 12px',
          }}>{message}</div>
        )}

        <button type="submit" disabled={loading} style={{
          background: 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)',
          color: '#fff', border: 'none', borderRadius: 12,
          padding: '12px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          opacity: loading ? 0.6 : 1, fontFamily: 'inherit',
          boxShadow: '0 4px 16px rgba(59,130,246,0.3)',
          transition: 'opacity 0.2s, transform 0.15s, box-shadow 0.2s',
          transform: loading ? 'scale(0.98)' : 'scale(1)',
        }}>
          {loading ? '...' : isSignUp ? 'Registrieren' : 'Anmelden'}
        </button>

        <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null) }} style={{
          background: 'none', border: 'none', color: 'var(--text2)',
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
          padding: '4px 0', transition: 'color 0.2s',
        }}>
          {isSignUp ? 'Bereits ein Konto? Anmelden' : 'Noch kein Konto? Registrieren'}
        </button>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'rgba(17, 24, 39, 0.8)', border: '1px solid var(--border)', borderRadius: 12,
  padding: '12px 14px', fontSize: 14, color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit', width: '100%',
  transition: 'border-color 0.2s, box-shadow 0.2s',
}
