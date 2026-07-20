import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

const CATEGORIES_LIST = [
  'Grounds & Landscaping','Structures & Facilities','Equipment & Vehicles',
  'Wildlife & Hunting','Mechanical Systems','Pest Control',
  'Security & Surveillance','Fuel & Utilities','Firearms & Range',
  'Safety & Emergency','Seasonal Projects'
]
const ASSETS_LIST = [
  '— select —','Main house','Lake house','OG Tiny House','Tiny House 2',
  'Hangar','Shop','RO Shed','Equipment Shed','Reservoir Well Shed',
  'Ranger EV','Ranger Work UTV','Honda 2-seater','Honda 6-seater',
  'Can-Am','Toyota Tundra','Large John Deere','Small John Deere','Cat Skid Steer',
  'Toy Hauler','RV',"Jake's RV",
  'Two-man Kayak','Pond Prowler','Twin Troller',
  'Main house/Lake house landscaping','Tiny house landscaping',
  'Hangar/Shop landscaping','Pastures','Roads','Ponds',
  'High fence — full perimeter','Rifle range','Property'
]
const CREW_LIST = ['Unassigned','Lain','Clare','Juan','Lane','Scott','Jacob','Trace','Garrett','Delaney','Jake']
const FREQUENCIES = [
  { value:'daily', label:'Daily' },
  { value:'weekly', label:'Weekly' },
  { value:'biweekly', label:'Bi-weekly' },
  { value:'monthly', label:'Monthly' },
  { value:'seasonal', label:'Seasonal' },
  { value:'as_needed', label:'As needed' },
  { value:'one_time', label:'One time' },
]
const PRIORITIES = [
  { value:'normal', label:'Normal', color:'#555', bg:'#F1EFE8' },
  { value:'high', label:'High', color:'#854F0B', bg:'#FAEEDA' },
  { value:'critical', label:'Critical', color:'#A32D2D', bg:'#FCEBEB' },
]

