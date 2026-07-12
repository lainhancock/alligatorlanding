import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

const CATEGORIES = [
  'Structures & Facilities','Equipment & Vehicles','Grounds & Landscaping',
  'Mechanical Systems','Security & Surveillance','Pest Control',
  'Fuel & Utilities','Safety & Emergency','Wildlife & Hunting','Seasonal Projects'
]
const ASSETS = [
  '— select —','Main house','Lake house','OG Tiny House','Tiny House 2',
  'Hangar','Shop','RO Shed','Equipment Shed','Reservoir Well Shed',
  'Ranger EV','Ranger Work UTV','Honda 2-seater','Honda 6-seater',
  'Can-Am','Toyota Tundra','Large John Deere','Small John Deere','Cat Skid Steer',
  'Toy Hauler','RV',"Jake's RV",
  'Two-man Kayak','Pond Prowler','Twin Troller',
  'Pastures','Roads','Ponds','High fence','Rifle range','Property'
]
const CREW = ['Unassigned','Juan','Lane','Scott','Jacob','Trace','Garrett','Delaney','Jake']

const PRI_CONFIG = {
  low:  { label:'Low',      bg:'#F1EFE8', color:'#555',     bar:'#888'    },
  med:  { label:'Medium',   bg:'#E6F1FB', color:'#185FA5',  bar:'#378ADD' },
  high: { label:'High',     bg:'#FAEEDA', color:'#854F0B',  bar:'#EF9F27' },
  crit: { label:'Critical', bg:'#FCEBEB', color:'#A32D2D',  bar:'#E24B4A' },
}
const STATUS_CONFIG = {
  open:       { label:'Open',        bg:'#F1EFE8', color:'#555'    },
  inprogress: { label:'In progress', bg:'#E6F1FB', color:'#185FA5' },
  blocked:    { label:'Blocked',     bg:'#FAEEDA', color:'#854F0B' },
  done:       { label:'Complete',    bg:'#EAF3DE', color:'#3B6D11' },
}
const FLAG_CONFIG = {
  none:    { color:'#ccc',     label:'' },
  review:  { color:'#EF9F27', label:'Needs review' },
  urgent:  { color:'#E24B4A', label:'Urgent' },
}

