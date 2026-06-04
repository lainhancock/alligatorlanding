import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export default function Admin({ session }) {
  const [tab, setTab] = useState('overview')
  const [profile, setProfile] = useState(null)
  const [users, setUsers] = useState([])
  const [tasks, setTasks] = useState([])
  const [assets, setAssets] = useState([])
  const [categories, setCategories] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: p }, { data: u }, { data: t }, { data: a }, { data: c }, { data: al }, { data: eq }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('profiles').select('*').eq('active', true).order('full_name'),
      supabase.from('tasks').select('*, category:categories(*), asset:assets(*)').eq('active', true).order('title'),
      supabase.from('assets').select('*').eq('active', true).order('name'),
      supabase.from('categories').select('*').eq('active', true).order('sort_order'),
      supabase.from('audit_log').select('*, actor:profiles!audit_log_actor_id_fkey(full_name)').order('created_at', {ascending:false}).limit(20),
      supabase.from('equipment_service').select('*, asset:assets(name), assigned:profiles!equipment_service_assigned_to_fkey(full_name)').order('created_at', {ascending:false}).limit(10)
    ])
    if (p) setProfile(p)
    if (u) setUsers(u)
    if (t) setTasks(t)
    if (a) setAssets(a)
    if (c) setCategories(c)
    if (al) setAuditLog(al)
    if (eq) setEquipment(eq)
    setLoading(false)
  }

  const isOwnerAdmin = profile?.role === 'owner' || profile?.role === 'admin'

  return (
    <div>
      <div className="topbar">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
          <div><h1>Admin</h1><p>{profile?.full_name} · {profile?.role}</p></div>
          <button onClick={async () => { await supabase.auth.signOut() }} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',padding:'6px 12px',borderRadius:6,fontSize:12,cursor:'pointer'}}>
            Sign out
          </button>
        </div>
      </div>
      <div className="content">
        <div className="tab-row">
          {['overview','tasks','users','service','audit'].map(t => (
            <button key={t} className={`tab-btn${tab===t?' active':''}`} onClick={() => setTab(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'overview' && (
          <>
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-num">{tasks.length}</div><div className="stat-lbl">Tasks configured</div></div>
              <div className="stat-card"><div className="stat-num">{users.length}</div><div className="stat-lbl">Active users</div></div>
              <div className="stat-card"><div className="stat-num">{assets.length}</div><div className="stat-lbl">Assets</div></div>
              <div className="stat-card"><div className="stat-num">{categories.length}</div><div className="stat-lbl">Categories</div></div>
            </div>
            <div className="section-label">Categories</div>
            {categories.map(c => {
              const catTasks = tasks.filter(t => t.category_id === c.id)
              return (
                <div key={c.id} style={{marginBottom:10}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:13,fontWeight:500}}>{c.name}</span>
                    <span style={{fontSize:11,color:'#888'}}>{catTasks.length} tasks</span>
                  </div>
                  <div className="prog-bar">
                    <div className="prog-fill" style={{width:`${Math.min(100,(catTasks.length/10)*100)}%`,background:'#1A4F8A'}}/>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {tab === 'tasks' && (
          <>
            {isOwnerAdmin && (
              <button className="btn btn-primary" style={{marginBottom:12}}>+ Add new task</button>
            )}
            {loading ? <p style={{color:'#888',fontSize:13}}>Loading…</p> : tasks.map(t => (
              <div key={t.id} className="card" style={{marginBottom:7}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500}}>{t.title}</div>
                    <div style={{fontSize:11,color:'#888',marginTop:2}}>{t.category?.name} · {t.asset?.name || '—'} · {t.frequency}</div>
                  </div>
                  <span style={{background:'#f0f0f0',color:'#666',fontSize:10,padding:'2px 7px',borderRadius:10}}>
                    {t.priority}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'users' && (
          <>
            {isOwnerAdmin && (
              <button className="btn btn-primary" style={{marginBottom:12}}>+ Invite user</button>
            )}
            {users.map(u => (
              <div key={u.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:'0.5px solid #f0f0f0'}}>
                <div className="avatar" style={{width:34,height:34,fontSize:12,background:'#E6F1FB',color:'#0C447C'}}>
                  {u.avatar_initials || u.full_name?.charAt(0)}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500}}>{u.full_name}</div>
                  <div style={{fontSize:11,color:'#888'}}>{u.role}</div>
                </div>
                <span style={{background:'#E6F1FB',color:'#185FA5',fontSize:10,padding:'3px 8px',borderRadius:20}}>
                  {u.role}
                </span>
              </div>
            ))}
          </>
        )}

        {tab === 'service' && (
          <>
            <button className="btn btn-primary" style={{marginBottom:12}}>+ Flag equipment for service</button>
            {equipment.length === 0 ? (
              <div style={{textAlign:'center',padding:'32px 0',color:'#888',fontSize:13}}>No service records yet</div>
            ) : equipment.map(e => (
              <div key={e.id} className="card" style={{marginBottom:7}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500}}>{e.asset?.name || '—'}</div>
                    <div style={{fontSize:11,color:'#888',marginTop:2}}>{e.service_description || 'Service needed'} · {e.assigned?.full_name || 'Unassigned'}</div>
                  </div>
                  <span className={`badge ${e.completed ? 'badge-done' : 'badge-warn'}`}>
                    {e.completed ? 'Complete' : 'Pending'}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'audit' && (
          <>
            <div className="section-label">Recent activity</div>
            {auditLog.map(a => (
              <div key={a.id} style={{display:'flex',alignItems:'flex-start',gap:9,padding:'9px 0',borderBottom:'0.5px solid #f0f0f0'}}>
                <div className="avatar" style={{width:28,height:28,fontSize:10,background:'#E6F1FB',color:'#0C447C',marginTop:1}}>
                  {a.actor?.full_name?.charAt(0) || '?'}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:12,fontWeight:500}}>{a.actor?.full_name || 'Unknown'}</div>
                  <div style={{fontSize:11,color:'#888'}}>{a.action} · {a.entity_type}</div>
                  <div style={{fontSize:10,color:'#aaa',marginTop:2}}>{format(new Date(a.created_at), 'MMM d · h:mm a')}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
