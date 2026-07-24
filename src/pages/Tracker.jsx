import { useState, useEffect, useRef } from 'react'
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
const CREW = ['Unassigned','Lain','Clare','Juan','Lane','Scott','Jacob','Trace','Garrett','Delaney','Jake']
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
  none:   { color:'#ccc',     label:'' },
  review: { color:'#EF9F27', label:'Needs review' },
  urgent: { color:'#E24B4A', label:'Urgent' },
}

// ── DELETE HELPERS ─────────────────────────────────────────
async function softDelete(table, id, title, entityType, userId) {
  await supabase.from(table).update({ deleted_at: new Date().toISOString() }).eq('id', id)
  await supabase.from('deleted_items_log').insert({
    entity_type: entityType, entity_id: id, entity_title: title, deleted_by: userId
  })
}

async function permanentDelete(table, id, userId) {
  await supabase.from(table).delete().eq('id', id)
  await supabase.from('deleted_items_log').update({
    permanently_removed: true, permanently_removed_by: userId,
    permanently_removed_at: new Date().toISOString()
  }).eq('entity_id', id)
}

// ── DELETE BUTTON COMPONENT ────────────────────────────────
function DeleteMenu({ isOwner, onSoftDelete, onPermanentDelete }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(null)

  if (confirming === 'soft') return (
    <div style={{display:'flex',gap:6,alignItems:'center'}}>
      <span style={{fontSize:11,color:'#555'}}>Archive this item?</span>
      <button onClick={async()=>{await onSoftDelete();setConfirming(null);setOpen(false)}} style={{padding:'5px 10px',borderRadius:6,border:'none',background:'#FAEEDA',color:'#854F0B',fontSize:11,cursor:'pointer',fontWeight:500}}>Archive</button>
      <button onClick={()=>setConfirming(null)} style={{padding:'5px 10px',borderRadius:6,border:'0.5px solid #ddd',background:'none',color:'#666',fontSize:11,cursor:'pointer'}}>Cancel</button>
    </div>
  )

  if (confirming === 'perm') return (
    <div style={{display:'flex',gap:6,alignItems:'center'}}>
      <span style={{fontSize:11,color:'#A32D2D'}}>Permanently delete?</span>
      <button onClick={async()=>{await onPermanentDelete();setConfirming(null);setOpen(false)}} style={{padding:'5px 10px',borderRadius:6,border:'none',background:'#FCEBEB',color:'#A32D2D',fontSize:11,cursor:'pointer',fontWeight:500}}>Delete forever</button>
      <button onClick={()=>setConfirming(null)} style={{padding:'5px 10px',borderRadius:6,border:'0.5px solid #ddd',background:'none',color:'#666',fontSize:11,cursor:'pointer'}}>Cancel</button>
    </div>
  )

  return (
    <div style={{position:'relative'}}>
      <button onClick={()=>setOpen(!open)} style={{padding:'6px 10px',borderRadius:6,border:'0.5px solid #ddd',background:'#FCEBEB',color:'#A32D2D',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
        🗑 Delete
      </button>
      {open && (
        <div style={{position:'absolute',right:0,top:'110%',background:'#fff',border:'0.5px solid #ddd',borderRadius:8,boxShadow:'0 4px 12px rgba(0,0,0,0.1)',zIndex:100,minWidth:180,overflow:'hidden'}}>
          <button onClick={()=>{setOpen(false);setConfirming('soft')}} style={{width:'100%',padding:'10px 14px',border:'none',background:'none',textAlign:'left',fontSize:12,cursor:'pointer',color:'#555',borderBottom:'0.5px solid #f0f0f0'}}>
            📦 Archive (keep in history)
          </button>
          {isOwner && (
            <button onClick={()=>{setOpen(false);setConfirming('perm')}} style={{width:'100%',padding:'10px 14px',border:'none',background:'none',textAlign:'left',fontSize:12,cursor:'pointer',color:'#A32D2D'}}>
              ⚠️ Delete permanently
            </button>
          )}
          <button onClick={()=>setOpen(false)} style={{width:'100%',padding:'8px 14px',border:'none',background:'#f8f8f8',textAlign:'left',fontSize:11,cursor:'pointer',color:'#888'}}>
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

function canEditOrDelete(profile, email) {
  if (profile?.role === 'owner' || profile?.role === 'admin') return true
  // Fallback while profile loads — check known owner/admin emails
  const adminEmails = ['hancock.lain@gmail.com', 'lain@alligatorlanding.com']
  return adminEmails.includes(email)
}

// ── MEDIA PANEL (upload + gallery combined) ───────────────
function MediaPanel({ entityType, entityId, session }) {
  const [media, setMedia] = useState([])
  const [uploading, setUploading] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const fileRef = useRef()

  useEffect(() => { if (entityId) loadMedia() }, [entityId])

  async function loadMedia() {
    const { data } = await supabase
      .from('tracker_media')
      .select('*, uploaded_profile:profiles!tracker_media_uploaded_by_fkey(full_name)')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
    if (data) {
      setMedia(data.map(m => {
        const { data: urlData } = supabase.storage.from('tracker-media').getPublicUrl(m.storage_path)
        return { ...m, url: urlData?.publicUrl }
      }))
    }
  }

  async function handleFiles(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `${entityType}/${entityId}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('tracker-media').upload(path, file, { contentType: file.type })
      if (!error) {
        await supabase.from('tracker_media').insert({
          storage_path: path, file_name: file.name,
          file_type: file.type.startsWith('video/') ? 'video' : 'image',
          mime_type: file.type, entity_type: entityType, entity_id: entityId,
          uploaded_by: session.user.id
        })
      }
    }
    setUploading(false)
    await loadMedia()
    e.target.value = ''
  }

  async function deleteMedia(id, path) {
    await supabase.storage.from('tracker-media').remove([path])
    await supabase.from('tracker_media').delete().eq('id', id)
    setLightbox(null)
    loadMedia()
  }

  return (
    <div>
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.92)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,padding:16}}>
          {lightbox.file_type==='video'
            ? <video src={lightbox.url} controls autoPlay style={{maxWidth:'100%',maxHeight:'70vh',borderRadius:8}}/>
            : <img src={lightbox.url} alt="" style={{maxWidth:'100%',maxHeight:'70vh',borderRadius:8,objectFit:'contain'}}/>}
          <div style={{color:'#fff',fontSize:12}}>{lightbox.file_name} · {lightbox.uploaded_profile?.full_name}</div>
          <button onClick={e=>{e.stopPropagation();deleteMedia(lightbox.id,lightbox.storage_path)}} style={{padding:'8px 16px',borderRadius:8,border:'none',background:'#A32D2D',color:'#fff',fontSize:12,cursor:'pointer'}}>Delete</button>
          <div style={{color:'rgba(255,255,255,0.5)',fontSize:11}}>Tap anywhere to close</div>
        </div>
      )}
      {media.length > 0 && (
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
          {media.map(m => (
            <div key={m.id} onClick={() => setLightbox(m)} style={{aspectRatio:'1',borderRadius:8,overflow:'hidden',background:'#f0f0f0',cursor:'pointer'}}>
              {m.file_type==='video'
                ? <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#1a1a1a',flexDirection:'column',gap:4}}><span style={{fontSize:20}}>▶</span><span style={{fontSize:9,color:'#aaa'}}>VIDEO</span></div>
                : m.url ? <img src={m.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:16}}>📷</span></div>}
            </div>
          ))}
        </div>
      )}
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{display:'none'}} onChange={handleFiles}/>
      <button onClick={() => fileRef.current.click()} disabled={uploading} style={{
        display:'flex',alignItems:'center',gap:6,
        padding:'8px 14px',borderRadius:8,border:'0.5px solid #ddd',
        background:'#f8f8f8',color:'#555',fontSize:12,cursor:'pointer',
        fontFamily:'inherit',marginBottom:8,opacity:uploading?0.6:1
      }}>
        {uploading ? '⏳ Uploading…' : '📎 Attach photo / video'}
      </button>
    </div>
  )
}

// ── COMMENT SECTION ────────────────────────────────────────
function CommentSection({ entityType, entityId, session, tableName, fkField }) {
  const [comments, setComments] = useState([])
  const [text, setText] = useState('')

  useEffect(() => { loadComments() }, [entityId])

  async function loadComments() {
    const { data } = await supabase.from(tableName).select(`*, created_profile:profiles!${tableName}_created_by_fkey(full_name, avatar_initials)`).eq(fkField, entityId).order('created_at', { ascending: true })
    if (data) setComments(data)
  }

  async function addComment() {
    if (!text.trim()) return
    await supabase.from(tableName).insert({ [fkField]: entityId, comment_text: text.trim(), created_by: session.user.id })
    setText('')
    loadComments()
  }

  return (
    <div>
      <div className="section-label">Comments ({comments.length})</div>
      <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:'0 12px',marginBottom:8}}>
        {comments.length === 0 ? <p style={{padding:'12px 0',fontSize:12,color:'#aaa',textAlign:'center'}}>No comments yet.</p>
        : comments.map(c => (
          <div key={c.id} style={{padding:'9px 0',borderBottom:'0.5px solid #f5f5f5'}}>
            <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
              <div style={{width:22,height:22,borderRadius:'50%',background:'#E6F1FB',color:'#0C447C',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:600,flexShrink:0}}>{c.created_profile?.avatar_initials||'?'}</div>
              <span style={{fontSize:11,fontWeight:500,color:'#333'}}>{c.created_profile?.full_name||'Unknown'}</span>
              <span style={{fontSize:10,color:'#aaa'}}>{format(new Date(c.created_at),'MMM d · h:mm a')}</span>
            </div>
            <div style={{fontSize:12,color:'#444',lineHeight:1.5,paddingLeft:29}}>{c.comment_text}</div>
            <div style={{paddingLeft:29,marginTop:6}}><MediaGallery entityType="comment" entityId={c.id} session={session}/></div>
          </div>
        ))}
      </div>
      <div style={{display:'flex',gap:8,marginBottom:4}}>
        <input className="form-input" style={{flex:1}} value={text} onChange={e=>setText(e.target.value)} placeholder="Add a comment…" onKeyDown={e=>e.key==='Enter'&&addComment()}/>
        <button onClick={addComment} style={{padding:'9px 14px',borderRadius:8,border:'none',background:'#1A4F8A',color:'#fff',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:500,flexShrink:0}}>Post</button>
      </div>
      <div style={{marginBottom:12}}><MediaPanel entityType="comment" entityId={`${entityType}-${entityId}`} session={session}/></div>
    </div>
  )
}

export default function Tracker({ session }) {
  const [tab, setTab] = useState('wo')
  const [profile, setProfile] = useState(null)
  const [workOrders, setWorkOrders] = useState([])
  const [punch, setPunch] = useState([])
  const [notes, setNotes] = useState([])
  const [view, setView] = useState('list')
  const [selectedWO, setSelectedWO] = useState(null)
  const [selectedPunch, setSelectedPunch] = useState(null)
  const [woFilter, setWoFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [newPunch, setNewPunch] = useState('')
  const [newNote, setNewNote] = useState({ text:'', asset:'General property', flag:'none' })
  const [woForm, setWoForm] = useState({ title:'', description:'', category:CATEGORIES[0], asset:'— select —', priority:'med', assigned_to:'Unassigned', due_date:'', photo_required:false, approval_required:true })
  const [isEditing, setIsEditing] = useState(false)
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const woFileRef = useRef()

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: prof }, { data: wo }, { data: p }, { data: n }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('work_orders').select('*, created_profile:profiles!work_orders_created_by_fkey(full_name)').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('punch_list_items').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
      supabase.from('property_notes').select('*, created_profile:profiles!property_notes_created_by_fkey(full_name)').is('deleted_at', null).order('created_at', { ascending: false }),
    ])
    if (prof) setProfile(prof)
    if (wo) setWorkOrders(wo)
    if (p) setPunch(p)
    if (n) setNotes(n)
    setLoading(false)
  }

  async function saveWorkOrder() {
    if (!woForm.title.trim()) return
    let woId = selectedWO?.id
    if (isEditing && selectedWO) {
      await supabase.from('work_orders').update({
        title: woForm.title, description: woForm.description,
        category: woForm.category, asset: woForm.asset === '— select —' ? null : woForm.asset,
        priority: woForm.priority, assigned_to_name: woForm.assigned_to,
        due_date: woForm.due_date || null, photo_required: woForm.photo_required,
        approval_required: woForm.approval_required, updated_at: new Date().toISOString()
      }).eq('id', selectedWO.id)
    } else {
      const { data } = await supabase.from('work_orders').insert({
        title: woForm.title, description: woForm.description,
        category: woForm.category, asset: woForm.asset === '— select —' ? null : woForm.asset,
        priority: woForm.priority, assigned_to_name: woForm.assigned_to,
        due_date: woForm.due_date || null, photo_required: woForm.photo_required,
        approval_required: woForm.approval_required, status: 'open',
        created_by: session.user.id
      }).select().single()
      if (data) woId = data.id
    }

    // Upload any pending files
    if (woId && pendingFiles.length > 0) {
      setUploading(true)
      for (const file of pendingFiles) {
        const ext = file.name.split('.').pop()
        const path = `work_order/${woId}/${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('tracker-media').upload(path, file, { contentType: file.type })
        if (!error) {
          await supabase.from('tracker_media').insert({
            storage_path: path, file_name: file.name,
            file_type: file.type.startsWith('video/') ? 'video' : 'image',
            mime_type: file.type, entity_type: 'work_order', entity_id: woId,
            uploaded_by: session.user.id
          })
        }
      }
      setUploading(false)
    }

    setPendingFiles([])
    resetWOForm()
    setView('list')
    loadAll()
  }

  function resetWOForm() {
    setWoForm({ title:'', description:'', category:CATEGORIES[0], asset:'— select —', priority:'med', assigned_to:'Unassigned', due_date:'', photo_required:false, approval_required:true })
    setIsEditing(false)
    setSelectedWO(null)
    setPendingFiles([])
  }

  function openEditWO(wo) {
    setWoForm({ title:wo.title, description:wo.description||'', category:wo.category||CATEGORIES[0], asset:wo.asset||'— select —', priority:wo.priority||'med', assigned_to:wo.assigned_to_name||'Unassigned', due_date:wo.due_date||'', photo_required:wo.photo_required||false, approval_required:wo.approval_required!==false })
    setIsEditing(true)
    setSelectedWO(wo)
    setView('new-wo')
  }

  async function updateWOStatus(id, status) {
    await supabase.from('work_orders').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
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

  const isOwnerAdmin = canEditOrDelete(profile, session.user.email)
  const isOwner = profile?.role === 'owner' || session.user.email === 'hancock.lain@gmail.com'
  const filteredWOs = workOrders.filter(w => woFilter === 'all' || w.status === woFilter)
  const donePunch = punch.filter(p => p.done).length
  const openCrit = workOrders.filter(w => w.priority === 'crit' && w.status !== 'done').length
  const inProgress = workOrders.filter(w => w.status === 'inprogress').length
  const complete = workOrders.filter(w => w.status === 'done').length

  // ── WORK ORDER FORM ────────────────────────────────────────
  if (view === 'new-wo') return (
    <div>
      <div className="topbar">
        <button onClick={() => { resetWOForm(); setView('list') }} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
        <h1>{isEditing ? 'Edit work order' : 'New work order'}</h1>
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
              <button key={k} onClick={() => setWoForm({...woForm,priority:k})} style={{flex:1,padding:'8px 4px',borderRadius:6,border:`${woForm.priority===k?'1.5px':'0.5px'} solid ${woForm.priority===k?v.color:'#ddd'}`,background:woForm.priority===k?v.bg:'none',color:woForm.priority===k?v.color:'#666',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:woForm.priority===k?600:400}}>{v.label}</button>
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
              <button key={String(v)} onClick={() => setWoForm({...woForm,photo_required:v})} style={{flex:1,padding:9,borderRadius:8,fontFamily:'inherit',cursor:'pointer',fontSize:12,border:`${woForm.photo_required===v?'1.5px':'0.5px'} solid ${woForm.photo_required===v?'#3B6D11':'#ddd'}`,background:woForm.photo_required===v?'#EAF3DE':'none',color:woForm.photo_required===v?'#3B6D11':'#666',fontWeight:woForm.photo_required===v?600:400}}>{v?'Yes — required':'No'}</button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Needs Lain/Clare approval to close?</label>
          <div style={{display:'flex',gap:8}}>
            {[true,false].map(v => (
              <button key={String(v)} onClick={() => setWoForm({...woForm,approval_required:v})} style={{flex:1,padding:9,borderRadius:8,fontFamily:'inherit',cursor:'pointer',fontSize:12,border:`${woForm.approval_required===v?'1.5px':'0.5px'} solid ${woForm.approval_required===v?'#1A4F8A':'#ddd'}`,background:woForm.approval_required===v?'#E6F1FB':'none',color:woForm.approval_required===v?'#0C447C':'#666',fontWeight:woForm.approval_required===v?600:400}}>{v?'Yes':'No'}</button>
            ))}
          </div>
        </div>
        {/* Photo/video upload */}
        <div style={{marginBottom:12}}>
          <label className="form-label">Attach photos / videos</label>
          <input ref={woFileRef} type="file" accept="image/*,video/*" multiple style={{display:'none'}}
            onChange={e => { setPendingFiles(prev => [...prev, ...Array.from(e.target.files)]); e.target.value='' }}/>
          {pendingFiles.length > 0 && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
              {pendingFiles.map((f,i) => (
                <div key={i} style={{aspectRatio:'1',borderRadius:8,background:'#EAF3DE',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:4,position:'relative'}}>
                  <span style={{fontSize:20}}>{f.type.startsWith('video/')?'🎥':'📷'}</span>
                  <span style={{fontSize:9,color:'#3B6D11',padding:'0 4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100%'}}>{f.name}</span>
                  <button onClick={()=>setPendingFiles(prev=>prev.filter((_,j)=>j!==i))} style={{position:'absolute',top:2,right:2,width:16,height:16,borderRadius:'50%',border:'none',background:'#A32D2D',color:'#fff',fontSize:9,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>×</button>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => woFileRef.current.click()} style={{
            width:'100%',padding:10,borderRadius:8,
            border:`1.5px dashed ${pendingFiles.length>0?'#3B6D11':'#ccc'}`,
            background:pendingFiles.length>0?'#EAF3DE':'none',
            color:pendingFiles.length>0?'#3B6D11':'#888',
            fontSize:12,cursor:'pointer',fontFamily:'inherit'
          }}>
            {pendingFiles.length>0 ? `✓ ${pendingFiles.length} file${pendingFiles.length!==1?'s':''} selected — tap to add more` : '📎 Attach photo / video (optional)'}
          </button>
        </div>
        <button className="btn btn-primary" onClick={saveWorkOrder} disabled={!woForm.title.trim()||uploading}>
          {uploading ? '⏳ Uploading…' : isEditing ? 'Save changes' : 'Create work order'}
        </button>
        <button className="btn btn-secondary" onClick={() => { resetWOForm(); setView('list') }}>Cancel</button>
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
          <button onClick={() => { setSelectedWO(null); setView('list') }} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div><h1 style={{fontSize:15}}>{selectedWO.title}</h1><p>{selectedWO.category} · {selectedWO.asset||'—'}</p></div>
            {isOwnerAdmin && <button onClick={() => openEditWO(selectedWO)} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',padding:'6px 12px',borderRadius:6,fontSize:12,cursor:'pointer'}}>Edit</button>}
          </div>
        </div>
        <div className="content">
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10}}>
            <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
              <span style={{background:pc.bg,color:pc.color,fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:500}}>{pc.label}</span>
              <span style={{background:sc.bg,color:sc.color,fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:500}}>{sc.label}</span>
            </div>
            {isOwnerAdmin && (
              <DeleteMenu isOwner={isOwner}
                onSoftDelete={async()=>{ await softDelete('work_orders',selectedWO.id,selectedWO.title,'work_order',session.user.id); setSelectedWO(null); setView('list'); loadAll() }}
                onPermanentDelete={async()=>{ await permanentDelete('work_orders',selectedWO.id,session.user.id); setSelectedWO(null); setView('list'); loadAll() }}
              />
            )}
          </div>
          {selectedWO.description && <div style={{background:'#f8f8f8',borderRadius:8,padding:12,marginBottom:12}}><p style={{fontSize:11,fontWeight:500,color:'#555',marginBottom:4}}>Description</p><p style={{fontSize:13,color:'#333',lineHeight:1.55}}>{selectedWO.description}</p></div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Assigned to</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selectedWO.assigned_to_name||'Unassigned'}</div></div>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Due date</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selectedWO.due_date?format(new Date(selectedWO.due_date),'MMM d, yyyy'):'—'}</div></div>
          </div>
          <div className="section-label">Photos & videos</div>
          <MediaPanel entityType="work_order" entityId={selectedWO.id} session={session}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:7}}>
            <button className="btn" style={{background:'#E6F1FB',color:'#1A4F8A',marginBottom:0}} onClick={()=>updateWOStatus(selectedWO.id,'inprogress')}>▶ In progress</button>
            <button className="btn btn-success" style={{marginBottom:0}} onClick={()=>updateWOStatus(selectedWO.id,'done')}>✓ Complete</button>
          </div>
          <button className="btn" style={{background:'#FAEEDA',color:'#854F0B',marginBottom:12}} onClick={()=>updateWOStatus(selectedWO.id,'blocked')}>⚠ Mark blocked</button>
          <CommentSection entityType="work_order" entityId={selectedWO.id} session={session} tableName="work_order_comments" fkField="work_order_id"/>
          <button className="btn btn-secondary" onClick={()=>{ setSelectedWO(null); setView('list') }}>Back to list</button>
        </div>
      </div>
    )
  }

  // ── PUNCH LIST DETAIL ──────────────────────────────────────
  if (view === 'punch-detail' && selectedPunch) return (
    <div>
      <div className="topbar">
        <button onClick={() => { setSelectedPunch(null); setView('list'); setTab('punch') }} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
        <h1 style={{fontSize:15}}>{selectedPunch.text}</h1>
        <p>Punch list item</p>
      </div>
      <div className="content">
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12}}>
          <button onClick={() => { togglePunch(selectedPunch.id, selectedPunch.done); setSelectedPunch({...selectedPunch,done:!selectedPunch.done}) }} style={{flex:1,padding:10,borderRadius:8,border:`1.5px solid ${selectedPunch.done?'#3B6D11':'#ccc'}`,background:selectedPunch.done?'#EAF3DE':'none',color:selectedPunch.done?'#3B6D11':'#666',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:500,marginRight:8}}>
            {selectedPunch.done?'✓ Completed — tap to undo':'Mark complete'}
          </button>
          {isOwnerAdmin && (
            <DeleteMenu isOwner={isOwner}
              onSoftDelete={async()=>{ await softDelete('punch_list_items',selectedPunch.id,selectedPunch.text,'punch_list',session.user.id); setSelectedPunch(null); setView('list'); setTab('punch'); loadAll() }}
              onPermanentDelete={async()=>{ await permanentDelete('punch_list_items',selectedPunch.id,session.user.id); setSelectedPunch(null); setView('list'); setTab('punch'); loadAll() }}
            />
          )}
        </div>
        <div className="section-label">Photos & videos</div>
        <MediaPanel entityType="punch_list" entityId={selectedPunch.id} session={session}/>
        <CommentSection entityType="punch_list" entityId={selectedPunch.id} session={session} tableName="punch_list_comments" fkField="punch_list_id"/>
        <button className="btn btn-secondary" onClick={()=>{ setSelectedPunch(null); setView('list'); setTab('punch') }}>Back to list</button>
      </div>
    </div>
  )

  // ── MAIN LIST ──────────────────────────────────────────────
  return (
    <div>
      <div className="topbar"><h1>Property Tracker</h1><p>Alligator Landing</p></div>
      <div className="content">
        <div className="tab-row">
          {[['wo','Work orders'],['punch','Punch list'],['notes','Notes'],['photos','Photos']].map(([k,l]) => (
            <button key={k} className={`tab-btn${tab===k?' active':''}`} onClick={()=>setTab(k)}>{l}</button>
          ))}
        </div>

        {tab==='wo' && (
          <>
            <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num">{workOrders.length}</div><div className="stat-lbl">Total</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#A32D2D'}}>{openCrit}</div><div className="stat-lbl">Critical</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#185FA5'}}>{inProgress}</div><div className="stat-lbl">In progress</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#3B6D11'}}>{complete}</div><div className="stat-lbl">Complete</div></div>
            </div>
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
              {[['all','All'],['open','Open'],['inprogress','In progress'],['done','Complete']].map(([k,l]) => (
                <button key={k} className={`filter-pill${woFilter===k?' active':''}`} onClick={()=>setWoFilter(k)}>{l}</button>
              ))}
            </div>
            {loading ? <p style={{color:'#888',fontSize:13}}>Loading…</p>
            : filteredWOs.length===0 ? <div style={{textAlign:'center',padding:'32px 0'}}><p style={{fontSize:28,marginBottom:8}}>✅</p><p style={{fontSize:14,fontWeight:600,marginBottom:4}}>No work orders</p></div>
            : filteredWOs.map(wo => {
              const pc=PRI_CONFIG[wo.priority]||PRI_CONFIG.med
              const sc=STATUS_CONFIG[wo.status]||STATUS_CONFIG.open
              return (
                <div key={wo.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,marginBottom:8,overflow:'hidden',cursor:'pointer'}} onClick={()=>{ setSelectedWO(wo); setView('wo-detail') }}>
                  <div style={{padding:'11px 12px',display:'flex',alignItems:'flex-start',gap:9}}>
                    <div style={{width:3,borderRadius:2,background:pc.bar,alignSelf:'stretch',flexShrink:0,marginTop:1}}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:500,marginBottom:5}}>{wo.title}</div>
                      <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center',marginBottom:4}}>
                        <span style={{background:pc.bg,color:pc.color,fontSize:10,padding:'2px 6px',borderRadius:20,fontWeight:500}}>{pc.label}</span>
                        <span style={{background:sc.bg,color:sc.color,fontSize:10,padding:'2px 6px',borderRadius:20,fontWeight:500}}>{sc.label}</span>
                        {wo.asset&&<span style={{fontSize:10,color:'#888'}}>{wo.asset}</span>}
                      </div>
                      <div style={{fontSize:11,color:'#888'}}>{wo.assigned_to_name||'Unassigned'}{wo.due_date&&` · Due ${format(new Date(wo.due_date),'MMM d')}`}</div>
                    </div>
                  </div>
                </div>
              )
            })}
            <button className="btn btn-primary" style={{marginTop:4}} onClick={()=>{ resetWOForm(); setView('new-wo') }}>+ New work order</button>
          </>
        )}

        {tab==='punch' && (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
              <span style={{fontSize:13,fontWeight:500}}>Quick items to get done</span>
              <span style={{fontSize:11,color:'#888'}}>{donePunch} of {punch.length} done</span>
            </div>
            <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:'0 12px',marginBottom:10}}>
              {loading ? <p style={{padding:'12px 0',fontSize:13,color:'#888'}}>Loading…</p>
              : punch.length===0 ? <p style={{padding:'16px 0',textAlign:'center',fontSize:13,color:'#888'}}>No items yet.</p>
              : punch.map(p => (
                <div key={p.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:'0.5px solid #f5f5f5'}}>
                  <button onClick={()=>togglePunch(p.id,p.done)} style={{width:22,height:22,borderRadius:'50%',border:`1.5px solid ${p.done?'#3B6D11':'#ccc'}`,background:p.done?'#3B6D11':'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                    {p.done&&'✓'}
                  </button>
                  <div style={{flex:1,fontSize:12,color:'#333',textDecoration:p.done?'line-through':'none',opacity:p.done?0.5:1,cursor:'pointer'}} onClick={()=>{ setSelectedPunch(p); setView('punch-detail') }}>{p.text}</div>
                  <span style={{fontSize:10,color:'#aaa'}}>💬</span>
                </div>
              ))}
            </div>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:12,marginBottom:10}}>
              <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>Add item</div>
              <div style={{display:'flex',gap:8}}>
                <input className="form-input" style={{flex:1}} value={newPunch} onChange={e=>setNewPunch(e.target.value)} placeholder="e.g. Replace light bulb in shop…" onKeyDown={e=>e.key==='Enter'&&addPunchItem()}/>
                <button onClick={addPunchItem} style={{padding:'9px 14px',borderRadius:8,border:'none',background:'#1A4F8A',color:'#fff',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:500,flexShrink:0}}>Add</button>
              </div>
            </div>
          </>
        )}

        {tab==='notes' && (
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
                <div><label className="form-label">Location / asset</label>
                  <select className="form-input" value={newNote.asset} onChange={e=>setNewNote({...newNote,asset:e.target.value})}>
                    {['General property',...ASSETS.filter(a=>a!=='— select —')].map(a=><option key={a}>{a}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Flag for review?</label>
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
            : notes.length===0 ? <p style={{color:'#888',fontSize:13,padding:'12px 0'}}>No notes yet.</p>
            : notes.map(n => {
              const fc=FLAG_CONFIG[n.flag]||FLAG_CONFIG.none
              return (
                <div key={n.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:11,marginBottom:8}}>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:6}}>
                    <div style={{display:'flex',alignItems:'flex-start',gap:8,flex:1}}>
                      <div style={{width:8,height:8,borderRadius:'50%',background:fc.color,flexShrink:0,marginTop:4}}/>
                      <div style={{flex:1,fontSize:12,color:'#333',lineHeight:1.5}}>{n.text}</div>
                    </div>
                    {isOwnerAdmin && (
                      <DeleteMenu isOwner={isOwner}
                        onSoftDelete={async()=>{ await softDelete('property_notes',n.id,n.text,'note',session.user.id); loadAll() }}
                        onPermanentDelete={async()=>{ await permanentDelete('property_notes',n.id,session.user.id); loadAll() }}
                      />
                    )}
                  </div>
                  <MediaPanel entityType="note" entityId={n.id} session={session}/>
                  <div style={{display:'flex',gap:8,fontSize:10,color:'#aaa',flexWrap:'wrap'}}>
                    <span>{n.asset}</span><span>·</span>
                    <span>{n.created_profile?.full_name||'Unknown'}</span><span>·</span>
                    <span>{format(new Date(n.created_at),'MMM d · h:mm a')}</span>
                    {fc.label&&<span style={{color:fc.color,fontWeight:500}}>· {fc.label}</span>}
                  </div>
                </div>
              )
            })}
          </>
        )}

        {tab==='photos' && <AllMediaGallery session={session}/>}
      </div>
    </div>
  )
}

