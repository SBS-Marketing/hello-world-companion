import { useState } from 'react'
import { supabase } from '@/integrations/supabase/client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
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

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      })
      if (error) setError(error.message)
      else setMessage('Bestätigungsmail wurde gesendet. Bitte überprüfe dein Postfach.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 16,
    }}>
      <form onSubmit={handleSubmit} style={{
        width: '100%', maxWidth: 380, display: 'flex', flexDirection: 'column', gap: 14,
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 28,
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', textAlign: 'center', margin: 0 }}>
          💬 Agent
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', margin: 0 }}>
          {isSignUp ? 'Konto erstellen' : 'Anmelden'}
        </p>

        <input
          type="email" required placeholder="E-Mail"
          value={email} onChange={e => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          type="password" required placeholder="Passwort" minLength={6}
          value={password} onChange={e => setPassword(e.target.value)}
          style={inputStyle}
        />

        {error && <p style={{ color: 'var(--red)', fontSize: 12, margin: 0 }}>{error}</p>}
        {message && <p style={{ color: 'var(--green)', fontSize: 12, margin: 0 }}>{message}</p>}

        <button type="submit" disabled={loading} style={{
          background: 'var(--blue)', color: '#fff', border: 'none', borderRadius: 8,
          padding: '10px 0', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          opacity: loading ? 0.6 : 1, fontFamily: 'inherit',
        }}>
          {loading ? '...' : isSignUp ? 'Registrieren' : 'Anmelden'}
        </button>

        <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); setMessage(null) }} style={{
          background: 'none', border: 'none', color: 'var(--text2)',
          fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
        }}>
          {isSignUp ? 'Bereits ein Konto? Anmelden' : 'Noch kein Konto? Registrieren'}
        </button>
      </form>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8,
  padding: '10px 12px', fontSize: 14, color: 'var(--text)',
  outline: 'none', fontFamily: 'inherit',
}
