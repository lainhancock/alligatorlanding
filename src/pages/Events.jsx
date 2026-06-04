import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

const STRUCTURES = ['Main house','Lake house','OG Tiny House','Tiny House 2','Hangar','RO Shed','Equipment Shed']
const RVS = ['Toy Hauler','RV',"Jake's RV"]
const CREW = ['Juan','Lane','Scott','Jacob','Trace','Garrett','Delaney']

export default function Events({ session }) {
  const [events, setEvents] = useState([])
  const [view, setView] = useState('list') // list | schedule | checklist
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({
    event_type: 'arrival', name: '', event_date: '', guest_count: 0,
    guests_coming: true, flying_in: false, notify_hours_before: 48,
    meals_needed: false, special_instructions: '',
    structures: {}, rvs: {}
  })

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    const { data } = await supabase.from('events').select('*, created_by_profile:profiles!events_created_by_fkey(full_name)').order('event_date', {ascending: true})
    if (data) setEvents(data)
    setLoading(false)
  }

  async function saveEvent() {
    const { data: event } = await supabase.from('events').insert({
      event_type: form.event_type,
      name: form.name,
      event_date: form.event_date,
      guest_count: form.guest_count,
      guests_coming: form.guests_coming,
      flying_in: form.flying_in,
      notify_hours_before: form.notify_hours_before,
      special_instructions: form.special_instructions,
      created_by: session.user.id
    }).select().single()

    if (event) {
      // Save structure assignments
      const structInserts = Object.entries(form.structures)
        .filter(([,v]) => v !== 'skip')
        .map(([name, reset_level]) => ({ event_id: event.id, asset_id: null, reset_level, _name: name }))

      await loadEvents()
      setView('list')
    }
  }

  const upcoming = events.filter(e => new Date(e.event_date) >= new Date() && e.status !== 'completed')
  const past = events.filter(e => new Date(e.event_date) < new Date() || e.status === 'completed')

  if (view === 'schedule') return (
    <div>
      <div className="topbar">
        <button onClick={() => setView('list')} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10}}>← Back</button>
        <h1>Schedule {form.event_type}</h1>
        <p>Alligator Landing</p>
      </div>
      <div className="content">
        <div className="form-group">
          <label className="form-label">Event type</label>
          <div style={{display:'flex',gap:8,marginBottom:4}}>
            {['arrival','departure'].map(t => (
              <button key={t} onClick={() => setForm({...form,event_type:t})} style={{
                flex:1,padding:'10px 8px',borderRadius:8,border:'1.5px solid',
                borderColor: form.event_type===t ? '#1A4F8A' : '#ddd',
                background: form.event_type===t ? '#E6F1FB' : 'none',
                color: form.event_type===t ? '#1A4F8A' : '#666',
                fontWeight: form.event_type===t ? 600 : 400,
                cursor:'pointer',fontFamily:'inherit',fontSize:13
              }}>
                {t === 'arrival' ? '→ Arrival' : '← Departure'}
              </button>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Event name</label>
          <input className="form-input" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Johnson family, Hunting weekend…"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={form.event_date} onChange={e=>setForm({...form,event_date:e.target.value})}/>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Guests</label>
            <input className="form-input" type="number" value={form.guest_count} onChange={e=>setForm({...form,guest_count:parseInt(e.target.value)})} min={0}/>
          </div>
        </div>

        {form.event_type === 'arrival' && (
          <>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'#f8f8f8',borderRadius:8,marginBottom:8}}>
              <div>
                <div style={{fontSize:13,fontWeight:500}}>🚁 Flying in by helicopter</div>
                <div style={{fontSize:11,color:'#666',marginTop:2}}>Adds helipad & fuel section</div>
              </div>
              <div onClick={()=>setForm({...form,flying_in:!form.flying_in})} style={{
                width:40,height:22,borderRadius:11,background:form.flying_in?'#1A4F8A':'#ddd',
                cursor:'pointer',position:'relative',transition:'background 0.2s'
              }}>
                <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:2,left:form.flying_in?20:2,transition:'left 0.2s',boxShadow:'0 1px 2px rgba(0,0,0,0.2)'}}/>
              </div>
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'#f8f8f8',borderRadius:8,marginBottom:12}}>
              <div>
                <div style={{fontSize:13,fontWeight:500}}>🍽 Meals needed</div>
                <div style={{fontSize:11,color:'#666',marginTop:2}}>Add meal order task to checklist</div>
              </div>
              <div onClick={()=>setForm({...form,meals_needed:!form.meals_needed})} style={{
                width:40,height:22,borderRadius:11,background:form.meals_needed?'#1A4F8A':'#ddd',
                cursor:'pointer',position:'relative',transition:'background 0.2s'
              }}>
                <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:2,left:form.meals_needed?20:2,transition:'left 0.2s',boxShadow:'0 1px 2px rgba(0,0,0,0.2)'}}/>
              </div>
            </div>
          </>
        )}

        <div className="section-label">Structures</div>
        {STRUCTURES.map(s => (
          <div key={s} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:10,marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:500,marginBottom:7}}>{s}</div>
            <div style={{display:'flex',gap:5}}>
              {['full','light','skip'].map(r => (
                <button key={r} onClick={() => setForm({...form,structures:{...form.structures,[s]:r}})} style={{
                  flex:1,padding:'7px 4px',borderRadius:6,border:'0.5px solid',
                  borderColor: form.structures[s]===r ? (r==='full'?'#1D9E75':r==='light'?'#3C3489':'#999') : '#ddd',
                  background: form.structures[s]===r ? (r==='full'?'#EAF3DE':r==='light'?'#EEEDFE':'#f0f0f0') : 'none',
                  color: form.structures[s]===r ? (r==='full'?'#3B6D11':r==='light'?'#3C3489':'#666') : '#666',
                  fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight: form.structures[s]===r?600:400
                }}>
                  {r==='full'?'Full':r==='light'?'Light':'Skip'}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="section-label">RV logistics</div>
        {RVS.map(rv => (
          <div key={rv} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:10,marginBottom:6}}>
            <div style={{fontSize:13,fontWeight:500,marginBottom:7}}>{rv}</div>
            <div style={{display:'flex',gap:5,marginBottom:5}}>
              {['bring','skip'].map(a => (
                <button key={a} onClick={() => setForm({...form,rvs:{...form.rvs,[rv]:{...form.rvs[rv],action:a}}})} style={{
                  flex:1,padding:'7px',borderRadius:6,border:'0.5px solid',
                  borderColor: form.rvs[rv]?.action===a ? '#7E22CE' : '#ddd',
                  background: form.rvs[rv]?.action===a ? '#FDF4FF' : 'none',
                  color: form.rvs[rv]?.action===a ? '#7E22CE' : '#666',
                  fontSize:11,cursor:'pointer',fontFamily:'inherit'
                }}>
                  {a === 'bring' ? 'Bring' : 'Not needed'}
                </button>
              ))}
            </div>
            {form.rvs[rv]?.action === 'bring' && (
              <div style={{display:'flex',gap:5}}>
                {['keep','return'].map(a => (
                  <button key={a} onClick={() => setForm({...form,rvs:{...form.rvs,[rv]:{...form.rvs[rv],after_visit:a}}})} style={{
                    flex:1,padding:'7px',borderRadius:6,border:'0.5px solid',
                    borderColor: form.rvs[rv]?.after_visit===a ? (a==='keep'?'#1D9E75':'#854F0B') : '#ddd',
                    background: form.rvs[rv]?.after_visit===a ? (a==='keep'?'#EAF3DE':'#FAEEDA') : 'none',
                    color: form.rvs[rv]?.after_visit===a ? (a==='keep'?'#3B6D11':'#854F0B') : '#666',
                    fontSize:11,cursor:'pointer',fontFamily:'inherit'
                  }}>
                    {a === 'keep' ? 'Keep on site' : "Return to Jake's"}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        <div className="form-group" style={{marginTop:12}}>
          <label className="form-label">Notify crew</label>
          <select className="form-input" value={form.notify_hours_before} onChange={e=>setForm({...form,notify_hours_before:parseInt(e.target.value)})}>
            <option value={24}>24 hours before</option>
            <option value={48}>48 hours before</option>
            <option value={72}>72 hours before</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Special instructions</label>
          <textarea className="form-input" rows={3} value={form.special_instructions} onChange={e=>setForm({...form,special_instructions:e.target.value})} placeholder="Notes for crew…" style={{resize:'none'}}/>
        </div>

        <button className="btn btn-primary" onClick={saveEvent} disabled={!form.name||!form.event_date}>Schedule event</button>
        <button className="btn btn-secondary" onClick={() => setView('list')}>Cancel</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="topbar">
        <h1>Arrivals & Departures</h1>
        <p>Alligator Landing</p>
      </div>
      <div className="content">
        {loading ? <p style={{color:'#888',fontSize:13}}>Loading…</p> : (
          <>
            {upcoming.length > 0 && (
              <>
                <div className="section-label">Upcoming</div>
                {upcoming.map(e => <EventCard key={e.id} event={e} />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <div className="section-label">Past events</div>
                {past.slice(0,5).map(e => <EventCard key={e.id} event={e} faded />)}
              </>
            )}
            {events.length === 0 && (
              <div style={{textAlign:'center',padding:'48px 0'}}>
                <p style={{fontSize:32,marginBottom:10}}>📅</p>
                <p style={{fontSize:15,fontWeight:600,color:'#333',marginBottom:4}}>No events scheduled</p>
                <p style={{fontSize:13,color:'#888'}}>Schedule an arrival or departure below.</p>
              </div>
            )}
          </>
        )}
        <button className="btn btn-primary" style={{marginTop:8}} onClick={() => setView('schedule')}>+ Schedule new event</button>
      </div>
    </div>
  )
}

function EventCard({ event, faded }) {
  const isArrival = event.event_type === 'arrival'
  return (
    <div className="card" style={{opacity: faded ? 0.65 : 1, borderLeft: `3px solid ${isArrival ? '#1D9E75' : '#854F0B'}`}}>
      <div style={{display:'flex',alignItems:'center',gap:9}}>
        <div style={{width:34,height:34,borderRadius:8,background:isArrival?'#E1F5EE':'#FAEEDA',color:isArrival?'#085041':'#854F0B',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0}}>
          {isArrival ? '→' : '←'}
        </div>
        <div style={{flex:1}}>
          <div style={{fontSize:13,fontWeight:600}}>{isArrival?'Arrival':'Departure'} — {event.name}</div>
          <div style={{fontSize:11,color:'#666',marginTop:2}}>
            {format(new Date(event.event_date), 'MMM d · h:mm a')} · {event.guest_count} guests
            {event.flying_in && ' · 🚁 Flying in'}
          </div>
        </div>
        <span className={`badge ${event.status==='completed'?'badge-done':event.status==='in_progress'?'badge-due':'badge-warn'}`}>
          {event.status === 'completed' ? 'Complete' : event.status === 'in_progress' ? 'In progress' : 'Scheduled'}
        </span>
      </div>
    </div>
  )
}
