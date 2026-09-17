import { supabase } from './supabase'

const SUPABASE_URL = 'https://oaqkevbmyioofceopytr.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hcWtldmJteWlvb2ZjZW9weXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTQwMjUsImV4cCI6MjA5NjA3MDAyNX0.LWBKy1-q7od9zOdH7M4hSa1TPL5NuwU8zyfmjG_9XW8'

export async function sendSMS(to, message) {
  if (!to || !message) return
  try {
    await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      },
      body: JSON.stringify({ to, message })
    })
  } catch (err) {
    console.error('SMS error:', err)
  }
}

async function getPhonesByNames(names) {
  const { data } = await supabase
    .from('profiles')
    .select('phone, full_name')
    .in('full_name', names)
    .not('phone', 'is', null)
  return data?.map(p => p.phone) || []
}

async function getOwnerAdminPhones() {
  return getPhonesByNames(['Lain Hancock', 'Clare Bambury'])
}

async function getTraceScottPhones() {
  return getPhonesByNames(['Trace', 'Scott Holcomb'])
}

async function getAssigneePhone(name) {
  if (!name || name === 'Unassigned') return null
  const { data } = await supabase
    .from('profiles')
    .select('phone')
    .eq('full_name', name)
    .maybeSingle()
  return data?.phone || null
}

async function sendToAll(phones, message) {
  const unique = [...new Set(phones.filter(Boolean))]
  for (const phone of unique) {
    await sendSMS(phone, message)
  }
}

// Task assigned — assignee only
export async function notifyTaskAssigned(taskTitle, assigneeName) {
  const phone = await getAssigneePhone(assigneeName)
  if (!phone) return
  await sendSMS(phone, `Alligator Landing: You have been assigned a task - "${taskTitle}". View at alligatorlanding.com. Reply STOP to opt out.`)
}

// Work order assigned — assignee only
export async function notifyWorkOrderAssigned(workOrder) {
  const phone = await getAssigneePhone(workOrder.assigned_to_name)
  if (!phone) return
  const dueText = workOrder.due_date ? ` Due: ${new Date(workOrder.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.` : ''
  await sendSMS(phone, `Alligator Landing: New work order assigned to you - "${workOrder.title}".${dueText} View at alligatorlanding.com. Reply STOP to opt out.`)
}

// Work order updated or completed — Lain only
export async function notifyWorkOrderUpdated(workOrderTitle, newStatus, updatedByName) {
  const { data } = await supabase
    .from('profiles')
    .select('phone')
    .eq('full_name', 'Lain Hancock')
    .maybeSingle()
  if (!data?.phone) return
  const statusText = newStatus === 'done' ? 'completed' : newStatus === 'inprogress' ? 'marked in progress' : newStatus === 'blocked' ? 'marked blocked' : 'updated'
  await sendSMS(data.phone, `Alligator Landing: Work order "${workOrderTitle}" was ${statusText} by ${updatedByName || 'crew'}. View at alligatorlanding.com. Reply STOP to opt out.`)
}

// Event created — Lain + Clare + Trace + Scott
export async function notifyEventCreated(eventName, eventDate) {
  const phones = [
    ...await getOwnerAdminPhones(),
    ...await getTraceScottPhones()
  ]
  const dateStr = new Date(eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  await sendToAll(phones, `Alligator Landing: New event scheduled - "${eventName}" on ${dateStr}. View at alligatorlanding.com. Reply STOP to opt out.`)
}
