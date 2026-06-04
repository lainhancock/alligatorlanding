import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, startOfWeek, addDays, isSameDay } from 'date-fns'

export default function Week({ session }) {
  const [tasks, setTasks] = useState([])
  const [selectedDay, setSelectedDay] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 0 })
  const days = Array.from({length: 7}, (_, i) => addDays(weekStart, i))

  useEffect(() => { loadWeekTasks() }, [])

  async function loadWeekTasks() {
    const start = format(weekStart, 'yyyy-MM-dd')
    const end = format(addDays(weekStart, 6), 'yyyy-MM-dd')
    const { data } = await supabase
      .from('task_occurrences')
      .select('*, task:tasks(title, category:categories(name))')
      .gte('due_date', start)
      .lte('due_date', end)
      .order('due_date')
    if (data) setTasks(data)
    setLoading(false)
  }

  const dayTasks = tasks.filter(t => t.due_date === format(selectedDay, 'yyyy-MM-dd'))
  const done = dayTasks.filter(t => t.status === 'completed').length

  return (
    <div>
      <div className="topbar">
        <h1>Alligator Landing</h1>
        <p>Week of {format(weekStart, 'MMM d')} – {format(addDays(weekStart, 6), 'MMM d')}</p>
      </div>
      <div className="content">
        <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:4,marginBottom:14}}>
          {days.map(day => {
            const dt = tasks.filter(t => t.due_date === format(day, 'yyyy-MM-dd'))
            const hasOverdue = dt.some(t => t.status === 'overdue')
            const allDone = dt.length > 0 && dt.every(t => t.status === 'completed')
            const dotColor = hasOverdue ? '#E24B4A' : allDone ? '#1D9E75' : '#378ADD'
            const isToday = isSameDay(day, new Date())
            const isSel = isSameDay(day, selectedDay)
            return (
              <div key={day.toISOString()} style={{textAlign:'center'}} onClick={() => setSelectedDay(day)}>
                <div style={{fontSize:10,color:'#888',marginBottom:4}}>
                  {format(day,'EEE').charAt(0)}
                </div>
                <div style={{
                  width:30,height:30,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',
                  fontSize:13,fontWeight:500,margin:'0 auto 4px',cursor:'pointer',
                  background: isToday ? '#1A4F8A' : isSel && !isToday ? '#E6F1FB' : 'none',
                  color: isToday ? '#fff' : isSel && !isToday ? '#0C447C' : '#1a1a1a'
                }}>
                  {format(day,'d')}
                </div>
                {dt.length > 0 ? (
                  <div style={{width:5,height:5,borderRadius:'50%',background:dotColor,margin:'0 auto'}}/>
                ) : <div style={{height:5}}/>}
              </div>
            )
          })}
        </div>

        <div className="section-label">{format(selectedDay, 'EEEE, MMMM d')}</div>

        {loading ? <p style={{color:'#888',fontSize:13}}>Loading…</p>
        : dayTasks.length === 0 ? <p style={{color:'#888',fontSize:13,padding:'12px 0'}}>No tasks scheduled</p>
        : dayTasks.map(t => (
          <div key={t.id} className="task-card" style={{cursor:'default'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:500}}>{t.task?.title}</div>
              <div style={{fontSize:11,color:'#888',marginTop:2}}>{t.task?.category?.name}</div>
            </div>
            {t.status === 'completed' ? <span className="badge badge-done">Done</span>
            : t.status === 'overdue' ? <span className="badge badge-overdue">Overdue</span>
            : <span className="badge badge-due">Scheduled</span>}
          </div>
        ))}

        <div className="section-label" style={{marginTop:16}}>This week</div>
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-num">{tasks.length}</div><div className="stat-lbl">Total tasks</div></div>
          <div className="stat-card"><div className="stat-num" style={{color:'#3B6D11'}}>{tasks.filter(t=>t.status==='completed').length}</div><div className="stat-lbl">Completed</div></div>
          <div className="stat-card"><div className="stat-num" style={{color:'#A32D2D'}}>{tasks.filter(t=>t.status==='overdue').length}</div><div className="stat-lbl">Overdue</div></div>
          <div className="stat-card"><div className="stat-num">{tasks.filter(t=>t.status==='pending').length}</div><div className="stat-lbl">Pending</div></div>
        </div>
      </div>
    </div>
  )
}
