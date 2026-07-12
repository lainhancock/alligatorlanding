import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Today from './pages/Today'
import Week from './pages/Week'
import Events from './pages/Events'
import Hunting from './pages/Hunting'
import Tracker from './pages/Tracker'
import Admin from './pages/Admin'
import Layout from './components/layout/Layout'
import './index.css'

export default function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100vh',flexDirection:'column',gap:16}}>
      <div style={{width:48,height:48,borderRadius:'50%',background:'#1A4F8A',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:20,fontWeight:700}}>AL</div>
      <p style={{color:'#666',fontSize:14}}>Loading Alligator Landing…</p>
    </div>
  )

  if (!session) return <Login />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout session={session} />}>
          <Route index element={<Navigate to="/today" replace />} />
          <Route path="today" element={<Today session={session} />} />
          <Route path="week" element={<Week session={session} />} />
          <Route path="events" element={<Events session={session} />} />
          <Route path="tracker" element={<Tracker session={session} />} />
          <Route path="hunting" element={<Hunting session={session} />} />
          <Route path="admin" element={<Admin session={session} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
