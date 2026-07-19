import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function ResetPassword({ onDone }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  async function handleReset(e) {
    e.preventDefault()
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    setDone(true)
    setLoading(false)
    setTimeout(() => onDone(), 2000)
  }

  const inputStyle = {
    width: '100%', padding: '13px 14px',
    borderRadius: 10, border: '0.5px solid #ddd',
    fontSize: 16, fontFamily: 'inherit',
    background: '#fff', color: '#1a1a1a',
    WebkitAppearance: 'none', marginBottom: 10
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      padding: '32px 24px', background: '#F0EEE8',
      maxWidth: 430, margin: '0 auto'
    }}>
      <div style={{
        width: 72, height: 72, borderRadius: 18,
        background: '#1A4F8A', display: 'flex',
        alignItems: 'center', justifyContent: 'center', marginBottom: 20
      }}>
        <span style={{color: '#fff', fontSize: 28, fontWeight: 700}}>AL</span>
      </div>
      <h1 style={{fontSize: 22, fontWeight: 700, color: '#1a1a1a', marginBottom: 6}}>
        Set new password
      </h1>
      <p style={{fontSize: 14, color: '#666', marginBottom: 32, textAlign: 'center'}}>
        Alligator Landing Property Manager
      </p>

      {done ? (
        <div style={{background:'#EAF3DE',borderRadius:12,padding:'20px 24px',textAlign:'center',maxWidth:360,width:'100%'}}>
          <div style={{fontSize:32,marginBottom:10}}>✅</div>
          <h2 style={{fontSize:17,fontWeight:600,color:'#3B6D11',marginBottom:6}}>Password updated!</h2>
          <p style={{fontSize:14,color:'#555'}}>Signing you in now…</p>
        </div>
      ) : (
        <form onSubmit={handleReset} style={{width:'100%',maxWidth:360}}>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="New password (min 8 characters)"
            required
            style={inputStyle}
          />
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Confirm new password"
            required
            style={inputStyle}
          />
          {error && <p style={{color:'#A32D2D',fontSize:13,marginBottom:10}}>{error}</p>}
          <button
            type="submit"
            disabled={loading || !password || !confirmPassword}
            style={{
              width:'100%', padding:14,
              background: loading||!password||!confirmPassword ? '#ccc' : '#1A4F8A',
              color:'#fff', border:'none', borderRadius:10,
              fontSize:16, fontWeight:600,
              cursor: loading||!password||!confirmPassword ? 'default' : 'pointer',
              fontFamily:'inherit'
            }}
          >
            {loading ? 'Updating…' : 'Set new password'}
          </button>
        </form>
      )}
    </div>
  )
}
