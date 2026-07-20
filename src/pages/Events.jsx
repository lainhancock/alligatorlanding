import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

const STRUCTURES = ['Main house','Lake house','OG Tiny House','Tiny House 2','Hangar','RO Shed','Equipment Shed']
const BOATS = [
  { id: 'kayak', name: 'Two-man Kayak' },
  { id: 'prowler', name: 'Pond Prowler' },
  { id: 'troller', name: 'Twin Troller' },
]
const BOAT_PREP = ['Fuel up','Check battery','Check drain plug','Load safety gear']
const BLINDS = [
  { id: 'nr', name: 'North ridge', type: 'box' },
  { id: 'cb', name: 'Creek bend', type: 'box' },
  { id: 'sp', name: 'South pasture', type: 'box' },
  { id: 'wo', name: 'West oak', type: 'bow' },
  { id: 'ph', name: 'Pine hollow', type: 'bow' },
  { id: 'lv', name: 'Lake view', type: 'box' },
  { id: 'bp', name: 'Back pasture', type: 'bow' },
  { id: 'ec', name: 'East cedar', type: 'box' },
  { id: 'rr', name: 'River run', type: 'bow' },
  { id: 'ms', name: 'Mesquite stand', type: 'box' },
  { id: 'hl', name: 'Hill top', type: 'bow' },
]
const UTVS = [
  { id: 'rev', name: 'Ranger EV' },
  { id: 'rw', name: 'Ranger Work UTV' },
  { id: 'h2', name: 'Honda 2-seater' },
  { id: 'h6', name: 'Honda 6-seater' },
  { id: 'ca', name: 'Can-Am' },
  { id: 'tt', name: 'Toyota Tundra' },
]
const STAGING = ['Main house','Hangar','Tiny House 2','OG Tiny House','Shop']
const RVS = [
  { id: 'th', name: 'Toy Hauler' },
  { id: 'rv', name: 'RV' },
  { id: 'jr', name: "Jake's RV" },
]

// ── Push notification helper ──────────────────────────────────
async function sendPushAlert(title, body) {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'default') {
    await Notification.requestPermission()
  }
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: '/apple-touch-icon.png',
      badge: '/apple-touch-icon.png',
      tag: 'al-alert-' + Date.now()
    })
    return true
  }
  return false
}

async function alertCrew(eventName, eventDate, eventType) {
  const dateStr = format(new Date(eventDate), 'MMM d \'at\' h:mm a')
  const type = eventType === 'arrival' ? 'Arrival' : 'Departure'
  const title = `🔔 Alligator Landing — ${type} alert`
  const body = `${eventName} · ${dateStr}`

  // Log alert to audit trail
  await supabase.from('audit_log').insert({
    action: 'crew_alert_sent',
    entity_type: 'event',
    diff_json: { event_name: eventName, event_date: eventDate, type: eventType }
  })

  // Send push notification
  const sent = await sendPushAlert(title, body)
  return sent
}

// ─────────────────────────────────────────────────────────────

