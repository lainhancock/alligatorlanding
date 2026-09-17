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

async function getOwnerAdminPhones()
