import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

export default function Hunting({ session }) {
  const [tab, setTab] = useState('blinds')
  const [profile, setProfile] = useState(null)
  const [blinds, setBlinds] = useState([])
  const [feeders, setFeeders] = useState([])
  const [cameras, setCameras] = useState([])
  const [logs, setLogs] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [logForm, setLogForm] = useState({
    hunter_name: '', hunt_date: format(new Date(), 'yyyy-MM-dd'),
    session: 'am', animal_type: 'Whitetail', sightings: 0,
    harvest: 'No harvest', notes: ''
  })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: prof }, { data: b }, { data: f }, { data: c }, { data: l }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('hunting_blinds').select('*').eq('active', true).order('name'),
      supabase.from('feeders').select('*, blind:hunting_blinds(name)').eq('active', true),
      supabase.from('game_cameras').select('*, blind:hunting_blinds(name)').eq('active', true),
      supabase.from('hunt_logs').select('*, blind:hunting_blinds(name)').is('deleted_at', null).order('hunt_date', { ascending: false }).limit(20)
    ])
    if (prof) setProfile(prof)
    if (b) setBlinds(b)
    if (f) setFeeders(f)
    if (c) setCameras(c)
    if (l) setLogs(l)
    setLoading(false)
  }

  async function saveLog() {
    await supabase.from('hunt_logs').insert({
      ...logForm,
      hunter_id: session.user.id,
      blind_id: selected?.id
    })
    loadAll()
    setTab('log')
  }

  async function updateFeederLevel(id, level) {
    await supabase.from('feeders').update({ fill_level: level, last_checked: format(new Date(), 'yyyy-MM-dd') }).eq('id', id)
    loadAll()
  }

  async function deleteLog(id, permanent) {
    if (permanent) {
      await supabase.from('hunt_logs').delete().eq('id', id)
    } else {
      await supabase.from('hunt_logs').update({ deleted_at: new Date().toISOString() }).eq('id', id)
      await supabase.from('deleted_items_log').insert({
        entity_type: 'hunt_log', entity_id: id, entity_title: 'Hunt log entry', deleted_by: session.user.id
      })
    }
    loadAll()
  }

  const isOwnerAdmin = profile?.role === 'owner' || profile?.role === 'admin'
  const isOwner = profile?.role === 'owner'
  const lowFeeders = feeders.filter(f => f.fill_level <= 25)
  const boxBlinds = blinds.filter(b => b.blind_type === 'box')
  const bowBlinds = blinds.filter(b => b.blind_type === 'bow')

  return (
    <div>
      <div className="topbar" style={{background:'#3D2008'}}>
        <h1>Hunting Management</h1>
        <p>Alligator Landing</p>
      </div>
      <div className="content">
        <div className="tab-row">
          {['blinds','feeders','cameras','log'].map(t => (
            <button key={t} className={`tab-btn${tab===t?' active':''}`}
              onClick={() => setTab(t)}
              style={tab===t?{background:'#3D2008',color:'#fff'}:{}}>
              {t.charAt(0).toUpperCase()+t.slice(1)}
            </button>
          ))}
        </div>

        {tab === 'blinds' && (
          <>
            <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num">{blinds.length}</div><div className="stat-lbl">Total</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#5C3A1E'}}>{boxBlinds.length}</div><div className="stat-lbl">Box</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#3730A3'}}>{bowBlinds.length}</div><div className="stat-lbl">Bow</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#854F0B'}}>{blinds.filter(b=>b.status==='warn').length}</div><div className="stat-lbl">Attn.</div></div>
            </div>
            {loading ? <p style={{color:'#888',fontSize:13}}>Loading…</p> : blinds.map(b => (
              <div key={b.id} className="task-card" onClick={() => setSelected(b)}>
                <div style={{width:36,height:36,borderRadius:8,background:b.blind_type==='box'?'#FDF5EE':'#EEF2FF',color:b.blind_type==='box'?'#5C3A1E':'#3730A3',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>
                  {b.blind_type==='box'?'🚪':'🌲'}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:500}}>{b.name}</div>
                  <div style={{fontSize:11,color:'#666',marginTop:2}}>
                    <span style={{background:b.blind_type==='box'?'#FDF5EE':'#EEF2FF',color:b.blind_type==='box'?'#5C3A1E':'#3730A3',padding:'1px 6px',borderRadius:10,fontSize:9,fontWeight:500}}>
                      {b.blind_type==='box'?'Box':'Bow'}
                    </span>
                    {' '}Last: {b.last_inspection||'Never'}
                  </div>
                </div>
                <span className={`badge ${b.status==='ok'?'badge-done':'badge-warn'}`}>
                  {b.status==='ok'?'Ready':'Needs attn.'}
                </span>
              </div>
            ))}
          </>
        )}

        {tab === 'feeders' && (
          <>
            {lowFeeders.length > 0 && (
              <div style={{background:'#FAEEDA',border:'0.5px solid #D4A97A',borderRadius:8,padding:10,marginBottom:10,fontSize:12,color:'#854F0B'}}>
                ⚠ {lowFeeders.length} feeder{lowFeeders.length>1?'s':''} at 25% or below — fill required
              </div>
            )}
            {loading ? <p style={{color:'#888',fontSize:13}}>Loading…</p> : feeders.map(f => (
              <div key={f.id} className="card">
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:500}}>{f.name}</div>
                    <div style={{fontSize:11,color:'#666'}}>{f.blind?.name} · {f.feeder_type==='corn'?'Corn (spin timer)':'Protein (gravity)'}</div>
                  </div>
                  <span className={`badge ${f.fill_level<=25?'badge-overdue':f.fill_level<=50?'badge-warn':'badge-done'}`}>{f.fill_level}%</span>
                </div>
                <div style={{display:'flex',gap:5}}>
                  {[100,75,50,25].map(v => (
                    <button key={v} onClick={() => updateFeederLevel(f.id, v)} style={{
                      flex:1,padding:'7px 4px',borderRadius:6,border:'1px solid',fontSize:11,cursor:'pointer',fontFamily:'inherit',
                      borderColor:f.fill_level===v?(v<=25?'#A32D2D':v<=50?'#854F0B':'#3B6D11'):'#ddd',
                      background:f.fill_level===v?(v<=25?'#FCEBEB':v<=50?'#FAEEDA':'#EAF3DE'):'none',
                      color:f.fill_level===v?(v<=25?'#A32D2D':v<=50?'#854F0B':'#3B6D11'):'#666',
                      fontWeight:f.fill_level===v?600:400
                    }}>{v}%</button>
                  ))}
                </div>
                {f.feeder_type==='corn' && (
                  <div style={{marginTop:8,display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
                    <div><div style={{fontSize:10,color:'#888'}}>AM spin</div><div style={{fontSize:12,fontWeight:500}}>{f.timer_am||'06:30'}</div></div>
                    <div><div style={{fontSize:10,color:'#888'}}>PM spin</div><div style={{fontSize:12,fontWeight:500}}>{f.timer_pm||'17:30'}</div></div>
                    <div><div style={{fontSize:10,color:'#888'}}>Duration</div><div style={{fontSize:12,fontWeight:500}}>{f.timer_duration_seconds||5}s</div></div>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {tab === 'cameras' && (
          <>
            <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num">{cameras.length}</div><div className="stat-lbl">Total</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#3B6D11'}}>{cameras.filter(c=>c.status==='ok').length}</div><div className="stat-lbl">OK</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#854F0B'}}>{cameras.filter(c=>c.status==='low_battery').length}</div><div className="stat-lbl">Low</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#A32D2D'}}>{cameras.filter(c=>c.status==='issue'||c.status==='offline').length}</div><div className="stat-lbl">Issue</div></div>
            </div>
            {cameras.map(c => (
              <div key={c.id} className="card" style={{marginBottom:7}}>
                <div style={{display:'flex',alignItems:'center',gap:9}}>
                  <div style={{width:32,height:32,borderRadius:7,background:'#E6F1FB',color:'#185FA5',display:'flex',alignItems:'center',justifyContent:'center',fontSize:15}}>📷</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:500}}>{c.name} · {c.blind?.name}</div>
                    <div style={{display:'flex',alignItems:'center',gap:6,marginTop:4}}>
                      <span style={{fontSize:10,color:'#888'}}>Battery</span>
                      <div style={{flex:1,height:8,background:'#eee',borderRadius:4,overflow:'hidden'}}>
                        <div style={{height:8,width:`${c.battery_level}%`,background:c.battery_level>50?'#1D9E75':c.battery_level>20?'#EF9F27':'#E24B4A',borderRadius:4}}/>
                      </div>
                      <span style={{fontSize:10,fontWeight:500}}>{c.battery_level}%</span>
                    </div>
                  </div>
                  <span className={`badge ${c.status==='ok'?'badge-done':c.status==='low_battery'?'badge-warn':'badge-overdue'}`}>
                    {c.status==='ok'?'OK':c.status==='low_battery'?'Low batt.':'Issue'}
                  </span>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'log' && (
          <>
            <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num">{logs.length}</div><div className="stat-lbl">Hunts</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#3B6D11'}}>{logs.filter(l=>l.harvest&&l.harvest!=='No harvest').length}</div><div className="stat-lbl">Harvests</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num">{logs.reduce((a,l)=>a+(l.sightings||0),0)}</div><div className="stat-lbl">Sightings</div></div>
              <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num">{logs.filter(l=>l.animal_type==='Exotic').length}</div><div className="stat-lbl">Exotics</div></div>
            </div>

            <div style={{background:'#f5f5f5',borderRadius:8,padding:12,marginBottom:12}}>
              <div style={{fontSize:13,fontWeight:600,marginBottom:8}}>Log a hunt</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:7}}>
                <div><label className="form-label">Hunter</label><input className="form-input" value={logForm.hunter_name} onChange={e=>setLogForm({...logForm,hunter_name:e.target.value})} placeholder="Name"/></div>
                <div><label className="form-label">Blind</label>
                  <select className="form-input" onChange={e=>setSelected(blinds.find(b=>b.name===e.target.value))}>
                    <option>— select —</option>
                    {blinds.map(b=><option key={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Date</label><input className="form-input" type="date" value={logForm.hunt_date} onChange={e=>setLogForm({...logForm,hunt_date:e.target.value})}/></div>
                <div><label className="form-label">Session</label>
                  <select className="form-input" value={logForm.session} onChange={e=>setLogForm({...logForm,session:e.target.value})}>
                    <option value="am">AM</option><option value="pm">PM</option><option value="all_day">All day</option>
                  </select>
                </div>
                <div><label className="form-label">Animal</label>
                  <select className="form-input" value={logForm.animal_type} onChange={e=>setLogForm({...logForm,animal_type:e.target.value})}>
                    {['Whitetail','Exotic','Hog','Turkey','Other'].map(a=><option key={a}>{a}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Harvest</label>
                  <select className="form-input" value={logForm.harvest} onChange={e=>setLogForm({...logForm,harvest:e.target.value})}>
                    {['No harvest','Buck','Doe','Exotic','Hog'].map(h=><option key={h}>{h}</option>)}
                  </select>
                </div>
              </div>
              <div style={{marginBottom:8}}><label className="form-label">Notes</label><textarea className="form-input" rows={2} value={logForm.notes} onChange={e=>setLogForm({...logForm,notes:e.target.value})} placeholder="Conditions, sightings, notes…" style={{resize:'none'}}/></div>
              <button className="btn" style={{background:'#3D2008',color:'#fff',marginBottom:0}} onClick={saveLog}>Save hunt log</button>
            </div>

            <div className="section-label">Recent logs</div>
            {logs.map(l => (
              <div key={l.id} className="card" style={{marginBottom:7}}>
                <div style={{display:'flex',alignItems:'center',gap:8}}>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:500}}>{l.hunter_name||'Unknown'} · {l.blind?.name||'—'}</div>
                    <div style={{fontSize:11,color:'#666',marginTop:3}}>
                      {l.hunt_date} · {l.animal_type} · <span style={{color:l.harvest&&l.harvest!=='No harvest'?'#3B6D11':'#888',fontWeight:l.harvest&&l.harvest!=='No harvest'?500:400}}>{l.harvest||'No harvest'}</span>
                    </div>
                  </div>
                  {isOwnerAdmin && (
                    <div style={{display:'flex',gap:5'}}>
                      <button onClick={()=>{ if(window.confirm('Archive this log entry?')) deleteLog(l.id, false) }} style={{padding:'4px 8px',borderRadius:6,border:'0.5px solid #ddd',background:'#FAEEDA',color:'#854F0B',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>📦</button>
                      {isOwner && <button onClick={()=>{ if(window.confirm('Permanently delete?')) deleteLog(l.id, true) }} style={{padding:'4px 8px',borderRadius:6,border:'0.5px solid #ddd',background:'#FCEBEB',color:'#A32D2D',fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>🗑</button>}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  )
}
