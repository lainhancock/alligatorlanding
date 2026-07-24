import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

const CATS = {
  'Grounds & Landscaping': { bg: '#EAF3DE', color: '#3B6D11' },
  'Structures & Facilities': { bg: '#E6F1FB', color: '#0C447C' },
  'Equipment & Vehicles': { bg: '#FAEEDA', color: '#633806' },
  'Wildlife & Hunting': { bg: '#FBEAF0', color: '#72243E' },
  'Mechanical Systems': { bg: '#EEEDFE', color: '#3C3489' },
  'Pest Control': { bg: '#FAECE7', color: '#712B13' },
  'Security & Surveillance': { bg: '#F1EFE8', color: '#444441' },
  'Fuel & Utilities': { bg: '#EAF3DE', color: '#3B6D11' },
  'Firearms & Range': { bg: '#FAEEDA', color: '#633806' },
  'Safety & Emergency': { bg: '#E6F1FB', color: '#0C447C' },
  'Seasonal Projects': { bg: '#E1F5EE', color: '#085041' },
}

export default function Today({ session }) {
  const [tasks, setTasks] = useState([])
  const [profile, setProfile] = useState(null)
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selected, setSelected] = useState(null)
  const [signOff, setSignOff] = useState(false)
  const [note, setNote] = useState('')
  const [photoTaken, setPhotoTaken] = useState(false)
  const [taskComments, setTaskComments] = useState([])
  const [taskMedia, setTaskMedia] = useState([])
  const [commentText, setCommentText] = useState('')
  const taskFileRef = useRef()
  const [uploadingMedia, setUploadingMedia] = useState(false)

  useEffect(() => {
    loadProfile()
    loadTasks()
  }, [])

  async function loadProfile() {
    const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
    setProfile(data)
  }

  async function loadTasks() {
    setLoading(true)
    setError(null)
    // Use CST date (UTC-6)
    const today = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Chicago'})).toLocaleDateString('en-CA')

    // Step 1 — get occurrences
    const { data: occurrences, error: occErr } = await supabase
      .from('task_occurrences')
      .select('*')
      .order('due_date', { ascending: true })

    if (occErr) { setError('Occurrences error: ' + occErr.message); setLoading(false); return }
    if (!occurrences || occurrences.length === 0) { 
      setError('Query returned 0 rows — today: ' + today + ' — session: ' + session.user.id)
      setTasks([]); setLoading(false); return 
    }
    // Filter client-side to avoid date comparison issues
    const filtered = occurrences.filter(o => o.due_date <= today)
    const toUse = filtered.length > 0 ? filtered : occurrences

    // Step 2 — get task details for each occurrence
    const taskIds = [...new Set(toUse.map(o => o.task_id))]
    const { data: taskData, error: taskErr } = await supabase
      .from('tasks')
      .select('*, category:categories(*), asset:assets(*)')
      .in('id', taskIds)

    if (taskErr) { setError('Tasks error: ' + taskErr.message); setLoading(false); return }

    // Step 3 — merge
    const taskMap = {}
    taskData?.forEach(t => { taskMap[t.id] = t })

    const merged = toUse.map(o => ({
      ...o,
      task: taskMap[o.task_id] || null
    }))

    setTasks(merged)
    setLoading(false)
  }

  async function loadTaskComments(occurrenceId) {
    const { data } = await supabase
      .from('task_occurrence_comments')
      .select('*, created_profile:profiles!task_occurrence_comments_created_by_fkey(full_name, avatar_initials)')
      .eq('occurrence_id', occurrenceId)
      .order('created_at', { ascending: true })
    if (data) setTaskComments(data)
  }

  async function loadTaskMedia(occurrenceId) {
    const { data } = await supabase
      .from('task_photos')
      .select('*')
      .eq('occurrence_id', occurrenceId)
    if (data) {
      const withUrls = data.map(m => {
        const { data: urlData } = supabase.storage.from('task-photos').getPublicUrl(m.storage_path)
        return { ...m, url: urlData?.publicUrl }
      })
      setTaskMedia(withUrls)
    }
  }

  async function addTaskComment() {
    if (!commentText.trim() || !selected) return
    await supabase.from('task_occurrence_comments').insert({
      occurrence_id: selected.id,
      comment_text: commentText.trim(),
      created_by: session.user.id
    })
    setCommentText('')
    loadTaskComments(selected.id)
  }

  async function uploadTaskMedia(e) {
    const files = Array.from(e.target.files)
    if (!files.length || !selected) return
    setUploadingMedia(true)
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `tasks/${selected.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('task-photos').upload(path, file, { contentType: file.type })
      if (!error) {
        await supabase.from('task_photos').insert({
          occurrence_id: selected.id,
          storage_path: path,
          file_name: file.name,
          file_type: file.type.startsWith('video/') ? 'video' : 'image',
          uploaded_by: session.user.id
        })
      }
    }
    setUploadingMedia(false)
    loadTaskMedia(selected.id)
    e.target.value = ''
  }

  async function completeTask(uploadedFiles = []) {
    if (!selected) return
    const { data: completion } = await supabase.from('task_completions').insert({
      occurrence_id: selected.id,
      completed_by: session.user.id,
      notes: note
    }).select().single()

    // Save photo records
    if (completion && uploadedFiles.length > 0) {
      await supabase.from('task_photos').insert(
        uploadedFiles.map(f => ({
          occurrence_id: selected.id,
          completion_id: completion.id,
          storage_path: f.path,
          file_name: f.name,
          file_type: f.type,
          uploaded_by: session.user.id
        }))
      )
    }

    await supabase.from('task_occurrences').update({ status: 'completed' }).eq('id', selected.id)
    await supabase.from('audit_log').insert({
      actor_id: session.user.id,
      action: 'task_completed',
      entity_type: 'task_occurrence',
      entity_id: selected.id
    })
    setSignOff(false)
    setSelected(null)
    setNote('')
    setPhotoTaken(false)
    loadTasks()
  }

  // Use CST date (UTC-6)
  const today = new Date(new Date().toLocaleString('en-US', {timeZone: 'America/Chicago'})).toLocaleDateString('en-CA')
  // due_date may come back as full timestamp — normalize to date string
  const normalize = (d) => d ? d.substring(0, 10) : ''
  const overdue = tasks.filter(t => t.status !== 'completed' && normalize(t.due_date) < today)
  const pending = tasks.filter(t => t.status === 'pending' && normalize(t.due_date) <= today)
  const done = tasks.filter(t => t.status === 'completed')
  const total = tasks.length
  const doneCount = done.length

  const applyFilter = (list) => {
    if (filter === 'all') return list
    return list
  }

  if (signOff && selected) return (
    <SignOffScreen
      selected={selected}
      session={session}
      onComplete={completeTask}
      onCancel={() => setSignOff(false)}
      note={note}
      setNote={setNote}
      photoTaken={photoTaken}
      setPhotoTaken={setPhotoTaken}
    />
  )

  if (selected) return (
    <div>
      <div className="topbar">
        <button onClick={() => setSelected(null)} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
        <h1>{selected.task?.title}</h1>
        <p>{selected.task?.category?.name} · {selected.task?.asset?.name || '—'}</p>
      </div>
      <div className="content">
        <div style={{marginBottom:10}}>
          {selected.status === 'completed' ? <span className="badge badge-done">Completed</span>
          : selected.due_date < today ? <span className="badge badge-overdue">Overdue</span>
          : <span className="badge badge-due">Due today</span>}
        </div>
        {selected.task?.instructions && (
          <div style={{background:'#f8f8f8',borderRadius:8,padding:12,marginBottom:12}}>
            <p style={{fontSize:12,fontWeight:500,color:'#555',marginBottom:4}}>Instructions</p>
            <p style={{fontSize:13,color:'#333',lineHeight:1.55}}>{selected.task.instructions}</p>
          </div>
        )}
        <div style={{background:'#f8f8f8',borderRadius:8,padding:10,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <div><p style={{fontSize:10,color:'#888'}}>Asset</p><p style={{fontSize:12,fontWeight:500}}>{selected.task?.asset?.name || '—'}</p></div>
          <div><p style={{fontSize:10,color:'#888'}}>Frequency</p><p style={{fontSize:12,fontWeight:500}}>{selected.task?.frequency}</p></div>
          <div><p style={{fontSize:10,color:'#888'}}>Priority</p><p style={{fontSize:12,fontWeight:500}}>{selected.task?.priority || 'normal'}</p></div>
          <div><p style={{fontSize:10,color:'#888'}}>Photo req.</p><p style={{fontSize:12,fontWeight:500}}>{selected.task?.photo_required ? 'Yes' : 'No'}</p></div>
        </div>
        {selected.status !== 'completed' && (
          <>
            <button className="btn btn-success" onClick={() => setSignOff(true)}>✓ Mark complete</button>
            <button className="btn btn-warn" onClick={async () => {
              await supabase.from('task_occurrences').update({status:'needs_attention'}).eq('id', selected.id)
              setSelected(null); loadTasks()
            }}>⚠ Needs attention</button>
            <button className="btn btn-secondary" onClick={async () => {
              await supabase.from('task_occurrences').update({status:'skipped'}).eq('id', selected.id)
              setSelected(null); loadTasks()
            }}>Skip with note</button>
          </>
        )}

        {/* Photos & videos */}
        <div className="section-label">Photos & videos</div>
        {taskMedia.length > 0 && (
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
            {taskMedia.map(m => (
              <div key={m.id} style={{aspectRatio:'1',borderRadius:8,overflow:'hidden',background:'#f0f0f0'}}>
                {m.file_type==='video'
                  ? <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',background:'#1a1a1a',flexDirection:'column',gap:4}}><span style={{fontSize:20}}>▶</span><span style={{fontSize:9,color:'#aaa'}}>VIDEO</span></div>
                  : m.url ? <img src={m.url} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}}/> : null}
              </div>
            ))}
          </div>
        )}
        <input ref={taskFileRef} type="file" accept="image/*,video/*" multiple style={{display:'none'}} onChange={uploadTaskMedia}/>
        <button onClick={() => taskFileRef.current.click()} disabled={uploadingMedia} style={{
          width:'100%',padding:'8px 14px',borderRadius:8,border:'0.5px solid #ddd',
          background:'#f8f8f8',color:'#555',fontSize:12,cursor:'pointer',
          fontFamily:'inherit',marginBottom:12,opacity:uploadingMedia?0.6:1,
          display:'flex',alignItems:'center',justifyContent:'center',gap:6
        }}>
          {uploadingMedia ? '⏳ Uploading…' : '📎 Attach photo / video'}
        </button>

        {/* Comments */}
        <div className="section-label">Comments ({taskComments.length})</div>
        <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:'0 12px',marginBottom:8}}>
          {taskComments.length === 0
            ? <p style={{padding:'12px 0',fontSize:12,color:'#aaa',textAlign:'center'}}>No comments yet.</p>
            : taskComments.map(c => (
              <div key={c.id} style={{padding:'9px 0',borderBottom:'0.5px solid #f5f5f5'}}>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:4}}>
                  <div style={{width:22,height:22,borderRadius:'50%',background:'#E6F1FB',color:'#0C447C',display:'flex',alignItems:'center',justifyContent:'center',fontSize:9,fontWeight:600,flexShrink:0}}>
                    {c.created_profile?.avatar_initials || '?'}
                  </div>
                  <span style={{fontSize:11,fontWeight:500,color:'#333'}}>{c.created_profile?.full_name || 'Unknown'}</span>
                  <span style={{fontSize:10,color:'#aaa'}}>{format(new Date(c.created_at),'MMM d · h:mm a')}</span>
                </div>
                <div style={{fontSize:12,color:'#444',lineHeight:1.5,paddingLeft:29}}>{c.comment_text}</div>
              </div>
            ))
          }
        </div>
        <div style={{display:'flex',gap:8,marginBottom:12}}>
          <input className="form-input" style={{flex:1}} value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder="Add a comment…"
            onKeyDown={e => e.key==='Enter' && addTaskComment()}/>
          <button onClick={addTaskComment} style={{padding:'9px 14px',borderRadius:8,border:'none',background:'#1A4F8A',color:'#fff',fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:500,flexShrink:0}}>Post</button>
        </div>
      </div>
    </div>
  )

  function openTask(t) {
    setSelected(t)
    setTaskComments([])
    setTaskMedia([])
    setCommentText('')
    loadTaskComments(t.id)
    loadTaskMedia(t.id)
  }

  return (
    <div>
      <div className="topbar">
        <div className="topbar-row">
          <div>
            <h1>Alligator Landing</h1>
            <p>{format(new Date(), 'EEEE, MMMM d')}</p>
          </div>
          <div className="avatar" style={{width:28,height:28,fontSize:11,background:'rgba(255,255,255,0.25)',color:'#fff'}}>
            {profile?.avatar_initials || '?'}
          </div>
        </div>
      </div>
      <div className="content">

        {/* Summary ring */}
        <div className="summary-card">
          <svg width="60" height="60" viewBox="0 0 60 60">
            <circle cx="30" cy="30" r="24" fill="none" stroke="#B5D4F4" strokeWidth="5"/>
            <circle cx="30" cy="30" r="24" fill="none" stroke="#1A4F8A" strokeWidth="5"
              strokeDasharray="150.8"
              strokeDashoffset={total > 0 ? (150.8 - (150.8 * doneCount / total)).toFixed(2) : 150.8}
              strokeLinecap="round" transform="rotate(-90 30 30)"/>
            <text x="30" y="34" textAnchor="middle" fontSize="12" fontWeight="600" fill="#0C447C">
              {doneCount}/{total}
            </text>
          </svg>
          <div>
            <div style={{fontSize:15,fontWeight:600,color:'#0C447C'}}>{doneCount} of {total} tasks done</div>
            <div style={{fontSize:12,color:'#185FA5',marginTop:2}}>{overdue.length} overdue · {pending.length} remaining</div>
          </div>
        </div>

        {/* Filter pills */}
        <div style={{display:'flex',gap:5,marginBottom:10,flexWrap:'wrap'}}>
          {['all','overdue','pending','done'].map(f => (
            <button key={f} className={`filter-pill${filter===f?' active':''}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase()+f.slice(1)}
            </button>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <div style={{background:'#FCEBEB',borderRadius:8,padding:12,marginBottom:10,fontSize:12,color:'#A32D2D'}}>
            ⚠ {error}
          </div>
        )}

        {loading ? (
          <p style={{textAlign:'center',color:'#888',padding:'32px 0',fontSize:13}}>Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <div style={{textAlign:'center',padding:'48px 0'}}>
            <p style={{fontSize:32,marginBottom:10}}>✅</p>
            <p style={{fontSize:15,fontWeight:600,color:'#333',marginBottom:4}}>All caught up!</p>
            <p style={{fontSize:13,color:'#888'}}>No tasks due today.</p>
          </div>
        ) : (
          <>
            {(filter === 'all' || filter === 'overdue') && overdue.length > 0 && (
              <>
                <div className="section-label">Overdue</div>
                {overdue.map(t => <TaskCard key={t.id} task={t} onClick={() => setSelected(t)} />)}
              </>
            )}
            {(filter === 'all' || filter === 'pending') && pending.length > 0 && (
              <>
                <div className="section-label">Today</div>
                {pending.map(t => <TaskCard key={t.id} task={t} onClick={() => setSelected(t)} />)}
              </>
            )}
            {(filter === 'all' || filter === 'done') && done.length > 0 && (
              <>
                <div className="section-label">Completed</div>
                {done.map(t => <TaskCard key={t.id} task={t} onClick={() => setSelected(t)} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SignOffScreen({ selected, session, onComplete, onCancel, note, setNote, photoTaken, setPhotoTaken }) {
  const fileRef = useRef()
  const [uploading, setUploading] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState([])

  async function handleFiles(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    setUploading(true)
    const newFiles = []
    for (const file of files) {
      const ext = file.name.split('.').pop()
      const path = `tasks/${selected.id}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('task-photos').upload(path, file, { contentType: file.type })
      if (!error) {
        newFiles.push({ path, name: file.name, type: file.type.startsWith('video/') ? 'video' : 'image' })
      }
    }
    setUploadedFiles(prev => [...prev, ...newFiles])
    setPhotoTaken(true)
    setUploading(false)
    e.target.value = ''
  }

  return (
    <div>
      <div className="topbar">
        <button onClick={onCancel} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
        <h1>Sign off task</h1>
        <p>{selected.task?.title}</p>
      </div>
      <div className="content">
        <p style={{fontSize:13,color:'#666',marginBottom:12}}>Confirm completion with a photo and notes.</p>

        {/* Photo upload */}
        <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{display:'none'}} onChange={handleFiles}/>
        <div style={{marginBottom:12}}>
          {uploadedFiles.length > 0 && (
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6,marginBottom:8}}>
              {uploadedFiles.map((f,i) => (
                <div key={i} style={{aspectRatio:'1',borderRadius:8,background:'#EAF3DE',display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:4}}>
                  <span style={{fontSize:20}}>{f.type==='video'?'🎥':'📷'}</span>
                  <span style={{fontSize:9,color:'#3B6D11',textAlign:'center',padding:'0 4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'100%'}}>{f.name}</span>
                </div>
              ))}
            </div>
          )}
          <button onClick={() => fileRef.current.click()} disabled={uploading} style={{
            width:'100%',padding:12,borderRadius:8,
            border:`1.5px dashed ${photoTaken?'#3B6D11':'#ccc'}`,
            background:photoTaken?'#EAF3DE':'none',
            color:photoTaken?'#3B6D11':'#888',
            fontSize:13,cursor:'pointer',fontFamily:'inherit'
          }}>
            {uploading ? '⏳ Uploading…' : photoTaken ? `✓ ${uploadedFiles.length} file${uploadedFiles.length!==1?'s':''} attached — tap to add more` : '📷 Tap to take photo or choose from library'}
          </button>
        </div>

        <div className="form-group">
          <label className="form-label">Notes (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} className="form-input" rows={3} placeholder="Any observations or issues…" style={{resize:'none'}}/>
        </div>
        <div style={{background:'#f5f5f5',borderRadius:8,padding:10,marginBottom:14,fontSize:12,color:'#666'}}>
          📍 GPS location will be recorded · {format(new Date(), 'h:mm a')}
        </div>
        <button className="btn btn-success" onClick={() => onComplete(uploadedFiles)}>✓ Confirm sign-off</button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function TaskCard({ task, onClick }) {
  const cat = CATS[task.task?.category?.name] || { bg: '#f0f0f0', color: '#444' }
  const status = task.status
  return (
    <div className="task-card" onClick={onClick}>
      <div className="task-icon" style={{background: cat.bg, color: cat.color}}>
        {task.task?.category?.name?.charAt(0) || '?'}
      </div>
      <div style={{flex:1,minWidth:0}}>
        <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
          {task.task?.title || 'Unknown task'}
        </div>
        <div style={{fontSize:11,color:'#666',marginTop:2}}>
          {status === 'completed' ? <span className="badge badge-done">Done</span>
          : status === 'overdue' ? <span className="badge badge-overdue">Overdue</span>
          : <span className="badge badge-due">Due</span>}
          {task.task?.asset?.name ? ` · ${task.task.asset.name}` : ''}
        </div>
      </div>
      <div className={`check-btn${status==='completed'?' done':''}`}>
        {status === 'completed' && '✓'}
      </div>
    </div>
  )
}