function AllMediaGallery({ session }) {
  const [media, setMedia] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')
  const [lightbox, setLightbox] = useState(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data } = await supabase.from('tracker_media').select('*, uploaded_profile:profiles!tracker_media_uploaded_by_fkey(full_name)').order('created_at', { ascending: false }).limit(50)
    if (data) {
      const withUrls = data.map(m => {
        const { data: urlData } = supabase.storage.from('tracker-media').getPublicUrl(m.storage_path)
        return { ...m, url: urlData?.publicUrl }
      })
      setMedia(withUrls)
    }
    setLoading(false)
  }

  const filtered = filter==='all' ? media : media.filter(m=>m.file_type===filter)

  return (
    <>
      {lightbox && (
        <div onClick={()=>setLightbox(null)} style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.92)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12,padding:16}}>
          {lightbox.file_type==='video' ? <video src={lightbox.url} controls autoPlay style={{maxWidth:'100%',maxHeight:'70vh',borderRadius:8}}/> : <img src={lightbox.url} alt="" style={{maxWidth:'100%',maxHeight:'70vh',borderRadius:8,objectFit:'contain'}}/>}
          <div style={{color:'#fff',fontSize:12,textAlign:'center'}}>{lightbox.file_name} · {lightbox.uploaded_profile?.full_name} · {format(new Date(lightbox.created_at),'MMM d')}</div>
          <div style={{color:'rgba(255,255,255,0.5)',fontSize:11}}>Tap anywhere to close</div>
        </div>
      )}
      <div style={{display:'flex',gap:5,marginBottom:10}}>
        {[['all','All'],['image','Photos'],['video','Videos']].map(([k,l]) => (
          <button key={k} className={`filter-pill${filter===k?' active':''}`} onClick={()=>setFilter(k)}>{l}</button>
        ))}
      </div>
      {loading ? <p style={{color:'#888',fontSize:13}}>Loading…</p>
      : filtered.length===0 ? <div style={{textAlign:'center',padding:'48px 0'}}><p style={{fontSize:32,marginBottom:8}}>📷</p><p style={{fontSize:14,fontWeight:600,marginBottom:4}}>No media yet</p><p style={{fontSize:12,color:'#888'}}>Photos and videos will appear here.</p></div>
      : <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
          {filtered.map(m => (
            <div key={m.id} onClick={()=>setLightbox(m)} style={{aspectRatio:'1',borderRadius:8,overflow:'hidden',background:'#f0f0f0',cursor:'pointer'}}>
              {m.file_type==='video' ? <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#1a1a1a',flexDirection:'column',gap:4}}><span style={{fontSize:24}}>▶</span><span style={{fontSize:9,color:'#aaa'}}>VIDEO</span></div>
              : m.url ? <img src={m.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/>
              : <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center'}}><span style={{fontSize:20}}>📷</span></div>}
            </div>
          ))}
        </div>}
    </>
  )
}
