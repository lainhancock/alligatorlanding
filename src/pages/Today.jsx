import { useState, useEffect } from 'react'
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
    const today = format(new Date(), 'yyyy-MM-dd')

    // Step 1 — get occurrences
    const { data: occurrences, error: occErr } = await supabase
      .from('task_occurrences')
      .select('*')
      .lte('due_date', today)
      .order('due_date', { ascending: true })

    if (occErr) { setError('Occurrences error: ' + occErr.message); setLoading(false); return }
    if (!occurrences || occurrences.length === 0) { 
      setError('Query returned 0 rows — session: ' + session.user.id)
      setTasks([]); setLoading(false); return 
    }

    // Step 2 — get task details for each occurrence
    const taskIds = [...new Set(occurrences.map(o => o.task_id))]
    const { data: taskData, error: taskErr } = await supabase
      .from('tasks')
      .select('*, category:categories(*), asset:assets(*)')
      .in('id', taskIds)

    if (taskErr) { setError('Tasks error: ' + taskErr.message); setLoading(false); return }

    // Step 3 — merge
    const taskMap = {}
    taskData?.forEach(t => { taskMap[t.id] = t })

    const merged = occurrences.map(o => ({
      ...o,
      task: taskMap[o.task_id] || null
    }))

    setTasks(merged)
    setLoading(false)
  }

  async function completeTask() {
    if (!selected) return
    await supabase.from('task_completions').insert({
      occurrence_id: selected.id,
      completed_by: session.user.id,
      notes: note
    })
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

  const today = format(new Date(), 'yyyy-MM-dd')
  const overdue = tasks.filter(t => t.status !== 'completed' && t.due_date < today)
  const pending = tasks.filter(t => t.status === 'pending' && t.due_date === today)
  const done = tasks.filter(t => t.status === 'completed')
  const total = tasks.length
  const doneCount = done.length

  const applyFilter = (list) => {
    if (filter === 'all') return list
    return list
  }

  if (signOff && selected) return (
    <div>
      <div className="topbar">
        <button onClick={() => setSignOff(false)} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
        <h1>Sign off task</h1>
        <p>{selected.task?.title}</p>
      </div>
      <div className="content">
        <p style={{fontSize:13,color:'#666',marginBottom:12}}>Confirm completion with a photo and notes.</p>
        <div className={`photo-area${photoTaken?' taken':''}`} onClick={() => setPhotoTaken(!photoTaken)}>
          {photoTaken ? '✓ Photo taken — tap to retake' : '📷 Tap to take photo'}
        </div>
        <div className="form-group">
          <label className="form-label">Notes (optional)</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} className="form-input" rows={3} placeholder="Any observations or issues…" style={{resize:'none'}}/>
        </div>
        <div style={{background:'#f5f5f5',borderRadius:8,padding:10,marginBottom:14,fontSize:12,color:'#666'}}>
          📍 GPS location will be recorded · {format(new Date(), 'h:mm a')}
        </div>
        <button className="btn btn-success" onClick={completeTask}>✓ Confirm sign-off</button>
        <button className="btn btn-secondary" onClick={() => setSignOff(false)}>Cancel</button>
      </div>
    </div>
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
      </div>
    </div>
  )

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