export default function Events({ session }) {
  const [events, setEvents] = useState([])
  const [view, setView] = useState('list')
  const [loading, setLoading] = useState(true)
  const [alertSent, setAlertSent] = useState(null)

  const [form, setForm] = useState({
    event_type: 'arrival',
    name: '',
    event_date: '',
    event_time: '14:00',
    guest_count: 0,
    flying_in: false,
    meals_needed: false,
    notify_hours_before: 48,
    special_instructions: '',
  })
  const [selStructs, setSelStructs] = useState(new Set())
  const [boatState, setBoatState] = useState({})
  const [selBlinds, setSelBlinds] = useState(new Set())
  const [utvState, setUtvState] = useState({})
  const [rvState, setRvState] = useState({})

  useEffect(() => { loadEvents() }, [])

  async function loadEvents() {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: true })
    if (data) setEvents(data)
    setLoading(false)
  }

  async function handleAlertNow() {
    if (!form.name || !form.event_date) {
      alert('Please enter an event name and date first.')
      return
    }
    const dateTime = form.event_date + 'T' + form.event_time + ':00'
    const sent = await alertCrew(form.name, dateTime, form.event_type)
    setAlertSent(sent ? 'sent' : 'denied')
    setTimeout(() => setAlertSent(null), 4000)
  }

  async function saveEvent() {
    const eventDate = form.event_date + 'T' + form.event_time + ':00'
    const { data: event, error } = await supabase.from('events').insert({
      event_type: form.event_type,
      name: form.name,
      event_date: eventDate,
      guest_count: form.guest_count,
      flying_in: form.flying_in,
      notify_hours_before: form.notify_hours_before,
      special_instructions: form.special_instructions,
      created_by: session.user.id
    }).select().single()

    if (error) { alert('Error saving event: ' + error.message); return }

    const items = []

    selStructs.forEach(s => {
      items.push({ event_id: event.id, section: 'Structures', title: `Walk-through & inspect — ${s}`, photo_required: true, sort_order: 1 })
      items.push({ event_id: event.id, section: 'Structures', title: `Make beds & clean — ${s}`, photo_required: false, sort_order: 2 })
    })

    Object.entries(boatState).forEach(([id, state]) => {
      if (!state.selected) return
      const boat = BOATS.find(b => b.id === id)
      if (!boat) return
      items.push({ event_id: event.id, section: 'Boats', title: `Put out ${boat.name} at dock`, photo_required: true, sort_order: 10 })
      ;(state.prep || []).forEach(p => {
        items.push({ event_id: event.id, section: 'Boats', title: `${boat.name} — ${p}`, photo_required: false, sort_order: 11 })
      })
    })

    selBlinds.forEach(id => {
      const blind = BLINDS.find(b => b.id === id)
      if (!blind) return
      items.push({ event_id: event.id, section: 'Hunting blinds', title: `${blind.name} — inspect & clean, check for wasps`, photo_required: true, sort_order: 20 })
      if (blind.type === 'box') {
        items.push({ event_id: event.id, section: 'Hunting blinds', title: `${blind.name} — verify 2 chairs present`, photo_required: false, sort_order: 21 })
      } else {
        items.push({ event_id: event.id, section: 'Hunting blinds', title: `${blind.name} — check pull-up rope and strap security`, photo_required: false, sort_order: 21 })
      }
    })

    Object.entries(utvState).forEach(([id, state]) => {
      if (!state.selected) return
      const utv = UTVS.find(u => u.id === id)
      if (!utv) return
      items.push({ event_id: event.id, section: 'UTVs & Vehicles', title: `Wash & detail ${utv.name}`, photo_required: true, sort_order: 30 })
      items.push({ event_id: event.id, section: 'UTVs & Vehicles', title: `Stage ${utv.name} at ${state.staging || 'main house'}`, photo_required: true, sort_order: 31 })
    })

    if (form.flying_in) {
      items.push({ event_id: event.id, section: 'Helipad & Fuel', title: 'Check Jet-A fuel quality — water detection test', photo_required: true, sort_order: 40 })
      items.push({ event_id: event.id, section: 'Helipad & Fuel', title: 'Verify fuel trailer has minimum 150 gallons', photo_required: false, sort_order: 41 })
      items.push({ event_id: event.id, section: 'Helipad & Fuel', title: 'Position fuel trailer at helipad — north side', photo_required: true, sort_order: 42 })
      items.push({ event_id: event.id, section: 'Helipad & Fuel', title: 'Clear helipad of all debris', photo_required: true, sort_order: 43 })
      items.push({ event_id: event.id, section: 'Helipad & Fuel', title: 'Confirm windsock is visible and functional', photo_required: false, sort_order: 44 })
    }

    if (form.meals_needed) {
      items.push({ event_id: event.id, section: 'Meals', title: 'Confirm meal order placed', photo_required: false, sort_order: 50 })
      items.push({ event_id: event.id, section: 'Meals', title: 'Confirm meal delivery received', photo_required: true, sort_order: 51 })
    }

    if (form.guest_count > 0) {
      items.push({ event_id: event.id, section: 'Rifle Range', title: 'Put up fresh targets on all stands', photo_required: true, sort_order: 60 })
      items.push({ event_id: event.id, section: 'Rifle Range', title: 'Check range area is clear of brass and debris', photo_required: false, sort_order: 61 })
    }

    items.push({ event_id: event.id, section: 'Grounds', title: 'Mow & trim all landscaping areas', photo_required: true, sort_order: 70 })
    items.push({ event_id: event.id, section: 'Grounds', title: 'Blow off all driveways & walkways', photo_required: false, sort_order: 71 })
    items.push({ event_id: event.id, section: 'Grounds', title: 'Clear lakefront & check dock area', photo_required: true, sort_order: 72 })

    if (items.length > 0) {
      await supabase.from('event_checklist_items').insert(items)
    }

    await loadEvents()
    setView('list')
    resetForm()
  }

  function resetForm() {
    setForm({ event_type:'arrival', name:'', event_date:'', event_time:'14:00', guest_count:0, flying_in:false, meals_needed:false, notify_hours_before:48, special_instructions:'' })
    setSelStructs(new Set())
    setBoatState({})
    setSelBlinds(new Set())
    setUtvState({})
    setRvState({})
    setAlertSent(null)
  }

  const upcoming = events.filter(e => new Date(e.event_date) >= new Date() && e.status !== 'completed')
  const past = events.filter(e => new Date(e.event_date) < new Date() || e.status === 'completed')

  if (view === 'schedule') return (
    <ScheduleForm
      form={form} setForm={setForm}
      selStructs={selStructs} setSelStructs={setSelStructs}
      boatState={boatState} setBoatState={setBoatState}
      selBlinds={selBlinds} setSelBlinds={setSelBlinds}
      utvState={utvState} setUtvState={setUtvState}
      rvState={rvState} setRvState={setRvState}
      alertSent={alertSent}
      onAlertNow={handleAlertNow}
      onSave={saveEvent}
      onCancel={() => { setView('list'); resetForm() }}
    />
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
                {upcoming.map(e => <EventCard key={e.id} event={e} session={session} onRefresh={loadEvents} />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <div className="section-label">Past events</div>
                {past.slice(0,5).map(e => <EventCard key={e.id} event={e} session={session} faded onRefresh={loadEvents} />)}
              </>
            )}
            {events.length === 0 && (
              <div style={{textAlign:'center',padding:'48px 0'}}>
                <p style={{fontSize:32,marginBottom:10}}>📅</p>
                <p style={{fontSize:15,fontWeight:600,marginBottom:4}}>No events scheduled</p>
                <p style={{fontSize:13,color:'#888'}}>Schedule an arrival or departure below.</p>
              </div>
            )}
          </>
        )}
        <button className="btn btn-primary" style={{marginTop:8}} onClick={() => setView('schedule')}>
          + Schedule new event
        </button>
      </div>
    </div>
  )
}

