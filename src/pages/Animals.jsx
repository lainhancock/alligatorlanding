import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { format } from 'date-fns'

const SPECIES = ['Whitetail','Axis','Elk','Gemsbok','Addax','Iranian Red Sheep','Blackbuck','Other']
const SEX_OPTIONS = ['Buck','Doe','Bull','Cow','Ram','Ewe','Unknown']
const STATUS_OPTIONS = ['Active','Harvested','Deceased','Sold']
const ACQ_TYPES = ['Purchased','Born on property']
const EDITORS = ['Lain Hancock','Clare Bambury','Scott Holcomb','Trace']

const SPECIES_CONFIG = {
  'Whitetail':          { emoji:'🦌', color:'#854F0B', bg:'#FAEEDA' },
  'Axis':               { emoji:'🦌', color:'#3B6D11', bg:'#EAF3DE' },
  'Elk':                { emoji:'🦌', color:'#185FA5', bg:'#E6F1FB' },
  'Gemsbok':            { emoji:'🐂', color:'#555',    bg:'#F1EFE8' },
  'Addax':              { emoji:'🐂', color:'#72243E', bg:'#FBEAF0' },
  'Iranian Red Sheep':  { emoji:'🐏', color:'#A32D2D', bg:'#FCEBEB' },
  'Blackbuck':          { emoji:'🦌', color:'#3C3489', bg:'#EEEDFE' },
  'Other':              { emoji:'🐾', color:'#555',    bg:'#F1EFE8' },
}

const STATUS_CONFIG = {
  'Active':    { color:'#3B6D11', bg:'#EAF3DE' },
  'Harvested': { color:'#854F0B', bg:'#FAEEDA' },
  'Deceased':  { color:'#A32D2D', bg:'#FCEBEB' },
  'Sold':      { color:'#555',    bg:'#F1EFE8' },
}

function canEdit(profile) {
  return profile?.role === 'owner' || profile?.role === 'admin' ||
    EDITORS.includes(profile?.full_name)
}