export default function Tracker({ session }) {
  const [tab, setTab] = useState('wo')
  const [workOrders, setWorkOrders] = useState([])
  const [punch, setPunch] = useState([])
  const [notes, setNotes] = useState([])
  const [photos, setPhotos] = useState([])
  const [view, setView] = useState('list') // list | new-wo | wo-detail
  const [selectedWO, setSelectedWO] = useState(null)
  const [woFilter, setWoFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [newPunch, setNewPunch] = useState('')
  const [newNote, setNewNote] = useState({ text:'', asset:'General property', flag:'none' })
  const [woForm, setWoForm] = useState({
    title:'', description:'', category:CATEGORIES[0], asset:'— select —',
    priority:'med', assigned_to:'Unassigned', due_date:'',
    photo_required:false, approval_required:true
  })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: wo }, { data: p }, { data: n }] = await Promise.all([
      supabase.from('work_orders').select('*, assigned_profile:profiles!work_orders_assigned_to_fkey(full_name), created_profile:profiles!work_orders_created_by_fkey(full_name)').order('created_at', { ascending: false }),
      supabase.from('punch_list_items').select('*').order('created_at', { ascending: false }),
      supabase.from('property_notes').select('*, created_profile:profiles!property_notes_created_by_fkey(full_name)').order('created_at', { ascending: false }),
    ])
    if (wo) setWorkOrders(wo)
    if (p) setPunch(p)
    if (n) setNotes(n)
    setLoading(false)
  }

  async function saveWorkOrder() {
    if (!woForm.title.trim()) return
    const { error } = await supabase.from('work_orders').insert({
      title: woForm.title,
      description: woForm.description,
      category: woForm.category,
      asset: woForm.asset === '— select —' ? null : woForm.asset,
      priority: woForm.priority,
      assigned_to_name: woForm.assigned_to,
      due_date: woForm.due_date || null,
      photo_required: woForm.photo_required,
      approval_required: woForm.approval_required,
      status: 'open',
      created_by: session.user.id
    })
    if (error) { alert('Error: ' + error.message); return }
    await supabase.from('audit_log').insert({ actor_id: session.user.id, action: 'work_order_created', entity_type: 'work_order', diff_json: { title: woForm.title } })
    setWoForm({ title:'', description:'', category:CATEGORIES[0], asset:'— select —', priority:'med', assigned_to:'Unassigned', due_date:'', photo_required:false, approval_required:true })
    setView('list')
    loadAll()
  }

  async function updateWOStatus(id, status) {
    await supabase.from('work_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('audit_log').insert({ actor_id: session.user.id, action: 'work_order_status_updated', entity_type: 'work_order', diff_json: { status } })
    loadAll()
    setView('list')
  }

  async function addPunchItem() {
    if (!newPunch.trim()) return
    await supabase.from('punch_list_items').insert({ text: newPunch.trim(), done: false, created_by: session.user.id })
    setNewPunch('')
    loadAll()
  }

  async function togglePunch(id, done) {
    await supabase.from('punch_list_items').update({ done: !done }).eq('id', id)
    loadAll()
  }

  async function addNote() {
    if (!newNote.text.trim()) return
    await supabase.from('property_notes').insert({ text: newNote.text.trim(), asset: newNote.asset, flag: newNote.flag, created_by: session.user.id })
    setNewNote({ text:'', asset:'General property', flag:'none' })
    loadAll()
  }

  const filteredWOs = workOrders.filter(w => woFilter === 'all' || w.status === woFilter)
  const donePunch = punch.filter(p => p.done).length
  const openCrit = workOrders.filter(w => w.priority === 'crit' && w.status !== 'done').length
  const inProgress = workOrders.filter(w => w.status === 'inprogress').length
  const complete = workOrders.filter(w => w.status === 'done').length

  // ── NEW WORK ORDER FORM ────────────────────────────────────
  if (view === 'new-wo') return (
    <div>
      <div className="topbar">
        <button onClick={() => setView('list')} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
        <h1>New work order</h1>
        <p>Alligator Landing</p>
      </div>
      <div className="content">
        <div className="form-group">
          <label className="form-label">Title</label>
          <input className="form-input" value={woForm.title} onChange={e=>setWoForm({...woForm,title:e.target.value})} placeholder="e.g. Fix dock board — lake house"/>
        </div>
        <div className="form-group">
          <label className="form-label">Description</label>
          <textarea className="form-input" rows={3} value={woForm.description} onChange={e=>setWoForm({...woForm,description:e.target.value})} placeholder="Details, location, what needs to be done…" style={{resize:'none'}}/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Category</label>
            <select className="form-input" value={woForm.category} onChange={e=>setWoForm({...woForm,category:e.target.value})}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Asset</label>
            <select className="form-input" value={woForm.asset} onChange={e=>setWoForm({...woForm,asset:e.target.value})}>
              {ASSETS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Priority</label>
          <div style={{display:'flex',gap:5}}>
            {Object.entries(PRI_CONFIG).map(([k,v]) => (
              <button key={k} onClick={() => setWoForm({...woForm,priority:k})} style={{
                flex:1,padding:'8px 4px',borderRadius:6,border:`${woForm.priority===k?'1.5px':'0.5px'} solid ${woForm.priority===k?v.color:'#ddd'}`,
                background:woForm.priority===k?v.bg:'none',color:woForm.priority===k?v.color:'#666',
                fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:woForm.priority===k?600:400
              }}>{v.label}</button>
            ))}
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Assign to</label>
            <select className="form-input" value={woForm.assigned_to} onChange={e=>setWoForm({...woForm,assigned_to:e.target.value})}>
              {CREW.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Due date</label>
            <input className="form-input" type="date" value={woForm.due_date} onChange={e=>setWoForm({...woForm,due_date:e.target.value})}/>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Photo required for sign-off?</label>
          <div style={{display:'flex',gap:8}}>
            {[true,false].map(v => (
              <button key={String(v)} onClick={() => setWoForm({...woForm,photo_required:v})} style={{
                flex:1,padding:9,borderRadius:8,fontFamily:'inherit',cursor:'pointer',fontSize:12,
                border:`${woForm.photo_required===v?'1.5px':'0.5px'} solid ${woForm.photo_required===v?'#3B6D11':'#ddd'}`,
                background:woForm.photo_required===v?'#EAF3DE':'none',
                color:woForm.photo_required===v?'#3B6D11':'#666',
                fontWeight:woForm.photo_required===v?600:400
              }}>{v ? 'Yes — required' : 'No'}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Needs Lain/Clare approval to close?</label>
          <div style={{display:'flex',gap:8}}>
            {[true,false].map(v => (
              <button key={String(v)} onClick={() => setWoForm({...woForm,approval_required:v})} style={{
                flex:1,padding:9,borderRadius:8,fontFamily:'inherit',cursor:'pointer',fontSize:12,
                border:`${woForm.approval_required===v?'1.5px':'0.5px'} solid ${woForm.approval_required===v?'#1A4F8A':'#ddd'}`,
                background:woForm.approval_required===v?'#E6F1FB':'none',
                color:woForm.approval_required===v?'#0C447C':'#666',
                fontWeight:woForm.approval_required===v?600:400
              }}>{v ? 'Yes' : 'No'}</button>
            ))}
          </div>
        </div>
        <button className="btn btn-primary" onClick={saveWorkOrder} disabled={!woForm.title.trim()}>Create work order</button>
        <button className="btn btn-secondary" onClick={() => setView('list')}>Cancel</button>
      </div>
    </div>
  )

  // ── WORK ORDER DETAIL ──────────────────────────────────────
  if (view === 'wo-detail' && selectedWO) {
    const pc = PRI_CONFIG[selectedWO.priority] || PRI_CONFIG.med
    const sc = STATUS_CONFIG[selectedWO.status] || STATUS_CONFIG.open
    return (
      <div>
        <div className="topbar">
          <button onClick={() => setView('list')} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
          <h1>{selectedWO.title}</h1>
          <p>{selectedWO.category} · {selectedWO.asset || '—'}</p>
        </div>
        <div className="content">
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
            <span style={{background:pc.bg,color:pc.color,fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:500}}>{pc.label}</span>
            <span style={{background:sc.bg,color:sc.color,fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:500}}>{sc.label}</span>
          </div>
          {selectedWO.description && (
            <div style={{background:'#f8f8f8',borderRadius:8,padding:12,marginBottom:12}}>
              <p style={{fontSize:11,fontWeight:500,color:'#555',marginBottom:4}}>Description</p>
              <p style={{fontSize:13,color:'#333',lineHeight:1.55}}>{selectedWO.description}</p>
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Assigned to</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selectedWO.assigned_to_name || 'Unassigned'}</div></div>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Due date</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selectedWO.due_date ? format(new Date(selectedWO.due_date),'MMM d, yyyy') : '—'}</div></div>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Created</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{format(new Date(selectedWO.created_at),'MMM d')}</div></div>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Approval req.</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selectedWO.approval_required?'Yes — Lain/Clare':'Not required'}</div></div>
          </div>
          {selectedWO.photo_required && (
            <div style={{background:'#f5f5f5',borderRadius:8,padding:9,marginBottom:12,fontSize:12,color:'#555'}}>
              📷 Photo sign-off required to complete
            </div>
          )}
          {selectedWO.approval_required && (
            <div style={{background:'#E6F1FB',borderRadius:8,padding:9,marginBottom:12,fontSize:12,color:'#185FA5'}}>
              🔒 Lain/Clare approval required before this work order closes
            </div>
          )}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:7}}>
            <button className="btn" style={{background:'#E6F1FB',color:'#1A4F8A',marginBottom:0}} onClick={() => updateWOStatus(selectedWO.id,'inprogress')}>▶ In progress</button>
            <button className="btn btn-success" style={{marginBottom:0}} onClick={() => updateWOStatus(selectedWO.id,'done')}>✓ Complete</button>
          </div>
          <button className="btn" style={{background:'#FAEEDA',color:'#854F0B',marginBottom:7}} onClick={() => updateWOStatus(selectedWO.id,'blocked')}>⚠ Mark blocked</button>
          <button className="btn btn-secondary" onClick={() => setView('list')}>Back to list</button>
        </div>
      </div>
    )
  }

  // ── MAIN LIST VIEW ─────────────────────────────────────────
  return (
    <div>
      <div className="topbar">
        <h1>Property Tracker</h1>
        <p>Alligator Landing</p>
      </div>
      <div className="content">
        <div className="tab-row">
          {[['wo','Work orders'],['punch','Punch list'],['notes','Notes'],['photos','Photos']].map(([k,l]) => (
            <button key={k} className={`tab-btn${tab===k?' active':''}`} onClick={() => setTab(k)}>{l}</button>
          ))}
        </div>

        {/* ── WORK ORDERS ── */}
        {tab === 'wo' && (
          <>
            <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num">{workOrders.length}</div><div className="stat-lbl">Total</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#A32D2D'}}>{openCrit}</div><div className="stat-lbl">Critical</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#185FA5'}}>{inProgress}</div><div className="stat-lbl">In progress</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#3B6D11'}}>{complete}</div><div className="stat-lbl">Complete</div></div>
            </div>
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
              {[['all','All'],['open','Open'],['inprogress','In progress'],['done','Complete']].map(([k,l]) => (
                <button key={k} className={`filter-pill${woFilter===k?' active':''}`} onClick={() => setWoFilter(k)}>{l}</button>
              ))}
            </div>
            {loading ? <p style={{color:'#888',fontSize:13}}>Loading…</p>
            : filteredWOs.length === 0 ? (
              <div style={{textAlign:'center',padding:'32px 0'}}>
                <p style={{fontSize:28,marginBottom:8}}>✅</p>
                <p style={{fontSize:14,fontWeight:600,color:'#333',marginBottom:4}}>No work orders</p>
                <p style={{fontSize:12,color:'#888'}}>Create one below.</p>
              </div>
            ) : filteredWOs.map(wo => {
              const pc = PRI_CONFIG[wo.priority] || PRI_CONFIG.med
              const sc = STATUS_CONFIG[wo.status] || STATUS_CONFIG.open
              return (
                <div key={wo.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,marginBottom:8,overflow:'hidden',cursor:'pointer'}}
                  onClick={() => { setSelectedWO(wo); setView('wo-detail') }}>
                  <div style={{padding:'11px 12px',display:'flex',alignItems:'flex-start',gap:9}}>
                    <div style={{width:3,borderRadius:2,background:pc.bar,alignSelf:'stretch',flexShrink:0,marginTop:1}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:5}}>{wo.title}</div>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center',marginBottom:4}}>
                        <span style={{background:pc.bg,color:pc.color,fontSize:10,padding:'2px 6px',borderRadius:20,fontWeight:500}}>{pc.label}</span>
                        <span style={{background:sc.bg,color:sc.color,fontSize:10,padding:'2px 6px',borderRadius:20,fontWeight:500}}>{sc.label}</span>
                        {wo.asset && <span style={{fontSize:10,color:'#888'}}>{wo.asset}</span>}
                      </div>
                      <div style={{fontSize:11,color:'#888'}}>
                        {wo.assigned_to_name || 'Unassigned'}
                        {wo.due_date && ` · Due ${format(new Date(wo.due_date),'MMM d')}`}
                        {wo.approval_required && <span style={{color:'#185FA5'}}> · Approval req.</span>}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            <button className="btn btn-primary" style={{marginTop:4}} onClick={() => setView('new-wo')}>+ New work order</button>
          </>
        )}

        {/* ── PUNCH LIST ── */}
        {tab === 'punch' && (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:500}}>Quick items to get done</span>
              <span style={{fontSize:11,color:'#888'}}>{donePunch} of {punch.length} done</span>
            </div>
            <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:'0 12px',marginBottom:10}}>
              {loading ? <p style={{padding:'12px 0',fontSize:13,color:'#888'}}>Loading…</p>
              : punch.length === 0 ? <p style={{padding:'16px 0',textAlign:'center',fontSize:13,color:'#888'}}>No items yet — add one below.</p>
              : punch.map(p => (
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'0.5px solid #f5f5f5'}}>
                  <button onClick={() => togglePunch(p.id, p.done)} style={{width:22,height:22,borderRadius:'50%',border:`1.5px solid ${p.done?'#3B6D11':'#ccc'}`,background:p.done?'#3B6D11':'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {p.done && '✓'}
                  </button>
                  <div style={{flex:1,fontSize:12,color:'#333',textDecoration:p.done?'line-through':'none',opacity:p.done?0.5:1}}>{p.text}</div>
                </div>
              ))}
            </div>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:12,marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>Add punch list item</div>
              <div style={{display:'flex',gap:8}}>
                <input className="form-input" style={{flex:1}} value={newPunch} onChange={e=>setNewPunch(e.target.value)} placeholder="e.g. Replace light bulb in shop…" onKeyDown={e=>e.key==='Enter'&&addPunchItem()}/>
                <button onClick={addPunchItem} style={{padding:'9px 14px',borderRadius:8,border:'none',background:'#1A4F8A',color:'#fff',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:500,flexShrink:0}}>Add</button>
              </div>
            </div>
          </>
        )}

        {/* ── NOTES ── */}
        {tab === 'notes' && (
          <>
            <div style={{background:'#E6F1FB',borderRadius:8,padding:9,marginBottom:10,fontSize:11,color:'#185FA5'}}>
              Log anything you notice on the property. Flagged notes go to Lain & Clare for review.
            </div>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:12,marginBottom:12}}>
              <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>Add observation</div>
              <div className="form-group">
                <label className="form-label">Note</label>
                <textarea className="form-input" rows={2} value={newNote.text} onChange={e=>setNewNote({...newNote,text:e.target.value})} placeholder="What did you observe or notice…" style={{resize:'none'}}/>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
                <div>
                  <label className="form-label">Location / asset</label>
                  <select className="form-input" value={newNote.asset} onChange={e=>setNewNote({...newNote,asset:e.target.value})}>
                    {['General property',...ASSETS.filter(a=>a!=='— select —')].map(a=><option key={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Flag for review?</label>
                  <select className="form-input" value={newNote.flag} onChange={e=>setNewNote({...newNote,flag:e.target.value})}>
                    <option value="none">No flag</option>
                    <option value="review">Needs review</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" style={{marginBottom:0}} onClick={addNote} disabled={!newNote.text.trim()}>Save observation</button>
            </div>
            <div className="section-label">Recent observations</div>
            {loading ? <p style={{color:'#888',fontSize:13}}>Loading…</p>
            : notes.length === 0 ? <p style={{color:'#888',fontSize:13,padding:'12px 0'}}>No notes yet.</p>
            : notes.map(n => {
              const fc = FLAG_CONFIG[n.flag] || FLAG_CONFIG.none
              return (
                <div key={n.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:11,marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:8,marginBottom:6}}>
                    <div style={{width:8,height:8,borderRadius:'50%',background:fc.color,flexShrink:0,marginTop:4}}/>
                    <div style={{flex:1,fontSize:12,color:'#333',lineHeight:1.5}}>{n.text}</div>
                  </div>
                  <div style={{display:'flex',gap:8,fontSize:10,color:'#aaa',flexWrap:'wrap'}}>
                    <span>{n.asset}</span>
                    <span>·</span>
                    <span>{n.created_profile?.full_name || 'Unknown'}</span>
                    <span>·</span>
                    <span>{format(new Date(n.created_at),'MMM d · h:mm a')}</span>
                    {fc.label && <span style={{color:fc.color,fontWeight:500}}>· {fc.label}</span>}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {/* ── PHOTOS ── */}
        {tab === 'photos' && (
          <>
            <div style={{background:'#f5f5f5',borderRadius:8,padding:9,marginBottom:10,fontSize:11,color:'#666'}}>
              Photos from work order sign-offs and property observations.
            </div>
            {photos.length === 0 ? (
              <div style={{textAlign:'center',padding:'48px 0'}}>
                <p style={{fontSize:32,marginBottom:8}}>📷</p>
                <p style={{fontSize:14,fontWeight:600,color:'#333',marginBottom:4}}>No photos yet</p>
                <p style={{fontSize:12,color:'#888'}}>Photos will appear here when work orders and notes include photos.</p>
              </div>
            ) : (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                {photos.map(p => (
                  <div key={p.id} style={{height:100,borderRadius:8,background:'#f0f0f0',display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',overflow:'hidden'}}>
                    <img src={p.url} alt={p.caption} style={{width:'100%',height:'100%',objectFit:'cover'}}/>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
