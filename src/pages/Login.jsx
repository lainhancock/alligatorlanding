import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [mode, setMode] = useState('login') // login | signup | reset
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setLoading(false)
  }

  async function handleSignUp(e) {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin }
    })
    if (error) setError(error.message)
    else setMessage('Account created! You can now sign in.')
    setLoading(false)
    if (!error) setMode('login')
  }

  async function handleReset(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/reset'
    })
    if (error) setError(error.message)
    else setMessage('Password reset email sent — check your inbox.')
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', padding: '13px 14px',
    borderRadius: 10, border: '0.5px solid #ddd',
    fontSize: 16, fontFamily: 'inherit',
    background: '#fff', color: '#1a1a1a',
    WebkitAppearance: 'none', marginBottom: 10
  }

  const btnStyle = (disabled) => ({
    width: '100%', padding: 14,
    background: disabled ? '#ccc' : '#1A4F8A',
    color: '#fff', border: 'none', borderRadius: 10,
    fontSize: 16, fontWeight: 600,
    cursor: disabled ? 'default' : 'pointer',
    fontFamily: 'inherit', marginBottom: 12
  })

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', background: '#F0EEE8',
      maxWidth: 430, margin: '0 auto'
    }}>
      {/* Logo */}
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: '#1A4F8A', display: 'flex',
        alignItems: 'center', justifyContent: 'center', marginBottom: 20
      }}>
        <span style={{color: '#fff', fontSize: 28, fontWeight: 700}}>AL</span>
      </div>
      <h1 style={{fontSize: 24, fontWeight: 700, color: '#1a1a1a', marginBottom: 6}}>
        Alligator Landing
      </h1>
      <p style={{fontSize: 14, color: '#666', marginBottom: 32, textAlign: 'center'}}>
        Property Management System
      </p>

      {/* Tab row */}
      <div style={{display:'flex',gap:1,background:'#ddd',borderRadius:10,padding:3,marginBottom:24,width:'100%',maxWidth:360}}>
        {[['login','Sign in'],['signup','Create account']].map(([k,l]) => (
          <button key={k} onClick={() => { setMode(k); setError(''); setMessage('') }} style={{
            flex:1, padding:'9px 4px', border:'none', borderRadius:8,
            background: mode===k ? '#fff' : 'none',
            color: mode===k ? '#1a1a1a' : '#666',
            fontWeight: mode===k ? 600 : 400,
            cursor:'pointer', fontFamily:'inherit', fontSize:13,
            boxShadow: mode===k ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
          }}>{l}</button>
        ))}
      </div>

      <div style={{width:'100%',maxWidth:360}}>

        {/* SIGN IN */}
        {mode === 'login' && (
          <form onSubmit={handleLogin}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="Email address" required style={inputStyle}/>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="Password" required style={inputStyle}/>
            {error && <p style={{color:'#A32D2D',fontSize:13,marginBottom:10}}>{error}</p>}
            {message && <p style={{color:'#3B6D11',fontSize:13,marginBottom:10}}>{message}</p>}
            <button type="submit" disabled={loading||!email||!password} style={btnStyle(loading||!email||!password)}>
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
            <button type="button" onClick={() => { setMode('reset'); setError(''); setMessage('') }}
              style={{width:'100%',background:'none',border:'none',color:'#1A4F8A',fontSize:13,cursor:'pointer',textDecoration:'underline',fontFamily:'inherit'}}>
              Forgot password?
            </button>
          </form>
        )}

        {/* CREATE ACCOUNT */}
        {mode === 'signup' && (
          <form onSubmit={handleSignUp}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="Email address" required style={inputStyle}/>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)}
              placeholder="Password (min 8 characters)" required style={inputStyle}/>
            <input type="password" value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)}
              placeholder="Confirm password" required style={inputStyle}/>
            {error && <p style={{color:'#A32D2D',fontSize:13,marginBottom:10}}>{error}</p>}
            {message && <p style={{color:'#3B6D11',fontSize:13,marginBottom:10}}>{message}</p>}
            <button type="submit" disabled={loading||!email||!password||!confirmPassword} style={btnStyle(loading||!email||!password||!confirmPassword)}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
            <p style={{fontSize:12,color:'#888',textAlign:'center'}}>
              Your account will be reviewed by Lain or Clare before full access is granted.
            </p>
          </form>
        )}

        {/* RESET PASSWORD */}
        {mode === 'reset' && (
          <form onSubmit={handleReset}>
            <p style={{fontSize:13,color:'#666',marginBottom:14,textAlign:'center'}}>
              Enter your email and we'll send you a link to reset your password.
            </p>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)}
              placeholder="Email address" required style={inputStyle}/>
            {error && <p style={{color:'#A32D2D',fontSize:13,marginBottom:10}}>{error}</p>}
            {message && (
              <div style={{background:'#EAF3DE',borderRadius:10,padding:'14px 16px',marginBottom:14,textAlign:'center'}}>
                <p style={{fontSize:14,color:'#3B6D11'}}>📬 {message}</p>
              </div>
            )}
            <button type="submit" disabled={loading||!email} style={btnStyle(loading||!email)}>
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError(''); setMessage('') }}
              style={{width:'100%',background:'none',border:'none',color:'#1A4F8A',fontSize:13,cursor:'pointer',textDecoration:'underline',fontFamily:'inherit'}}>
              Back to sign in
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