function ScheduleForm({ form, setForm, selStructs, setSelStructs, boatState, setBoatState, selBlinds, setSelBlinds, utvState, setUtvState, rvState, setRvState, alertSent, onAlertNow, onSave, onCancel }) {

  function togStruct(s) {
    const next = new Set(selStructs)
    next.has(s) ? next.delete(s) : next.add(s)
    setSelStructs(next)
  }

  function togBoat(id, val) {
    setBoatState(prev => ({ ...prev, [id]: { ...prev[id], selected: val } }))
  }

  function togBoatPrep(id, p) {
    setBoatState(prev => {
      const prep = prev[id]?.prep || []
      return { ...prev, [id]: { ...prev[id], prep: prep.includes(p) ? prep.filter(x => x !== p) : [...prep, p] } }
    })
  }

  function togBlind(id) {
    const next = new Set(selBlinds)
    next.has(id) ? next.delete(id) : next.add(id)
    setSelBlinds(next)
  }

  function togUTV(id, val) {
    setUtvState(prev => ({ ...prev, [id]: { ...prev[id], selected: val } }))
  }

  function setStaging(id, s) {
    setUtvState(prev => ({ ...prev, [id]: { ...prev[id], staging: s } }))
  }

  function togRV(id, val) {
    setRvState(prev => ({ ...prev, [id]: { ...prev[id], action: val } }))
  }

  function setRVAfter(id, val) {
    setRvState(prev => ({ ...prev, [id]: { ...prev[id], after: val } }))
  }

  const canAlert = form.name && form.event_date
  const btnBase = { padding:'8px 6px', borderRadius:6, border:'0.5px solid', fontSize:11, cursor:'pointer', fontFamily:'inherit', flex:1 }
  const btnOn = (color='#1A4F8A', bg='#E6F1FB') => ({ ...btnBase, borderColor:color, borderWidth:'1.5px', background:bg, color:color, fontWeight:500 })
  const btnOff = { ...btnBase, borderColor:'#ddd', background:'none', color:'#666' }

  return (
    <div>
      <div className="topbar">
        <button onClick={onCancel} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>
          ← Back
        </button>
        <h1>Schedule {form.event_type}</h1>
        <p>Alligator Landing</p>
      </div>
      <div className="content">

        {/* Event type */}
        <div className="form-group">
          <label className="form-label">Event type</label>
          <div style={{display:'flex',gap:8}}>
            {['arrival','departure'].map(t => (
              <button key={t} onClick={() => setForm({...form,event_type:t})} style={{
                flex:1, padding:'10px 8px', borderRadius:8,
                border:`${form.event_type===t?'1.5px':'0.5px'} solid ${form.event_type===t?'#1A4F8A':'#ddd'}`,
                background:form.event_type===t?'#E6F1FB':'none',
                color:form.event_type===t?'#1A4F8A':'#666',
                fontWeight:form.event_type===t?600:400,
                cursor:'pointer', fontFamily:'inherit', fontSize:13
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
            <label className="form-label">Time</label>
            <input className="form-input" type="time" value={form.event_time} onChange={e=>setForm({...form,event_time:e.target.value})}/>
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Number of guests</label>
          <input className="form-input" type="number" value={form.guest_count} min={0} onChange={e=>setForm({...form,guest_count:parseInt(e.target.value)||0})}/>
        </div>

        {/* ── ALERT NOW BUTTON ── */}
        <div style={{
          background: alertSent === 'sent' ? '#EAF3DE' : alertSent === 'denied' ? '#FCEBEB' : '#FDF5EE',
          border: `0.5px solid ${alertSent === 'sent' ? '#3B6D11' : alertSent === 'denied' ? '#A32D2D' : '#D4A97A'}`,
          borderRadius: 10,
          padding: '12px 14px',
          marginBottom: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10
        }}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color: alertSent==='sent'?'#3B6D11':alertSent==='denied'?'#A32D2D':'#5C3A1E'}}>
              {alertSent === 'sent' ? '✓ Alert sent to crew!' : alertSent === 'denied' ? '⚠ Notification permission denied' : '🔔 Alert crew now'}
            </div>
            <div style={{fontSize:11,color:'#888',marginTop:2}}>
              {alertSent === 'sent' ? 'Push notification delivered' : alertSent === 'denied' ? 'Enable notifications in iPhone Settings' : 'Send immediate push notification with event details'}
            </div>
          </div>
          <button
            onClick={onAlertNow}
            disabled={!canAlert}
            style={{
              padding:'8px 14px', borderRadius:8, border:'none',
              background: canAlert ? '#3D2008' : '#ccc',
              color:'#fff', fontSize:12, fontWeight:600,
              cursor: canAlert ? 'pointer' : 'default',
              fontFamily:'inherit', flexShrink:0, whiteSpace:'nowrap'
            }}
          >
            {alertSent === 'sent' ? 'Resend' : 'Alert now'}
          </button>
        </div>

        {/* Toggles */}
        {['flying_in','meals_needed'].map(key => (
          <div key={key} onClick={() => setForm({...form,[key]:!form[key]})} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 12px',background:'#f8f8f8',borderRadius:8,marginBottom:8,cursor:'pointer'}}>
            <div>
              <div style={{fontSize:13,fontWeight:500}}>{key==='flying_in'?'🚁 Flying in by helicopter':'🍽 Meals needed'}</div>
              <div style={{fontSize:11,color:'#888',marginTop:1}}>{key==='flying_in'?'Adds helipad & fuel section':'Add meal order to checklist'}</div>
            </div>
            <div style={{width:40,height:22,borderRadius:11,background:form[key]?'#1A4F8A':'#ddd',position:'relative',transition:'background 0.2s',flexShrink:0}}>
              <div style={{width:18,height:18,borderRadius:'50%',background:'#fff',position:'absolute',top:2,left:form[key]?20:2,transition:'left 0.2s',boxShadow:'0 1px 2px rgba(0,0,0,0.2)'}}/>
            </div>
          </div>
        ))}

        {/* Structures */}
        <div className="section-label">Structures</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5,marginBottom:12}}>
          {STRUCTURES.map(s => (
            <button key={s} onClick={() => togStruct(s)} style={{
              padding:'8px', borderRadius:8,
              border:`${selStructs.has(s)?'1.5px':'0.5px'} solid ${selStructs.has(s)?'#378ADD':'#ddd'}`,
              background:selStructs.has(s)?'#E6F1FB':'none',
              color:selStructs.has(s)?'#0C447C':'#666',
              fontSize:11, cursor:'pointer', fontFamily:'inherit'
            }}>{s}</button>
          ))}
        </div>

        {/* Boats */}
        <div className="section-label">Boats</div>
        <div style={{background:'#E6F1FB',borderRadius:8,padding:9,marginBottom:8,fontSize:11,color:'#185FA5'}}>
          Select boats to put out at the dock and any prep needed.
        </div>
        {BOATS.map(b => (
          <div key={b.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:10,marginBottom:6}}>
            <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:boatState[b.id]?.selected?8:0}}>
              <div style={{width:30,height:30,borderRadius:7,background:'#E6F1FB',color:'#0C447C',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>🚤</div>
              <div style={{flex:1,fontSize:12,fontWeight:500}}>{b.name}</div>
              <div style={{display:'flex',gap:5}}>
                <button onClick={() => togBoat(b.id,true)} style={boatState[b.id]?.selected===true?btnOn('#1D9E75','#EAF3DE'):btnOff}>Put out</button>
                <button onClick={() => togBoat(b.id,false)} style={boatState[b.id]?.selected===false?btnOn('#888','#f0f0f0'):btnOff}>No</button>
              </div>
            </div>
            {boatState[b.id]?.selected === true && (
              <div style={{display:'flex',gap:5,flexWrap:'wrap'}}>
                {BOAT_PREP.map(p => {
                  const on = boatState[b.id]?.prep?.includes(p)
                  return <button key={p} onClick={() => togBoatPrep(b.id,p)} style={{padding:'5px 9px',borderRadius:20,border:`${on?'1.5px':'0.5px'} solid ${on?'#1D9E75':'#ddd'}`,background:on?'#EAF3DE':'none',color:on?'#3B6D11':'#666',fontSize:10,cursor:'pointer',fontFamily:'inherit',fontWeight:on?500:400}}>{p}</button>
                })}
              </div>
            )}
          </div>
        ))}

        {/* Hunting blinds */}
        <div className="section-label">Hunting blinds</div>
        <div style={{background:'#FDF5EE',borderRadius:8,padding:9,marginBottom:8,fontSize:11,color:'#5C3A1E'}}>
          Select blinds being used — crew will verify clean and ready.
        </div>
        <div style={{display:'flex',flexWrap:'wrap',gap:4,marginBottom:12}}>
          {BLINDS.map(b => {
            const on = selBlinds.has(b.id)
            return (
              <button key={b.id} onClick={() => togBlind(b.id)} style={{
                display:'inline-flex',alignItems:'center',gap:5,
                padding:'6px 10px',borderRadius:20,
                border:`${on?'1.5px':'0.5px'} solid ${on?(b.type==='box'?'#5C3A1E':'#3730A3'):'#ddd'}`,
                background:on?(b.type==='box'?'#FDF5EE':'#EEF2FF'):'none',
                color:on?(b.type==='box'?'#5C3A1E':'#3730A3'):'#666',
                fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:on?500:400
              }}>
                {b.type==='box'?'🚪':'🌲'} {b.name}
              </button>
            )
          })}
        </div>

        {/* UTVs */}
        <div className="section-label">UTVs & vehicles</div>
        <div style={{background:'#FAEEDA',borderRadius:8,padding:9,marginBottom:8,fontSize:11,color:'#854F0B'}}>
          Select UTVs to pull out and where to stage them.
        </div>
        {UTVS.map(u => (
          <div key={u.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:10,marginBottom:6}}>
            <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:utvState[u.id]?.selected?8:0}}>
              <div style={{width:30,height:30,borderRadius:7,background:'#FAEEDA',color:'#854F0B',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>🚙</div>
              <div style={{flex:1,fontSize:12,fontWeight:500}}>{u.name}</div>
              <div style={{display:'flex',gap:5}}>
                <button onClick={() => togUTV(u.id,true)} style={utvState[u.id]?.selected===true?btnOn('#854F0B','#FAEEDA'):btnOff}>Pull out</button>
                <button onClick={() => togUTV(u.id,false)} style={utvState[u.id]?.selected===false?btnOn('#888','#f0f0f0'):btnOff}>No</button>
              </div>
            </div>
            {utvState[u.id]?.selected === true && (
              <div>
                <div className="form-label" style={{marginBottom:4}}>Stage at:</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
                  {STAGING.map(s => {
                    const on = utvState[u.id]?.staging === s
                    return <button key={s} onClick={() => setStaging(u.id,s)} style={{padding:'7px',borderRadius:6,border:`${on?'1.5px':'0.5px'} solid ${on?'#1A4F8A':'#ddd'}`,background:on?'#E6F1FB':'none',color:on?'#0C447C':'#666',fontSize:10,cursor:'pointer',fontFamily:'inherit',fontWeight:on?500:400}}>{s}</button>
                  })}
                </div>
              </div>
            )}
          </div>
        ))}

        {/* RVs */}
        <div className="section-label">RV logistics</div>
        {RVS.map(r => (
          <div key={r.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:10,marginBottom:6}}>
            <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:rvState[r.id]?.action==='bring'?8:0}}>
              <div style={{width:30,height:30,borderRadius:7,background:'#FDF4FF',color:'#7E22CE',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16,flexShrink:0}}>🚐</div>
              <div style={{flex:1}}>
                <div style={{fontSize:12,fontWeight:500}}>{r.name}</div>
                <div style={{fontSize:10,color:'#888'}}>Jake's · Nacogdoches</div>
              </div>
              <div style={{display:'flex',gap:5}}>
                <button onClick={() => togRV(r.id,'bring')} style={rvState[r.id]?.action==='bring'?btnOn('#7E22CE','#FDF4FF'):btnOff}>Bring</button>
                <button onClick={() => togRV(r.id,'skip')} style={rvState[r.id]?.action==='skip'?btnOn('#888','#f0f0f0'):btnOff}>No</button>
              </div>
            </div>
            {rvState[r.id]?.action === 'bring' && (
              <div style={{display:'flex',gap:5}}>
                <button onClick={() => setRVAfter(r.id,'keep')} style={rvState[r.id]?.after==='keep'?btnOn('#1D9E75','#EAF3DE'):btnOff}>Keep on site</button>
                <button onClick={() => setRVAfter(r.id,'return')} style={rvState[r.id]?.after==='return'?btnOn('#854F0B','#FAEEDA'):btnOff}>Return to Jake's</button>
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

        <button className="btn btn-primary" onClick={onSave} disabled={!form.name||!form.event_date}>
          Schedule event
        </button>
        <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

function EventCard({ event, session, faded, onRefresh }) {
  const [checklistItems, setChecklistItems] = useState([])
  const [expanded, setExpanded] = useState(false)
  const [alertSent, setAlertSent] = useState(false)
  const isArrival = event.event_type === 'arrival'

  async function loadChecklist() {
    const { data } = await supabase
      .from('event_checklist_items')
      .select('*')
      .eq('event_id', event.id)
      .order('sort_order')
    if (data) setChecklistItems(data)
  }

  async function toggleItem(item) {
    await supabase.from('event_checklist_items').update({
      completed: !item.completed,
      completed_by: session.user.id,
      completed_at: new Date().toISOString()
    }).eq('id', item.id)
    loadChecklist()
  }

  async function approveEvent() {
    await supabase.from('events').update({
      status: 'completed',
      approved_by: session.user.id,
      approved_at: new Date().toISOString()
    }).eq('id', event.id)
    onRefresh()
  }

  async function deleteEvent(permanent) {
    if (permanent) {
      await supabase.from('events').delete().eq('id', event.id)
    } else {
      await supabase.from('events').update({ deleted_at: new Date().toISOString() }).eq('id', event.id)
      await supabase.from('deleted_items_log').insert({ entity_type: 'event', entity_id: event.id, entity_title: event.name, deleted_by: session.user.id })
    }
    onRefresh()
  }

  async function handleAlert() {
    await alertCrew(event.name, event.event_date, event.event_type)
    setAlertSent(true)
    setTimeout(() => setAlertSent(false), 3000)
  }

  useEffect(() => { if (expanded) loadChecklist() }, [expanded])

  const done = checklistItems.filter(i => i.completed).length
  const total = checklistItems.length
  const pct = total > 0 ? Math.round((done/total)*100) : 0

  const sections = checklistItems.reduce((acc, item) => {
    if (!acc[item.section]) acc[item.section] = []
    acc[item.section].push(item)
    return acc
  }, {})

  return (
    <div style={{opacity:faded?0.65:1,marginBottom:8}}>
      <div className="card" style={{borderLeft:`3px solid ${isArrival?'#1D9E75':'#854F0B'}`}}>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:8}} onClick={() => setExpanded(!expanded)}>
          <div style={{width:34,height:34,borderRadius:8,background:isArrival?'#E1F5EE':'#FAEEDA',color:isArrival?'#085041':'#854F0B',display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,flexShrink:0,cursor:'pointer'}}>
            {isArrival?'→':'←'}
          </div>
          <div style={{flex:1,cursor:'pointer'}}>
            <div style={{fontSize:13,fontWeight:600}}>{isArrival?'Arrival':'Departure'} — {event.name}</div>
            <div style={{fontSize:11,color:'#666',marginTop:2}}>
              {format(new Date(event.event_date),'MMM d · h:mm a')} · {event.guest_count} guests
              {event.flying_in && ' · 🚁'}
            </div>
          </div>
          {/* Alert bell button */}
          {!faded && (
            <button onClick={e => { e.stopPropagation(); handleAlert() }} style={{
              width:32,height:32,borderRadius:8,border:'0.5px solid #ddd',
              background:alertSent?'#EAF3DE':'#f8f8f8',
              cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',
              fontSize:16,flexShrink:0,transition:'all 0.2s'
            }} title="Alert crew now">
              {alertSent ? '✓' : '🔔'}
            </button>
          )}
          <span className={`badge ${event.status==='completed'?'badge-done':event.status==='in_progress'?'badge-due':'badge-warn'}`}>
            {event.status==='completed'?'Complete':event.status==='in_progress'?'In progress':'Scheduled'}
          </span>
        </div>

        {alertSent && (
          <div style={{background:'#EAF3DE',borderRadius:6,padding:'6px 10px',marginBottom:8,fontSize:11,color:'#3B6D11'}}>
            ✓ Push notification sent to all crew
          </div>
        )}

        {expanded && total > 0 && (
          <div onClick={e => e.stopPropagation()}>
            <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#666',marginBottom:3}}>
              <span>Progress</span><span>{done}/{total} · {pct}%</span>
            </div>
            <div className="prog-bar" style={{marginBottom:10}}>
              <div className="prog-fill" style={{width:`${pct}%`,background:'#1D9E75'}}/>
            </div>
            {Object.entries(sections).map(([section, items]) => (
              <div key={section} style={{marginBottom:12}}>
                <div style={{fontSize:11,fontWeight:600,color:'#555',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:6}}>{section}</div>
                {items.map(item => (
                  <div key={item.id} style={{display:'flex',alignItems:'flex-start',gap:9,padding:'7px 0',borderBottom:'0.5px solid #f5f5f5'}}>
                    <button onClick={() => toggleItem(item)} style={{width:22,height:22,borderRadius:5,border:`1.5px solid ${item.completed?'#3B6D11':'#ccc'}`,background:item.completed?'#3B6D11':'none',color:'#fff',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,marginTop:1}}>
                      {item.completed && '✓'}
                    </button>
                    <div style={{fontSize:12,color:'#333',textDecoration:item.completed?'line-through':'none',opacity:item.completed?0.5:1,flex:1}}>
                      {item.title}
                      {item.photo_required && <span style={{fontSize:10,color:'#888',marginLeft:6}}>📷</span>}
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {done === total && total > 0 && event.status !== 'completed' && (
              <button className="btn btn-success" style={{marginTop:8,marginBottom:0}} onClick={approveEvent}>
                ✓ Approve — property ready
              </button>
            )}
          </div>
        )}

        {expanded && total === 0 && (
          <p style={{fontSize:12,color:'#888',padding:'8px 0'}} onClick={e=>e.stopPropagation()}>No checklist items yet.</p>
        )}

        {expanded && !faded && (
          <div style={{borderTop:'0.5px solid #f0f0f0',padding:'10px 0 4px',display:'flex',gap:7}} onClick={e=>e.stopPropagation()}>
            <button onClick={()=>{ if(window.confirm('Archive this event?')) deleteEvent(false) }} style={{flex:1,padding:'8px',borderRadius:8,border:'0.5px solid #ddd',background:'#FAEEDA',color:'#854F0B',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
              📦 Archive
            </button>
            <button onClick={()=>{ if(window.confirm('Permanently delete this event and its checklist?')) deleteEvent(true) }} style={{flex:1,padding:'8px',borderRadius:8,border:'0.5px solid #ddd',background:'#FCEBEB',color:'#A32D2D',fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>
              🗑 Delete
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
