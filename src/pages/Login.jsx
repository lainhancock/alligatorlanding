import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: email.split('@')[0] }
      }
    })
    if (error) setError(error.message)
    else setSent(true)
    setLoading(false)
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      background: '#F0EEE8',
      maxWidth: 430,
      margin: '0 auto'
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: '#1A4F8A',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20
      }}>
        <span style={{color: '#fff', fontSize: 28, fontWeight: 700}}>AL</span>
      </div>
      <h1 style={{fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 6}}>
        Alligator Landing
      </h1>
      <p style={{fontSize: 14, color: '#666', marginBottom: 32, textAlign: 'center'}}>
        Property Management System
      </p>

      {!sent ? (
        <form onSubmit={handleLogin} style={{width: '100%', maxWidth: 360}}>
          <div style={{marginBottom: 12}}>
            <label style={{display: 'block', fontSize: 13, fontWeight: 500, color: '#444', marginBottom: 6}}>
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              style={{
                width: '100%', padding: '13px 14px',
                borderRadius: 10, border: '0.5px solid #ddd',
                fontSize: 16, fontFamily: 'inherit',
                background: '#fff', color: '#1a1a1a',
                WebkitAppearance: 'none'
              }}
            />
          </div>
          {error && (
            <p style={{color: '#A32D2D', fontSize: 13, marginBottom: 10}}>{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !email}
            style={{
              width: '100%', padding: 14,
              background: loading || !email ? '#ccc' : '#1A4F8A',
              color: '#fff', border: 'none', borderRadius: 10,
              fontSize: 16, fontWeight: 600, cursor: loading || !email ? 'default' : 'pointer',
              fontFamily: 'inherit'
            }}
          >
            {loading ? 'Sending…' : 'Send login link'}
          </button>
          <p style={{fontSize: 12, color: '#888', textAlign: 'center', marginTop: 14}}>
            We'll send a magic link to your email — no password needed.
          </p>
        </form>
      ) : (
        <div style={{
          background: '#EAF3DE', borderRadius: 12, padding: '20px 24px',
          textAlign: 'center', maxWidth: 360, width: '100%'
        }}>
          <div style={{fontSize: 32, marginBottom: 10}}>📬</div>
          <h2 style={{fontSize: 17, fontWeight: 600, color: '#3B6D11', marginBottom: 6}}>
            Check your email
          </h2>
          <p style={{fontSize: 14, color: '#555', lineHeight: 1.5}}>
            We sent a login link to <strong>{email}</strong>. Tap the link in your email to sign in.
          </p>
          <button
            onClick={() => setSent(false)}
            style={{
              marginTop: 16, background: 'none', border: 'none',
              color: '#1A4F8A', fontSize: 13, cursor: 'pointer', textDecoration: 'underline'
            }}
          >
            Use a different email
          </button>
        </div>
      )}
    </div>
  )
}
