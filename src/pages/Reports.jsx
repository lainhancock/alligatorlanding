import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format, subDays, startOfDay } from 'date-fns'

const PERIODS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

function StatCard({ label, value, sub, color, onClick }) {
  return (
    <div onClick={onClick} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:12,textAlign:'center',cursor:onClick?'pointer':'default',position:'relative'}}>
      <div style={{fontSize:26,fontWeight:700,color:color||'#1A4F8A'}}>{value}</div>
      <div style={{fontSize:11,fontWeight:500,color:'#333',marginTop:2}}>{label}</div>
      {sub && <div style={{fontSize:10,color:'#888',marginTop:2}}>{sub}</div>}
      {onClick && <div style={{fontSize:9,color:'#aaa',marginTop:4}}>tap to view</div>}
    </div>
  )
}

// Drill-down modal
function DrillDown({ title, items, onClose }) {
  if (!items || items.length === 0) return null
  return (
    <div style={{position:'fixed',top:0,left:0,right:0,bottom:0,background:'rgba(0,0,0,0.5)',zIndex:1000,display:'flex',flexDirection:'column',justifyContent:'flex-end'}}>
      <div style={{background:'#fff',borderRadius:'16px 16px 0 0',maxHeight:'75vh',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'16px 16px 12px',borderBottom:'0.5px solid #eee'}}>
          <div style={{fontSize:14,fontWeight:600,color:'#333'}}>{title}</div>
          <button onClick={onClose} style={{background:'#f0f0f0',border:'none',borderRadius:20,padding:'4px 12px',fontSize:12,cursor:'pointer',color:'#555'}}>Close</button>
        </div>
        <div style={{overflowY:'auto',padding:'0 16px 16px'}}>
          {items.map((item, i) => (
            <div key={i} style={{padding:'10px 0',borderBottom:'0.5px solid #f5f5f5'}}>
              <div style={{fontSize:13,fontWeight:500,color:'#333',marginBottom:3}}>{item.title}</div>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {item.tags?.map((tag, j) => (
                  <span key={j} style={{fontSize:10,padding:'2px 7px',borderRadius:10,background:tag.bg||'#f0f0f0',color:tag.color||'#555',fontWeight:500}}>{tag.label}</span>
                ))}
              </div>
              {item.sub && <div style={{fontSize:11,color:'#888',marginTop:3}}>{item.sub}</div>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ title }) {
  return <div style={{fontSize:12,fontWeight:600,color:'#555',textTransform:'uppercase',letterSpacing:0.5,marginTop:20,marginBottom:8,paddingBottom:4,borderBottom:'0.5px solid #eee'}}>{title}</div>
}

function BarRow({ label, value, max, color }) {
  const pct = max > 0 ? Math.round((value/max)*100) : 0
  return (
    <div style={{marginBottom:8}}>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
        <span style={{color:'#333'}}>{label}</span>
        <span style={{color:'#888',fontWeight:500}}>{value}</span>
      </div>
      <div style={{height:6,background:'#f0f0f0',borderRadius:3,overflow:'hidden'}}>
        <div style={{height:6,width:`${pct}%`,background:color||'#1A4F8A',borderRadius:3,transition:'width 0.5s'}}/>
      </div>
    </div>
  )
}

export default function Reports({ session }) {
  const [period, setPeriod] = useState(30)
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [drillDown, setDrillDown] = useState(null) // { title, items }

  useEffect(() => { loadData() }, [period])

  async function loadData() {
    setLoading(true)
    const since = subDays(new Date(), period).toISOString().slice(0, 10)
    const today = new Date().toISOString().slice(0, 10)

    const [
      { data: occurrences },
      { data: workOrders },
      { data: notes },
      { data: huntLogs },
      { data: animals },
      { data: feeders },
      { data: profiles },
      { data: events },
    ] = await Promise.all([
      supabase.from('task_occurrences').select('*, task:tasks(title, category_id, assigned_to_name), assigned_profile:profiles!task_occurrences_assigned_to_fkey(full_name)').gte('due_date', since).lte('due_date', today),
      supabase.from('work_orders').select('*').gte('created_at', subDays(new Date(), period).toISOString()).is('deleted_at', null),
      supabase.from('property_notes').select('*').gte('created_at', subDays(new Date(), period).toISOString()).is('deleted_at', null),
      supabase.from('hunt_logs').select('*, blind:hunting_blinds(name)').gte('hunt_date', since).is('deleted_at', null),
      supabase.from('animal_inventory').select('*'),
      supabase.from('feeders').select('*').eq('active', true),
      supabase.from('profiles').select('full_name').eq('active', true),
      supabase.from('events').select('*').gte('created_at', subDays(new Date(), period).toISOString()).is('deleted_at', null),
    ])

    // ── TASK STATS ─────────────────────────────────────────
    const totalTasks = occurrences?.length || 0
    const completedTasks = occurrences?.filter(o => o.status === 'completed').length || 0
    const skippedTasks = occurrences?.filter(o => o.status === 'skipped').length || 0
    const needsAttn = occurrences?.filter(o => o.status === 'needs_attention').length || 0
    const overdueTasks = occurrences?.filter(o => o.status === 'pending' && o.due_date < today).length || 0
    const completionRate = totalTasks > 0 ? Math.round((completedTasks/totalTasks)*100) : 0

    // By crew member
    const byCrewMap = {}
    occurrences?.forEach(o => {
      const name = o.assigned_profile?.full_name || o.task?.assigned_to_name || 'Unassigned'
      if (!byCrewMap[name]) byCrewMap[name] = { total: 0, completed: 0 }
      byCrewMap[name].total++
      if (o.status === 'completed') byCrewMap[name].completed++
    })
    const byCrew = Object.entries(byCrewMap).map(([name, s]) => ({ name, ...s, rate: s.total > 0 ? Math.round((s.completed/s.total)*100) : 0 })).sort((a,b) => b.rate - a.rate)

    // ── WORK ORDER STATS ───────────────────────────────────
    const totalWOs = workOrders?.length || 0
    const openWOs = workOrders?.filter(w => w.status === 'open').length || 0
    const inProgressWOs = workOrders?.filter(w => w.status === 'inprogress').length || 0
    const doneWOs = workOrders?.filter(w => w.status === 'done').length || 0
    const blockedWOs = workOrders?.filter(w => w.status === 'blocked').length || 0
    const criticalWOs = workOrders?.filter(w => w.priority === 'crit' && w.status !== 'done').length || 0

    // By asset
    const woByAsset = {}
    workOrders?.forEach(w => {
      const asset = w.asset || 'General'
      woByAsset[asset] = (woByAsset[asset] || 0) + 1
    })
    const topAssets = Object.entries(woByAsset).sort((a,b) => b[1]-a[1]).slice(0, 5)

    // ── NOTES STATS ────────────────────────────────────────
    const totalNotes = notes?.length || 0
    const urgentNotes = notes?.filter(n => n.flag === 'urgent').length || 0
    const reviewNotes = notes?.filter(n => n.flag === 'review').length || 0

    // ── HUNTING STATS ──────────────────────────────────────
    const totalHunts = huntLogs?.length || 0
    const totalHarvests = huntLogs?.filter(l => l.harvest && l.harvest !== 'No harvest').length || 0
    const totalSightings = huntLogs?.reduce((a, l) => a + (l.sightings || 0), 0) || 0
    const harvestRate = totalHunts > 0 ? Math.round((totalHarvests/totalHunts)*100) : 0

    // By blind
    const byBlind = {}
    huntLogs?.forEach(l => {
      const blind = l.blind?.name || 'Unknown'
      if (!byBlind[blind]) byBlind[blind] = { hunts: 0, harvests: 0 }
      byBlind[blind].hunts++
      if (l.harvest && l.harvest !== 'No harvest') byBlind[blind].harvests++
    })
    const topBlinds = Object.entries(byBlind).sort((a,b) => b[1].hunts - a[1].hunts).slice(0, 5)

    // By species harvested
    const bySpecies = {}
    huntLogs?.filter(l => l.harvest && l.harvest !== 'No harvest').forEach(l => {
      bySpecies[l.harvest] = (bySpecies[l.harvest] || 0) + 1
    })

    // ── ANIMAL STATS ───────────────────────────────────────
    const activeAnimals = animals?.filter(a => a.status === 'Active') || []
    const totalAnimals = activeAnimals.length
    const bySpeciesMap = {}
    activeAnimals.forEach(a => {
      bySpeciesMap[a.species] = (bySpeciesMap[a.species] || 0) + 1
    })
    const totalValue = animals?.filter(a => a.purchase_price).reduce((s, a) => s + parseFloat(a.purchase_price || 0), 0) || 0
    const bornOnProperty = animals?.filter(a => a.acquisition_type === 'Born on property').length || 0

    // ── FEEDER STATS ───────────────────────────────────────
    const lowFeeders = feeders?.filter(f => f.fill_level <= 25).length || 0
    const avgFill = feeders?.length > 0 ? Math.round(feeders.reduce((s, f) => s + (f.fill_level || 0), 0) / feeders.length) : 0

    // ── EVENT STATS ────────────────────────────────────────
    const totalEvents = events?.length || 0
    const avgGuests = totalEvents > 0 ? Math.round(events.reduce((s, e) => s + (e.guest_count || 0), 0) / totalEvents) : 0

    setData({
      rawOccurrences: occurrences,
      rawWorkOrders: workOrders,
      rawNotes: notes,
      tasks: { total: totalTasks, completed: completedTasks, skipped: skippedTasks, needsAttn, overdue: overdueTasks, rate: completionRate, byCrew },
      workOrders: { total: totalWOs, open: openWOs, inProgress: inProgressWOs, done: doneWOs, blocked: blockedWOs, critical: criticalWOs, topAssets },
      notes: { total: totalNotes, urgent: urgentNotes, review: reviewNotes },
      hunting: { hunts: totalHunts, harvests: totalHarvests, sightings: totalSightings, rate: harvestRate, topBlinds, bySpecies },
      animals: { total: totalAnimals, bySpecies: bySpeciesMap, value: totalValue, bornOnProperty },
      feeders: { low: lowFeeders, avgFill, total: feeders?.length || 0 },
      events: { total: totalEvents, avgGuests },
    })
    setLoading(false)
  }

  if (loading) return (
    <div style={{padding:24,textAlign:'center',color:'#888',fontSize:13}}>Loading reports…</div>
  )

  const d = data

  function showOverdue() {
    const today = new Date().toISOString().slice(0, 10)
    const items = data.rawOccurrences?.filter(o => o.status === 'pending' && o.due_date < today).map(o => ({
      title: o.task?.title || 'Unknown task',
      tags: [
        { label: o.due_date, bg:'#FCEBEB', color:'#A32D2D' },
        { label: o.assigned_profile?.full_name || o.task?.assigned_to_name || 'Unassigned', bg:'#f0f0f0', color:'#555' }
      ],
      sub: `Due: ${o.due_date}`
    })) || []
    setDrillDown({ title: 'Overdue tasks', items })
  }

  function showCompleted() {
    const items = data.rawOccurrences?.filter(o => o.status === 'completed').map(o => ({
      title: o.task?.title || 'Unknown task',
      tags: [
        { label: 'Completed', bg:'#EAF3DE', color:'#3B6D11' },
        { label: o.assigned_profile?.full_name || o.task?.assigned_to_name || 'Unassigned', bg:'#f0f0f0', color:'#555' }
      ],
      sub: `Due: ${o.due_date}`
    })) || []
    setDrillDown({ title: 'Completed tasks', items })
  }

  function showOpenWOs() {
    const items = data.rawWorkOrders?.filter(w => w.status !== 'done').map(w => ({
      title: w.title,
      tags: [
        { label: w.status, bg: w.status==='blocked'?'#FAEEDA':w.status==='inprogress'?'#E6F1FB':'#f0f0f0', color: w.status==='blocked'?'#854F0B':w.status==='inprogress'?'#185FA5':'#555' },
        { label: w.priority||'normal', bg: w.priority==='crit'?'#FCEBEB':w.priority==='high'?'#FAEEDA':'#f0f0f0', color: w.priority==='crit'?'#A32D2D':w.priority==='high'?'#854F0B':'#555' },
        { label: w.assigned_to_name||'Unassigned', bg:'#f0f0f0', color:'#555' }
      ],
      sub: w.due_date ? `Due: ${w.due_date}` : null
    })) || []
    setDrillDown({ title: 'Open work orders', items })
  }

  function showUrgentNotes() {
    const items = data.rawNotes?.filter(n => n.flag === 'urgent' || n.flag === 'review').map(n => ({
      title: n.text,
      tags: [
        { label: n.flag === 'urgent' ? 'Urgent' : 'Needs review', bg: n.flag==='urgent'?'#FCEBEB':'#FAEEDA', color: n.flag==='urgent'?'#A32D2D':'#854F0B' },
        { label: n.asset || 'General', bg:'#f0f0f0', color:'#555' }
      ],
      sub: n.created_at ? `Logged: ${new Date(n.created_at).toLocaleDateString()}` : null
    })) || []
    setDrillDown({ title: 'Flagged observations', items })
  }

  return (
    <div style={{padding:'16px 16px 32px'}}>
      {drillDown && <DrillDown title={drillDown.title} items={drillDown.items} onClose={() => setDrillDown(null)}/>}
      {/* Period selector */}
      <div style={{display:'flex',gap:6,marginBottom:16}}>
        {PERIODS.map(p => (
          <button key={p.days} onClick={() => setPeriod(p.days)} style={{
            flex:1,padding:'8px 4px',borderRadius:8,border:`1.5px solid ${period===p.days?'#1A4F8A':'#ddd'}`,
            background:period===p.days?'#E6F1FB':'none',color:period===p.days?'#1A4F8A':'#666',
            fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:period===p.days?600:400
          }}>{p.label}</button>
        ))}
      </div>

      {/* ── TASKS ── */}
      <SectionHeader title="Task completion"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
        <StatCard label="Completion rate" value={`${d.tasks.rate}%`} color={d.tasks.rate>=80?'#3B6D11':d.tasks.rate>=60?'#854F0B':'#A32D2D'}/>
        <StatCard label="Completed" value={d.tasks.completed} color="#3B6D11" onClick={d.tasks.completed>0?showCompleted:null}/>
        <StatCard label="Overdue" value={d.tasks.overdue} color="#A32D2D" onClick={d.tasks.overdue>0?showOverdue:null}/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
        <StatCard label="Total tasks" value={d.tasks.total}/>
        <StatCard label="Needs attention" value={d.tasks.needsAttn} color="#854F0B"/>
        <StatCard label="Skipped" value={d.tasks.skipped} color="#888"/>
      </div>
      {d.tasks.byCrew.length > 0 && (
        <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:12,marginBottom:4}}>
          <div style={{fontSize:11,fontWeight:500,color:'#555',marginBottom:10}}>Completion rate by crew member</div>
          {d.tasks.byCrew.map(c => (
            <BarRow key={c.name} label={`${c.name} (${c.completed}/${c.total})`} value={`${c.rate}%`} max={100} color={c.rate>=80?'#3B6D11':c.rate>=60?'#EF9F27':'#E24B4A'}/>
          ))}
        </div>
      )}

      {/* ── WORK ORDERS ── */}
      <SectionHeader title="Work orders"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
        <StatCard label="Total" value={d.workOrders.total}/>
        <StatCard label="Complete" value={d.workOrders.done} color="#3B6D11"/>
        <StatCard label="Critical open" value={d.workOrders.critical} color="#A32D2D"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
        <StatCard label="Open" value={d.workOrders.open} color="#555" onClick={d.workOrders.open>0?showOpenWOs:null}/>
        <StatCard label="In progress" value={d.workOrders.inProgress} color="#185FA5"/>
        <StatCard label="Blocked" value={d.workOrders.blocked} color="#854F0B"/>
      </div>
      {d.workOrders.topAssets.length > 0 && (
        <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:12,marginBottom:4}}>
          <div style={{fontSize:11,fontWeight:500,color:'#555',marginBottom:10}}>Work orders by asset</div>
          {d.workOrders.topAssets.map(([asset, count]) => (
            <BarRow key={asset} label={asset} value={count} max={d.workOrders.topAssets[0][1]} color="#1A4F8A"/>
          ))}
        </div>
      )}

      {/* ── OBSERVATIONS ── */}
      <SectionHeader title="Property observations"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:4}}>
        <StatCard label="Total notes" value={d.notes.total}/>
        <StatCard label="Urgent" value={d.notes.urgent} color="#A32D2D" onClick={(d.notes.urgent+d.notes.review)>0?showUrgentNotes:null}/>
        <StatCard label="Needs review" value={d.notes.review} color="#854F0B"/>
      </div>

      {/* ── HUNTING ── */}
      <SectionHeader title="Hunting"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
        <StatCard label="Total hunts" value={d.hunting.hunts}/>
        <StatCard label="Harvests" value={d.hunting.harvests} color="#3B6D11"/>
        <StatCard label="Harvest rate" value={`${d.hunting.rate}%`} color="#3B6D11"/>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:12}}>
        <StatCard label="Total sightings" value={d.hunting.sightings}/>
        <StatCard label="Sightings/hunt" value={d.hunting.hunts>0?Math.round(d.hunting.sightings/d.hunting.hunts):0}/>
      </div>
      {d.hunting.topBlinds.length > 0 && (
        <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:12,marginBottom:8}}>
          <div style={{fontSize:11,fontWeight:500,color:'#555',marginBottom:10}}>Activity by blind</div>
          {d.hunting.topBlinds.map(([blind, stats]) => (
            <BarRow key={blind} label={`${blind} (${stats.harvests} harvests)`} value={stats.hunts} max={d.hunting.topBlinds[0][1].hunts} color="#3D2008"/>
          ))}
        </div>
      )}
      {Object.keys(d.hunting.bySpecies).length > 0 && (
        <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:12,marginBottom:4}}>
          <div style={{fontSize:11,fontWeight:500,color:'#555',marginBottom:10}}>Harvests by species</div>
          {Object.entries(d.hunting.bySpecies).sort((a,b)=>b[1]-a[1]).map(([species, count]) => (
            <BarRow key={species} label={species} value={count} max={Math.max(...Object.values(d.hunting.bySpecies))} color="#3B6D11"/>
          ))}
        </div>
      )}

      {/* ── ANIMALS ── */}
      <SectionHeader title="Animal inventory"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12}}>
        <StatCard label="Active herd" value={d.animals.total} color="#2D5016"/>
        <StatCard label="Born on property" value={d.animals.bornOnProperty} color="#3B6D11"/>
        <StatCard label="Total investment" value={`$${Math.round(d.animals.value/1000)}k`} color="#185FA5"/>
      </div>
      {Object.keys(d.animals.bySpecies).length > 0 && (
        <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:12,marginBottom:4}}>
          <div style={{fontSize:11,fontWeight:500,color:'#555',marginBottom:10}}>Active herd by species</div>
          {Object.entries(d.animals.bySpecies).sort((a,b)=>b[1]-a[1]).map(([species, count]) => (
            <BarRow key={species} label={species} value={count} max={Math.max(...Object.values(d.animals.bySpecies))} color="#2D5016"/>
          ))}
        </div>
      )}

      {/* ── FEEDERS ── */}
      <SectionHeader title="Feeders"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:4}}>
        <StatCard label="Total feeders" value={d.feeders.total}/>
        <StatCard label="Avg fill level" value={`${d.feeders.avgFill}%`} color={d.feeders.avgFill>=75?'#3B6D11':d.feeders.avgFill>=50?'#854F0B':'#A32D2D'}/>
        <StatCard label="Need fill (≤25%)" value={d.feeders.low} color={d.feeders.low>0?'#A32D2D':'#3B6D11'}/>
      </div>

      {/* ── EVENTS ── */}
      <SectionHeader title="Events"/>
      <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:4}}>
        <StatCard label="Events" value={d.events.total}/>
        <StatCard label="Avg guests" value={d.events.avgGuests}/>
      </div>
    </div>
  )
}