export default function Animals({ session }) {
  const [profile, setProfile] = useState(null)
  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('list')
  const [selected, setSelected] = useState(null)
  const [statusLog, setStatusLog] = useState([])
  const [speciesFilter, setSpeciesFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('Active')
  const [form, setForm] = useState({
    tag_number: '', species: 'Whitetail', sex: 'Unknown',
    estimated_dob: '', acquisition_type: 'Purchased',
    acquisition_date: '', purchase_price: '', source: '', notes: ''
  })
  const [isEditing, setIsEditing] = useState(false)
  const [statusForm, setStatusForm] = useState({ status: 'Active', status_date: '', status_notes: '' })
  const [showStatusChange, setShowStatusChange] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const [{ data: prof }, { data: a }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', session.user.id).single(),
      supabase.from('animal_inventory').select('*').order('created_at', { ascending: false })
    ])
    if (prof) setProfile(prof)
    if (a) setAnimals(a)
    setLoading(false)
  }

  async function loadStatusLog(animalId) {
    const { data } = await supabase
      .from('animal_status_log')
      .select('*, logged_profile:profiles!animal_status_log_logged_by_fkey(full_name)')
      .eq('animal_id', animalId)
      .order('created_at', { ascending: false })
    if (data) setStatusLog(data)
  }

  async function saveAnimal() {
    if (!form.species) return
    const payload = {
      tag_number: form.tag_number || null,
      species: form.species,
      sex: form.sex,
      estimated_dob: form.estimated_dob || null,
      acquisition_type: form.acquisition_type,
      acquisition_date: form.acquisition_date || null,
      purchase_price: form.purchase_price ? parseFloat(form.purchase_price) : null,
      source: form.source || null,
      notes: form.notes || null,
      status: 'Active',
      updated_at: new Date().toISOString()
    }
    if (isEditing && selected) {
      await supabase.from('animal_inventory').update(payload).eq('id', selected.id)
    } else {
      const { data } = await supabase.from('animal_inventory').insert({ ...payload, created_by: session.user.id }).select().single()
      if (data) {
        await supabase.from('animal_status_log').insert({
          animal_id: data.id, status: 'Active',
          status_date: form.acquisition_date || new Date().toISOString().slice(0,10),
          notes: form.acquisition_type === 'Purchased' ? `Purchased from ${form.source||'unknown'}` : 'Born on property',
          logged_by: session.user.id
        })
      }
    }
    resetForm()
    setView('list')
    loadAll()
  }

  async function changeStatus() {
    if (!statusForm.status || !selected) return
    await supabase.from('animal_inventory').update({
      status: statusForm.status,
      status_date: statusForm.status_date || null,
      status_notes: statusForm.status_notes || null,
      updated_at: new Date().toISOString()
    }).eq('id', selected.id)
    await supabase.from('animal_status_log').insert({
      animal_id: selected.id,
      status: statusForm.status,
      status_date: statusForm.status_date || null,
      notes: statusForm.status_notes || null,
      logged_by: session.user.id
    })
    setShowStatusChange(false)
    setStatusForm({ status: 'Active', status_date: '', status_notes: '' })
    const { data } = await supabase.from('animal_inventory').select('*').eq('id', selected.id).single()
    if (data) setSelected(data)
    loadAll()
    loadStatusLog(selected.id)
  }

  async function deleteAnimal(id) {
    await supabase.from('animal_inventory').delete().eq('id', id)
    setView('list')
    loadAll()
  }

  function resetForm() {
    setForm({ tag_number:'', species:'Whitetail', sex:'Unknown', estimated_dob:'', acquisition_type:'Purchased', acquisition_date:'', purchase_price:'', source:'', notes:'' })
    setIsEditing(false)
    setSelected(null)
  }

  function openEdit(a) {
    setForm({
      tag_number: a.tag_number||'', species: a.species, sex: a.sex,
      estimated_dob: a.estimated_dob||'', acquisition_type: a.acquisition_type||'Purchased',
      acquisition_date: a.acquisition_date||'', purchase_price: a.purchase_price||'',
      source: a.source||'', notes: a.notes||''
    })
    setIsEditing(true)
    setSelected(a)
    setView('form')
  }

  const isEditor = canEdit(profile)
  const filtered = animals.filter(a => {
    const matchSpecies = speciesFilter === 'all' || a.species === speciesFilter
    const matchStatus = statusFilter === 'all' || a.status === statusFilter
    return matchSpecies && matchStatus
  })

  // Summary stats
  const active = animals.filter(a => a.status === 'Active')
  const speciesCounts = SPECIES.reduce((acc, s) => {
    acc[s] = active.filter(a => a.species === s).length
    return acc
  }, {})
  const totalValue = animals.filter(a => a.purchase_price).reduce((sum, a) => sum + parseFloat(a.purchase_price||0), 0)
  const bornOnProperty = animals.filter(a => a.acquisition_type === 'Born on property').length
  const purchased = animals.filter(a => a.acquisition_type === 'Purchased').length

  // ── FORM VIEW ──────────────────────────────────────────────
  if (view === 'form') return (
    <div>
      <div className="topbar" style={{background:'#2D5016'}}>
        <button onClick={() => { resetForm(); setView('list') }} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
        <h1>{isEditing ? 'Edit animal record' : 'Add animal'}</h1>
        <p>Alligator Landing</p>
      </div>
      <div className="content">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Species</label>
            <select className="form-input" value={form.species} onChange={e=>setForm({...form,species:e.target.value})}>
              {SPECIES.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Sex</label>
            <select className="form-input" value={form.sex} onChange={e=>setForm({...form,sex:e.target.value})}>
              {SEX_OPTIONS.map(s=><option key={s}>{s}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group">
          <label className="form-label">Tag number</label>
          <input className="form-input" value={form.tag_number} onChange={e=>setForm({...form,tag_number:e.target.value})} placeholder="e.g. WH-001"/>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Est. date of birth</label>
            <input className="form-input" type="date" value={form.estimated_dob} onChange={e=>setForm({...form,estimated_dob:e.target.value})}/>
          </div>
          <div className="form-group" style={{marginBottom:0}}>
            <label className="form-label">Acquisition type</label>
            <select className="form-input" value={form.acquisition_type} onChange={e=>setForm({...form,acquisition_type:e.target.value})}>
              {ACQ_TYPES.map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        {form.acquisition_type === 'Purchased' && (
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Purchase date</label>
                <input className="form-input" type="date" value={form.acquisition_date} onChange={e=>setForm({...form,acquisition_date:e.target.value})}/>
              </div>
              <div className="form-group" style={{marginBottom:0}}>
                <label className="form-label">Purchase price ($)</label>
                <input className="form-input" type="number" value={form.purchase_price} onChange={e=>setForm({...form,purchase_price:e.target.value})} placeholder="0.00"/>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Source / breeder</label>
              <input className="form-input" value={form.source} onChange={e=>setForm({...form,source:e.target.value})} placeholder="e.g. Texas Exotic Ranch"/>
            </div>
          </>
        )}
        {form.acquisition_type === 'Born on property' && (
          <div className="form-group">
            <label className="form-label">Birth date</label>
            <input className="form-input" type="date" value={form.acquisition_date} onChange={e=>setForm({...form,acquisition_date:e.target.value})}/>
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Notes</label>
          <textarea className="form-input" rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Distinguishing features, health notes, etc." style={{resize:'none'}}/>
        </div>
        <button className="btn btn-primary" onClick={saveAnimal} disabled={!form.species}>{isEditing ? 'Save changes' : 'Add animal'}</button>
        <button className="btn btn-secondary" onClick={() => { resetForm(); setView('list') }}>Cancel</button>
      </div>
    </div>
  )

  // ── DETAIL VIEW ────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const sc = SPECIES_CONFIG[selected.species] || SPECIES_CONFIG['Other']
    const stc = STATUS_CONFIG[selected.status] || STATUS_CONFIG['Active']
    return (
      <div>
        <div className="topbar" style={{background:'#2D5016'}}>
          <button onClick={() => { setSelected(null); setView('list'); setShowStatusChange(false) }} style={{background:'none',border:'none',color:'#fff',fontSize:13,cursor:'pointer',marginBottom:10,display:'flex',alignItems:'center',gap:4}}>← Back</button>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div>
              <h1 style={{fontSize:15}}>{selected.species} {selected.tag_number ? `— ${selected.tag_number}` : ''}</h1>
              <p>{selected.sex} · {selected.acquisition_type}</p>
            </div>
            {isEditor && (
              <button onClick={() => openEdit(selected)} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',padding:'6px 12px',borderRadius:6,fontSize:12,cursor:'pointer'}}>Edit</button>
            )}
          </div>
        </div>
        <div className="content">
          <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:12}}>
            <span style={{background:sc.bg,color:sc.color,fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:500}}>{selected.species}</span>
            <span style={{background:stc.bg,color:stc.color,fontSize:10,padding:'2px 7px',borderRadius:20,fontWeight:500}}>{selected.status}</span>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Tag number</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selected.tag_number||'—'}</div></div>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Sex</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selected.sex}</div></div>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Est. DOB</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selected.estimated_dob ? format(new Date(selected.estimated_dob),'MMM d, yyyy') : '—'}</div></div>
            <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Acquired</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selected.acquisition_date ? format(new Date(selected.acquisition_date),'MMM d, yyyy') : '—'}</div></div>
            {selected.purchase_price && <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Purchase price</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>${parseFloat(selected.purchase_price).toLocaleString()}</div></div>}
            {selected.source && <div style={{background:'#f8f8f8',borderRadius:8,padding:9}}><div style={{fontSize:10,color:'#888'}}>Source</div><div style={{fontSize:12,fontWeight:500,marginTop:2}}>{selected.source}</div></div>}
          </div>

          {selected.notes && (
            <div style={{background:'#f8f8f8',borderRadius:8,padding:12,marginBottom:12}}>
              <p style={{fontSize:11,fontWeight:500,color:'#555',marginBottom:4}}>Notes</p>
              <p style={{fontSize:13,color:'#333',lineHeight:1.55}}>{selected.notes}</p>
            </div>
          )}

          {/* Status change */}
          {isEditor && selected.status === 'Active' && (
            <div style={{marginBottom:12}}>
              {!showStatusChange ? (
                <button onClick={() => setShowStatusChange(true)} className="btn" style={{background:'#FAEEDA',color:'#854F0B',marginBottom:0}}>
                  📋 Update status
                </button>
              ) : (
                <div style={{background:'#f8f8f8',borderRadius:8,padding:12}}>
                  <div style={{fontSize:12,fontWeight:500,marginBottom:8}}>Update animal status</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                    <div>
                      <label className="form-label">New status</label>
                      <select className="form-input" value={statusForm.status} onChange={e=>setStatusForm({...statusForm,status:e.target.value})}>
                        {STATUS_OPTIONS.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Date</label>
                      <input className="form-input" type="date" value={statusForm.status_date} onChange={e=>setStatusForm({...statusForm,status_date:e.target.value})}/>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <input className="form-input" value={statusForm.status_notes} onChange={e=>setStatusForm({...statusForm,status_notes:e.target.value})} placeholder="e.g. Harvested by Lain — 8pt buck"/>
                  </div>
                  <div style={{display:'flex',gap:8}}>
                    <button onClick={changeStatus} className="btn btn-primary" style={{marginBottom:0,flex:1}}>Save</button>
                    <button onClick={() => setShowStatusChange(false)} className="btn btn-secondary" style={{marginBottom:0,flex:1}}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status log */}
          <div className="section-label">Status history ({statusLog.length})</div>
          <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:'0 12px',marginBottom:12}}>
            {statusLog.length === 0 ? (
              <p style={{padding:'12px 0',fontSize:12,color:'#aaa',textAlign:'center'}}>No history yet.</p>
            ) : statusLog.map(l => {
              const stc = STATUS_CONFIG[l.status] || STATUS_CONFIG['Active']
              return (
                <div key={l.id} style={{padding:'9px 0',borderBottom:'0.5px solid #f5f5f5'}}>
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:3}}>
                    <span style={{background:stc.bg,color:stc.color,fontSize:10,padding:'1px 6px',borderRadius:10,fontWeight:500}}>{l.status}</span>
                    <span style={{fontSize:10,color:'#aaa'}}>{l.status_date ? format(new Date(l.status_date),'MMM d, yyyy') : format(new Date(l.created_at),'MMM d, yyyy')}</span>
                    <span style={{fontSize:10,color:'#aaa'}}>· {l.logged_profile?.full_name||'Unknown'}</span>
                  </div>
                  {l.notes && <div style={{fontSize:12,color:'#555'}}>{l.notes}</div>}
                </div>
              )
            })}
          </div>

          {isEditor && (
            <button onClick={() => { if(window.confirm('Permanently delete this record?')) deleteAnimal(selected.id) }} className="btn" style={{background:'#FCEBEB',color:'#A32D2D',marginBottom:0}}>
              🗑 Delete record
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── LIST VIEW ──────────────────────────────────────────────
  return (
    <div>
      <div className="topbar" style={{background:'#2D5016'}}>
        <h1>Animal Inventory</h1>
        <p>Alligator Landing</p>
      </div>
      <div className="content">

        {/* Summary */}
        <div className="stat-grid" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
          <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#2D5016'}}>{active.length}</div><div className="stat-lbl">Active</div></div>
          <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num">{animals.length}</div><div className="stat-lbl">Total</div></div>
          <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#185FA5'}}>{bornOnProperty}</div><div className="stat-lbl">Born here</div></div>
          <div className="stat-card" style={{textAlign:'center'}}><div className="stat-num" style={{color:'#854F0B'}}>{purchased}</div><div className="stat-lbl">Purchased</div></div>
        </div>

        {/* Species breakdown */}
        {active.length > 0 && (
          <div style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,padding:'8px 12px',marginBottom:10}}>
            <div style={{fontSize:11,fontWeight:500,color:'#555',marginBottom:8}}>Active herd by species</div>
            {SPECIES.filter(s => speciesCounts[s] > 0).map(s => {
              const sc = SPECIES_CONFIG[s] || SPECIES_CONFIG['Other']
              return (
                <div key={s} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                  <span style={{fontSize:14}}>{sc.emoji}</span>
                  <span style={{fontSize:12,flex:1,color:'#333'}}>{s}</span>
                  <span style={{background:sc.bg,color:sc.color,fontSize:11,padding:'2px 8px',borderRadius:10,fontWeight:500}}>{speciesCounts[s]}</span>
                </div>
              )
            })}
            {totalValue > 0 && (
              <div style={{borderTop:'0.5px solid #f0f0f0',marginTop:8,paddingTop:8,fontSize:11,color:'#888'}}>
                Total purchase value: <span style={{fontWeight:600,color:'#333'}}>${totalValue.toLocaleString()}</span>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:6}}>
          {['all','Active','Harvested','Deceased','Sold'].map(s => (
            <button key={s} className={`filter-pill${statusFilter===s?' active':''}`} onClick={() => setStatusFilter(s)}>{s==='all'?'All status':s}</button>
          ))}
        </div>
        <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:8}}>
          <button className={`filter-pill${speciesFilter==='all'?' active':''}`} onClick={() => setSpeciesFilter('all')}>All species</button>
          {SPECIES.filter(s => animals.some(a => a.species === s)).map(s => (
            <button key={s} className={`filter-pill${speciesFilter===s?' active':''}`} onClick={() => setSpeciesFilter(s)}>{s}</button>
          ))}
        </div>

        {/* Animal list */}
        {loading ? <p style={{color:'#888',fontSize:13}}>Loading…</p>
        : filtered.length === 0 ? (
          <div style={{textAlign:'center',padding:'32px 0'}}>
            <p style={{fontSize:28,marginBottom:8}}>🐾</p>
            <p style={{fontSize:14,fontWeight:600,color:'#333',marginBottom:4}}>No animals yet</p>
            <p style={{fontSize:12,color:'#888'}}>Add your first animal below.</p>
          </div>
        ) : filtered.map(a => {
          const sc = SPECIES_CONFIG[a.species] || SPECIES_CONFIG['Other']
          const stc = STATUS_CONFIG[a.status] || STATUS_CONFIG['Active']
          return (
            <div key={a.id} style={{background:'#fff',border:'0.5px solid #ddd',borderRadius:8,marginBottom:8,padding:'11px 12px',display:'flex',alignItems:'center',gap:10,cursor:'pointer'}}
              onClick={() => { setSelected(a); setStatusLog([]); loadStatusLog(a.id); setView('detail') }}>
              <div style={{width:38,height:38,borderRadius:8,background:sc.bg,color:sc.color,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0}}>
                {sc.emoji}
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:13,fontWeight:500,marginBottom:3}}>
                  {a.species} {a.tag_number ? <span style={{color:'#888',fontWeight:400}}>#{a.tag_number}</span> : ''}
                </div>
                <div style={{display:'flex',gap:5,flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:10,color:'#888'}}>{a.sex}</span>
                  <span style={{fontSize:10,color:'#ccc'}}>·</span>
                  <span style={{fontSize:10,color:'#888'}}>{a.acquisition_type}</span>
                  {a.purchase_price && <><span style={{fontSize:10,color:'#ccc'}}>·</span><span style={{fontSize:10,color:'#888'}}>${parseFloat(a.purchase_price).toLocaleString()}</span></>}
                  <span style={{background:stc.bg,color:stc.color,fontSize:9,padding:'1px 6px',borderRadius:10,fontWeight:500,marginLeft:2}}>{a.status}</span>
                </div>
              </div>
            </div>
          )
        })}

        {isEditor && (
          <button className="btn btn-primary" style={{marginTop:4,background:'#2D5016'}} onClick={() => { resetForm(); setView('form') }}>
            + Add animal
          </button>
        )}
      </div>
    </div>
  )
}
