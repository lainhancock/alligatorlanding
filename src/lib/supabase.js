import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://oaqkevbmyioofceopytr.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9hcWtldmJteWlvb2ZjZW9weXRyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0OTQwMjUsImV4cCI6MjA5NjA3MDAyNX0.LWBKy1-q7od9zOdH7M4hSa1TPL5NuwU8zyfmjG_9XW8'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  }
})