export default function Admin({ session }) {
  const [tab, setTab] = useState('overview')
  const [profile, setProfile] = useState(null)
  const [users, setUsers] = useState([])
  const [tasks, setTasks] = useState([])
  const [categories, setCategories] = useState([])
  const [auditLog, setAuditLog] = useState([])
  const [equipment, setEquipment] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list') // list | new-task | task-detail
  const [selectedTask, setSelectedTask] = useState(null)
  const [taskFilter, setTaskFilter] = useState('all')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('caretaker')
  const [inviting, setInviting] = useState(false)
  const [inviteSent, setInviteSent] = useState(false)

  const [taskForm, setTaskForm] = useState({
    title: '',
    category: CATEGORIES_LIST[0],
    asset: '— select —',
    frequency: 'weekly',
    frequency_day: '',
    assigned_to_name: 'Unassigned',
    photo_required: false,
    priority: 'normal',
    instructions: '',
  })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: p }, { data: u }, { data: t }, { data: c }, { data: al }, { data: eq }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('profiles').select('*').eq('active', true).order('full_name'),
      supabase.from('tasks').select('*, category:categories(*), asset:assets(*)').eq('active', true).order('title'),
      supabase.from('categories').select('*').eq('active', true).order('sort_order'),
      supabase.from('audit_log').select('*, actor:profiles!audit_log_actor_id_fkey(full_name)').order('created_at', { ascending: false }).limit(20),
      supabase.from('equipment_service').select('*, asset:assets(name), assigned:profiles!equipment_service_assigned_to_fkey(full_name)').order('created_at', { ascending: false }).limit(10)
    ])
    if (p) setProfile(p)
    if (u) setUsers(u)
    if (t) setTasks(t)
    if (c) setCategories(c)
    if (al) setAuditLog(al)
    if (eq) setEquipment(eq)
    setLoading(false)
  }

  async function saveTask() {
    if (!taskForm.title.trim()) return

    // Find or get category id
    const { data: catData } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', taskForm.category)
      .single()

    // Find or get asset id
    let assetId = null
    if (taskForm.asset && taskForm.asset !== '— select —') {
      const { data: assetData } = await supabase
        .from('assets')
        .select('id')
        .ilike('name', taskForm.asset)
        .single()
      if (assetData) assetId = assetData.id
    }

    const { error } = await supabase.from('tasks').insert({
      title: taskForm.title,
      category_id: catData?.id || null,
      asset_id: assetId,
      frequency: taskForm.frequency,
      frequency_day: taskForm.frequency_day || null,
      photo_required: taskForm.photo_required,
      priority: taskForm.priority,
      instructions: taskForm.instructions,
      active: true,
      created_by: session.user.id
    })

    if (error) { alert('Error saving task: ' + error.message); return }

    await supabase.from('audit_log').insert({
      actor_id: session.user.id,
      action: 'task_created',
      entity_type: 'task',
      diff_json: { title: taskForm.title }
    })

    setTaskForm({
      title: '', category: CATEGORIES_LIST[0], asset: '— select —',
      frequency: 'weekly', frequency_day: '', assigned_to_name: 'Unassigned',
      photo_required: false, priority: 'normal', instructions: ''
    })
    setView('list')
    loadAll()
  }

  async function toggleTaskActive(id, active) {
    await supabase.from('tasks').update({ active: !active }).eq('id', id)
    loadAll()
  }

  async function softDeleteTask(id, title) {
    await supabase.from('tasks').update({ deleted_at: new Date().toISOString(), active: false }).eq('id', id)
    await supabase.from('deleted_items_log').insert({ entity_type: 'task', entity_id: id, entity_title: title, deleted_by: session.user.id })
    setView('list')
    loadAll()
  }

  async function permanentDeleteTask(id) {
    await supabase.from('tasks').delete().eq('id', id)
    setView('list')
    loadAll()
  }

  async function inviteUser() {
    if (!inviteEmail.trim()) return
    setInviting(true)
    const { error } = await supabase.auth.admin.inviteUserByEmail(inviteEmail, {
      data: { role: inviteRole }
    })
    if (error) {
      // Fallback — send magic link
      await supabase.auth.signInWithOtp({
        email: inviteEmail,
        options: {
          emailRedirectTo: window.location.origin,
          data: { role: inviteRole }
        }
      })
    }
    setInviteSent(true)
    setInviteEmail('')
    setInviting(false)
    setTimeout(() => setInviteSent(false), 4000)
  }

  const isOwnerAdmin = profile?.role === 'owner' || profile?.role === 'admin'
  const isOwner = profile?.role === 'owner'
  const filteredTasks = taskFilter === 'all' ? tasks : tasks.filter(t => t.category?.name === taskFilter)

  // ── NEW TASK FORM ──────────────────────────────────────────
  if (view === 'new-task') return (
    <div>
      <div className="topbar">
        <button onClick={() => setView('list')} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
        <h1>New task</h1>
        <p>Alligator Landing</p>
      </div>
      <div className="content">
        <div className="form-group">
          <label className="form-label">Task title</label>
          <input className="form-input" value={taskForm.title} onChange={e=>setTaskForm({...taskForm,title:e.target.value})} placeholder="e.g. Mow main house lawn"/>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Category</label>
            <select className="form-input" value={taskForm.category} onChange={e=>setTaskForm({...taskForm,category:e.target.value})}>
              {CATEGORIES_LIST.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Asset</label>
            <select className="form-input" value={taskForm.asset} onChange={e=>setTaskForm({...taskForm,asset:e.target.value})}>
              {ASSETS_LIST.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Frequency</label>
            <select className="form-input" value={taskForm.frequency} onChange={e=>setTaskForm({...taskForm,frequency:e.target.value})}>
              {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Assign to</label>
            <select className="form-input" value={taskForm.assigned_to_name} onChange={e=>setTaskForm({...taskForm,assigned_to_name:e.target.value})}>
              {CREW_LIST.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
        </div>

        {taskForm.frequency === 'weekly' && (
          <div className="form-group">
            <label className="form-label">Day of week</label>
            <select className="form-input" value={taskForm.frequency_day} onChange={e=>setTaskForm({...taskForm,frequency_day:e.target.value})}>
              <option value="">Any day</option>
              {['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => <option key={d} value={d.toLowerCase()}>{d}</option>)}
            </select>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Priority</label>
          <div style={{display:'flex',gap:5}}>
            {PRIORITIES.map(p => (
              <button key={p.value} onClick={() => setTaskForm({...taskForm,priority:p.value})} style={{
                flex:1, padding:'8px 4px', borderRadius:6,
                border:`${taskForm.priority===p.value?'1.5px':'0.5px'} solid ${taskForm.priority===p.value?p.color:'#ddd'}`,
                background:taskForm.priority===p.value?p.bg:'none',
                color:taskForm.priority===p.value?p.color:'#666',
                fontSize:11, cursor:'pointer', fontFamily:'inherit',
                fontWeight:taskForm.priority===p.value?600:400
              }}>{p.label}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Photo required for sign-off?</label>
          <div style={{display:'flex',gap:8}}>
            {[true,false].map(v => (
              <button key={String(v)} onClick={() => setTaskForm({...taskForm,photo_required:v})} style={{
                flex:1, padding:9, borderRadius:8, fontFamily:'inherit', cursor:'pointer', fontSize:12,
                border:`${taskForm.photo_required===v?'1.5px':'0.5px'} solid ${taskForm.photo_required===v?'#3B6D11':'#ddd'}`,
                background:taskForm.photo_required===v?'#EAF3DE':'none',
                color:taskForm.photo_required===v?'#3B6D11':'#666',
                fontWeight:taskForm.photo_required===v?600:400
              }}>{v ? 'Yes — required' : 'No'}</button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Instructions for crew</label>
          <textarea className="form-input" rows={4} value={taskForm.instructions} onChange={e=>setTaskForm({...taskForm,instructions:e.target.value})} placeholder="Detailed instructions, what to check, where to find supplies…" style={{resize:'none'}}/>
        </div>

        <button className="btn btn-primary" onClick={saveTask} disabled={!taskForm.title.trim()}>Create task</button>
        <button className="btn btn-secondary" onClick={() => setView('list')}>Cancel</button>
      </div>
    </div>
  )

  // ── TASK DETAIL ────────────────────────────────────────────
  if (view === 'task-detail' && selectedTask) return (
    <div>
      <div className="topbar">
        <button onClick={() => setView('list')} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
        <h1>{selectedTask.title}</h1>
        <p>{selectedTask.category?.name} · {selectedTask.asset?.name || '—'}</p>
      </div>
      <div className="content">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Frequency</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selectedTask.frequency}</div></div>
          <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Priority</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selectedTask.priority}</div></div>
          <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Photo required</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selectedTask.photo_required?'Yes':'No'}</div></div>
          <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Status</div><div style={{fontSize:12,fontWeight:500,marginTop:2,color:selectedTask.active?'#3B6D11':'#888'}}>{selectedTask.active?'Active':'Inactive'}</div></div>
        </div>
        {selectedTask.instructions && (
          <div style={{background:'#f8f8f8',borderRadius:8,padding:12,marginBottom:12}}>
            <p style={{fontSize:11,fontWeight:500,color:'#555',marginBottom:4}}>Instructions</p>
            <p style={{fontSize:13,color:'#333',lineHeight:1.55}}>{selectedTask.instructions}</p>
          </div>
        )}
        {isOwnerAdmin && (
          <div style={{display:'flex',gap:8,marginBottom:7}}>
            <button className="btn" style={{background:selectedTask.active?'#FCEBEB':'#EAF3DE',color:selectedTask.active?'#A32D2D':'#3B6D11',marginBottom:0,flex:1}}
              onClick={() => { toggleTaskActive(selectedTask.id, selectedTask.active); setView('list') }}>
              {selectedTask.active ? 'Deactivate' : 'Reactivate'}
            </button>
            <button className="btn" style={{background:'#FAEEDA',color:'#854F0B',marginBottom:0,flex:1}}
              onClick={() => { if(window.confirm('Archive this task?')) softDeleteTask(selectedTask.id, selectedTask.title) }}>
              📦 Archive
            </button>
            {isOwner && (
              <button className="btn" style={{background:'#FCEBEB',color:'#A32D2D',marginBottom:0,flex:1}}
                onClick={() => { if(window.confirm('Permanently delete? This cannot be undone.')) permanentDeleteTask(selectedTask.id) }}>
                🗑 Delete
              </button>
            )}
          </div>
        )}
        <button className="btn btn-secondary" onClick={() => setView('list')}>Back to tasks</button>
      </div>
    </div>
  )

  // ── MAIN ADMIN VIEW ────────────────────────────────────────
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
          {[['overview','Overview'],['tasks','Tasks'],['users','Users'],['service','Service'],['audit','Audit']].map(([k,l]) => (
            <button key={k} className={`tab-btn${tab===k?' active':''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {/* ── OVERVIEW ── */}
        {tab === 'overview' && (
          <>
            <div className="stat-grid">
              <div className="stat-card"><div className="stat-num">{tasks.length}</div><div className="stat-lbl">Tasks configured</div></div>
              <div className="stat-card"><div className="stat-num">{users.length}</div><div className="stat-lbl">Active users</div></div>
              <div className="stat-card"><div className="stat-num">{categories.length}</div><div className="stat-lbl">Categories</div></div>
              <div className="stat-card"><div className="stat-num">{equipment.filter(e=>!e.completed).length}</div><div className="stat-lbl">Service pending</div></div>
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
                    <div className="prog-fill" style={{width:`${Math.min(100,(catTasks.length/20)*100)}%`,background:'#1A4F8A'}}/>
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── TASKS ── */}
        {tab === 'tasks' && (
          <>
            {isOwnerAdmin && (
              <button className="btn btn-primary" style={{marginBottom:12}} onClick={() => setView('new-task')}>
                + Add new task
              </button>
            )}
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
              <button className={`filter-pill${taskFilter==='all'?' active':''}`} onClick={() => setTaskFilter('all')}>All</button>
              {categories.map(c => (
                <button key={c.id} className={`filter-pill${taskFilter===c.name?' active':''}`} onClick={() => setTaskFilter(c.name)}>
                  {c.name.split(' ')[0]}
                </button>
              ))}
            </div>
            {loading ? <p style={{color:'#888',fontSize:13}}>Loading…</p>
            : filteredTasks.length === 0 ? (
              <div style={{textAlign:'center',padding:'32px 0'}}>
                <p style={{fontSize:28,marginBottom:8}}>📋</p>
                <p style={{fontSize:14,fontWeight:600,color:'#333',marginBottom:4}}>No tasks yet</p>
                <p style={{fontSize:12,color:'#888'}}>Add your first task above.</p>
              </div>
            ) : filteredTasks.map(t => (
              <div key={t.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:'11px 12px',marginBottom:7,cursor:'pointer',opacity:t.active?1:0.5}}
                onClick={() => { setSelectedTask(t); setView('task-detail') }}>
                <div style={{fontSize:13,fontWeight:500,marginBottom:4}}>{t.title}</div>
                <div style={{display:'flex',gap:6,flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:10,background:'#f0f0f0',color:'#555',padding:'2px 7px',borderRadius:20}}>{t.category?.name}</span>
                  {t.asset && <span style={{fontSize:10,color:'#888'}}>{t.asset.name}</span>}
                  <span style={{fontSize:10,color:'#888'}}>· {t.frequency}</span>
                  {t.photo_required && <span style={{fontSize:10,color:'#888'}}>· 📷</span>}
                </div>
              </div>
            ))}
          </>
        )}

        {/* ── USERS ── */}
        {tab === 'users' && (
          <>
            {isOwnerAdmin && (
              <div style={{background:'#f8f8f8',borderRadius:8,padding:12,marginBottom:12}}>
                <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>Invite crew member</div>
                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input className="form-input" type="email" value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)} placeholder="their@email.com"/>
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-input" value={inviteRole} onChange={e=>setInviteRole(e.target.value)}>
                    <option value="owner">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="caretaker">Caretaker</option>
                    <option value="contractor">Contractor</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                {inviteSent ? (
                  <div style={{background:'#EAF3DE',borderRadius:8,padding:10,fontSize:12,color:'#3B6D11'}}>
                    ✓ Invite sent to {inviteEmail}
                  </div>
                ) : (
                  <button className="btn btn-primary" style={{marginBottom:0}} onClick={inviteUser} disabled={inviting||!inviteEmail.trim()}>
                    {inviting ? 'Sending…' : 'Send invite'}
                  </button>
                )}
              </div>
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

        {/* ── SERVICE ── */}
        {tab === 'service' && (
          <ServiceTab session={session} equipment={equipment} onRefresh={loadAll} />
        )}

        {/* ── AUDIT ── */}
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
                  <div style={{fontSize:10,color:'#aaa',marginTop:2}}>{format(new Date(a.created_at),'MMM d · h:mm a')}</div>
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

const EQUIPMENT_LIST = [
  'Ranger EV','Ranger Work UTV','Honda 2-seater','Honda 6-seater',
  'Can-Am','Toyota Tundra','Large John Deere','Small John Deere',
  'Cat Skid Steer','Toy Hauler','RV',"Jake's RV",
  'Two-man Kayak','Pond Prowler','Twin Troller'
]

function ServiceTab({ session, equipment, onRefresh }) {
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [updates, setUpdates] = useState({}) // keyed by service id
  const [updateText, setUpdateText] = useState({})
  const [returnDate, setReturnDate] = useState({})
  const [form, setForm] = useState({
    asset: EQUIPMENT_LIST[0],
    service_description: '',
    assigned_to_name: 'Unassigned',
    estimated_return_date: ''
  })

  async function loadUpdates(serviceId) {
    const { data } = await supabase
      .from('equipment_service_updates')
      .select('*, created_profile:profiles!equipment_service_updates_created_by_fkey(full_name)')
      .eq('service_id', serviceId)
      .order('created_at', { ascending: false })
    if (data) setUpdates(prev => ({ ...prev, [serviceId]: data }))
  }

  async function toggleExpand(id) {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    await loadUpdates(id)
  }

  async function saveService() {
    if (!form.service_description.trim()) return
    setSaving(true)
    const { data: assetData } = await supabase
      .from('assets').select('id').ilike('name', form.asset).single()
    await supabase.from('equipment_service').insert({
      asset_id: assetData?.id || null,
      service_description: form.service_description,
      assigned_to_name: form.assigned_to_name,
      estimated_return_date: form.estimated_return_date || null,
      service_needed: true,
      completed: false,
      created_by: session.user.id
    })
    await supabase.from('audit_log').insert({
      actor_id: session.user.id,
      action: 'equipment_service_flagged',
      entity_type: 'equipment_service',
      diff_json: { asset: form.asset, description: form.service_description }
    })
    setForm({ asset: EQUIPMENT_LIST[0], service_description: '', assigned_to_name: 'Unassigned', estimated_return_date: '' })
    setSaving(false)
    setSaved(true)
    setShowForm(false)
    setTimeout(() => setSaved(false), 3000)
    onRefresh()
  }

  async function addUpdate(serviceId) {
    const text = updateText[serviceId]?.trim()
    if (!text) return
    await supabase.from('equipment_service_updates').insert({
      service_id: serviceId,
      update_text: text,
      created_by: session.user.id
    })
    setUpdateText(prev => ({ ...prev, [serviceId]: '' }))
    await loadUpdates(serviceId)
  }

  async function saveReturnDate(serviceId) {
    const date = returnDate[serviceId]
    if (!date) return
    await supabase.from('equipment_service').update({ estimated_return_date: date }).eq('id', serviceId)
    onRefresh()
  }

  async function markComplete(id) {
    await supabase.from('equipment_service').update({
      completed: true,
      completed_by: session.user.id,
      completed_at: new Date().toISOString()
    }).eq('id', id)
    setExpandedId(null)
    onRefresh()
  }

  const pending = equipment.filter(e => !e.completed)
  const done = equipment.filter(e => e.completed)

  return (
    <>
      {saved && (
        <div style={{background:'#EAF3DE',borderRadius:8,padding:10,marginBottom:10,fontSize:12,color:'#3B6D11'}}>
          ✓ Equipment flagged for service
        </div>
      )}

      <button className="btn btn-primary" style={{marginBottom:12}} onClick={() => setShowForm(!showForm)}>
        {showForm ? 'Cancel' : '+ Flag equipment for service'}
      </button>

      {showForm && (
        <div style={{background:'#f8f8f8',borderRadius:8,padding:12,marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:500,marginBottom:10}}>Flag equipment for service</div>
          <div className="form-group">
            <label className="form-label">Equipment</label>
            <select className="form-input" value={form.asset} onChange={e=>setForm({...form,asset:e.target.value})}>
              {EQUIPMENT_LIST.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Describe the issue</label>
            <textarea className="form-input" rows={3} value={form.service_description}
              onChange={e=>setForm({...form,service_description:e.target.value})}
              placeholder="e.g. Oil change overdue, making clicking sound when turning…"
              style={{resize:'none'}}/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label">Assign to</label>
              <select className="form-input" value={form.assigned_to_name} onChange={e=>setForm({...form,assigned_to_name:e.target.value})}>
                {['Unassigned','Lain','Clare','Juan','Lane','Scott','Jacob','Trace','Garrett','Delaney','Jake'].map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="form-group" style={{marginBottom:0}}>
              <label className="form-label">Est. return to service</label>
              <input className="form-input" type="date" value={form.estimated_return_date}
                onChange={e=>setForm({...form,estimated_return_date:e.target.value})}/>
            </div>
          </div>
          <button className="btn btn-primary" style={{marginBottom:0}} onClick={saveService} disabled={saving||!form.service_description.trim()}>
            {saving ? 'Saving…' : 'Flag for service'}
          </button>
        </div>
      )}

      {pending.length > 0 && (
        <>
          <div className="section-label">Needs service ({pending.length})</div>
          {pending.map(e => (
            <div key={e.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,marginBottom:8,overflow:'hidden'}}>
              {/* Header row */}
              <div style={{padding:'11px 12px',cursor:'pointer'}} onClick={() => toggleExpand(e.id)}>
                <div style={{display:'flex',alignItems:'flex-start',gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500,marginBottom:3}}>{e.asset?.name || '—'}</div>
                    <div style={{fontSize:12,color:'#555',marginBottom:4}}>{e.service_description}</div>
                    <div style={{display:'flex',gap:8,flexWrap:'wrap',fontSize:11,color:'#888'}}>
                      <span>👤 {e.assigned_to_name || 'Unassigned'}</span>
                      {e.estimated_return_date && (
                        <span>📅 Est. return: {new Date(e.estimated_return_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</span>
                      )}
                      <span>Flagged {e.created_at ? new Date(e.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'}) : ''}</span>
                    </div>
                  </div>
                  <div style={{display:'flex',flexDirection:'column',gap:5,alignItems:'flex-end',flexShrink:0}}>
                    <span className="badge badge-warn">Pending</span>
                    <span style={{fontSize:10,color:'#aaa'}}>{expandedId===e.id?'▲ Less':'▼ Details'}</span>
                  </div>
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === e.id && (
                <div style={{borderTop:'0.5px solid #f0f0f0',padding:'10px 12px',background:'#fafafa'}}>

                  {/* Update return date */}
                  <div style={{marginBottom:10}}>
                    <label className="form-label">Update estimated return date</label>
                    <div style={{display:'flex',gap:8}}>
                      <input className="form-input" type="date" style={{flex:1}}
                        value={returnDate[e.id] || e.estimated_return_date || ''}
                        onChange={ev => setReturnDate(prev => ({...prev,[e.id]:ev.target.value}))}/>
                      <button onClick={() => saveReturnDate(e.id)} style={{
                        padding:'9px 12px',borderRadius:8,border:'none',background:'#1A4F8A',
                        color:'#fff',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:500,flexShrink:0
                      }}>Save</button>
                    </div>
                  </div>

                  {/* Updates feed */}
                  <div style={{marginBottom:10}}>
                    <label className="form-label">Updates</label>
                    {(updates[e.id] || []).length === 0 ? (
                      <p style={{fontSize:12,color:'#aaa',padding:'6px 0'}}>No updates yet — add one below.</p>
                    ) : (
                      <div style={{marginBottom:8}}>
                        {(updates[e.id] || []).map(u => (
                          <div key={u.id} style={{padding:'7px 0',borderBottom:'0.5px solid #f0f0f0'}}>
                            <div style={{fontSize:12,color:'#333'}}>{u.update_text}</div>
                            <div style={{fontSize:10,color:'#aaa',marginTop:2}}>
                              {u.created_profile?.full_name || 'Unknown'} · {new Date(u.created_at).toLocaleDateString('en-US',{month:'short',day:'numeric'})} {new Date(u.created_at).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{display:'flex',gap:8}}>
                      <input className="form-input" style={{flex:1}}
                        value={updateText[e.id] || ''}
                        onChange={ev => setUpdateText(prev => ({...prev,[e.id]:ev.target.value}))}
                        placeholder="Add an update…"
                        onKeyDown={ev => ev.key==='Enter' && addUpdate(e.id)}/>
                      <button onClick={() => addUpdate(e.id)} style={{
                        padding:'9px 12px',borderRadius:8,border:'none',background:'#1A4F8A',
                        color:'#fff',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:500,flexShrink:0
                      }}>Post</button>
                    </div>
                  </div>

                  {/* Mark complete */}
                  <button onClick={() => markComplete(e.id)} className="btn btn-success" style={{marginBottom:0}}>
                    ✓ Mark service complete
                  </button>
                </div>
              )}
            </div>
          ))}
        </>
      )}

      {done.length > 0 && (
        <>
          <div className="section-label">Completed</div>
          {done.slice(0,5).map(e => (
            <div key={e.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:'11px 12px',marginBottom:7,opacity:0.6}}>
              <div style={{display:'flex',alignItems:'center',gap:8}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500,marginBottom:2}}>{e.asset?.name || '—'}</div>
                  <div style={{fontSize:11,color:'#888'}}>{e.service_description}</div>
                  {e.estimated_return_date && <div style={{fontSize:10,color:'#aaa',marginTop:2}}>Returned: {new Date(e.estimated_return_date).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})}</div>}
                </div>
                <span className="badge badge-done">Done</span>
              </div>
            </div>
          ))}
        </>
      )}

      {pending.length === 0 && done.length === 0 && (
        <div style={{textAlign:'center',padding:'32px 0'}}>
          <p style={{fontSize:28,marginBottom:8}}>🔧</p>
          <p style={{fontSize:14,fontWeight:600,color:'#333',marginBottom:4}}>No service records</p>
          <p style={{fontSize:12,color:'#888'}}>Flag equipment above when service is needed.</p>
        </div>
      )}
    </>
  )
}
