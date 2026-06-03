-- ============================================================
-- ALLIGATOR LANDING PROPERTY MANAGER
-- Database Schema v1.0
-- Paste this entire file into Supabase SQL Editor and run it
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- USERS & PROFILES
-- ============================================================
CREATE TABLE profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'caretaker' CHECK (role IN ('owner','admin','caretaker','contractor','viewer')),
  avatar_initials TEXT,
  phone TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE categories (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true
);

INSERT INTO categories (name, icon, color, sort_order) VALUES
  ('Grounds & Landscaping', 'trees', '#3B6D11', 1),
  ('Structures & Facilities', 'building', '#1A4F8A', 2),
  ('Equipment & Vehicles', 'engine', '#854F0B', 3),
  ('Wildlife & Hunting', 'feather', '#993556', 4),
  ('Mechanical Systems', 'tool', '#3C3489', 5),
  ('Pest Control', 'bug', '#712B13', 6),
  ('Security & Surveillance', 'shield-check', '#444441', 7),
  ('Fuel & Utilities', 'bolt', '#3B6D11', 8),
  ('Firearms & Range', 'target', '#854F0B', 9),
  ('Safety & Emergency', 'first-aid-kit', '#1A4F8A', 10),
  ('Seasonal Projects', 'clipboard-list', '#085041', 11);

-- ============================================================
-- ASSETS
-- ============================================================
CREATE TABLE assets (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  asset_type TEXT NOT NULL CHECK (asset_type IN ('structure','vehicle','boat','area','equipment','other')),
  category_id UUID REFERENCES categories(id),
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO assets (name, asset_type) VALUES
  ('Main house', 'structure'),
  ('Lake house', 'structure'),
  ('OG Tiny House', 'structure'),
  ('Tiny House 2', 'structure'),
  ('Hangar', 'structure'),
  ('Shop', 'structure'),
  ('RO Shed', 'structure'),
  ('Equipment Shed', 'structure'),
  ('Reservoir Well Shed', 'structure'),
  ('Ranger EV', 'vehicle'),
  ('Ranger Work UTV', 'vehicle'),
  ('Honda Work 2-seater', 'vehicle'),
  ('Honda 6-seater', 'vehicle'),
  ('Can-Am', 'vehicle'),
  ('Large John Deere', 'vehicle'),
  ('Small John Deere', 'vehicle'),
  ('Cat Skid Steer', 'vehicle'),
  ('Toyota Tundra', 'vehicle'),
  ('Toy Hauler', 'vehicle'),
  ('RV', 'vehicle'),
  ('Jake''s RV', 'vehicle'),
  ('Two-man Kayak', 'boat'),
  ('Two-man Pond Prowler', 'boat'),
  ('Twin Troller', 'boat'),
  ('Main house/Lake house landscaping', 'area'),
  ('Tiny house landscaping', 'area'),
  ('Hangar/Shop landscaping', 'area'),
  ('Pastures', 'area'),
  ('Roads', 'area'),
  ('Ponds', 'area'),
  ('High fence — full perimeter', 'area'),
  ('Property', 'area'),
  ('Rifle range', 'area');

-- ============================================================
-- TASKS
-- ============================================================
CREATE TABLE tasks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  title TEXT NOT NULL,
  category_id UUID REFERENCES categories(id),
  asset_id UUID REFERENCES assets(id),
  frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','biweekly','monthly','seasonal','as_needed','one_time')),
  frequency_day TEXT, -- e.g. 'monday' for weekly tasks
  photo_required BOOLEAN DEFAULT false,
  default_assignee_id UUID REFERENCES profiles(id),
  instructions TEXT,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('normal','high','critical')),
  active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TASK OCCURRENCES (generated instances of tasks)
-- ============================================================
CREATE TABLE task_occurrences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','completed','skipped','needs_attention','overdue')),
  assigned_to UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TASK COMPLETIONS
-- ============================================================
CREATE TABLE task_completions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  occurrence_id UUID REFERENCES task_occurrences(id) ON DELETE CASCADE,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  gps_lat DECIMAL(10,8),
  gps_lng DECIMAL(11,8)
);

-- ============================================================
-- PHOTOS
-- ============================================================
CREATE TABLE photos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  completion_id UUID REFERENCES task_completions(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  taken_at TIMESTAMPTZ DEFAULT NOW(),
  uploaded_by UUID REFERENCES profiles(id)
);

-- ============================================================
-- COMMENTS
-- ============================================================
CREATE TABLE comments (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  occurrence_id UUID REFERENCES task_occurrences(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EVENTS (Arrivals & Departures)
-- ============================================================
CREATE TABLE events (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('arrival','departure')),
  name TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  guest_count INTEGER DEFAULT 0,
  guests_coming BOOLEAN DEFAULT true,
  flying_in BOOLEAN DEFAULT false,
  notify_hours_before INTEGER DEFAULT 48,
  special_instructions TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled','in_progress','completed','cancelled')),
  approved_by UUID REFERENCES profiles(id),
  approved_at TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EVENT STRUCTURES (which structures are used per event)
-- ============================================================
CREATE TABLE event_structures (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id),
  reset_level TEXT CHECK (reset_level IN ('full','light','skip')),
  assigned_to UUID REFERENCES profiles(id)
);

-- ============================================================
-- EVENT RVS
-- ============================================================
CREATE TABLE event_rvs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  asset_id UUID REFERENCES assets(id),
  action TEXT CHECK (action IN ('bring','skip')),
  after_visit TEXT CHECK (after_visit IN ('keep','return'))
);

-- ============================================================
-- EVENT CHECKLIST ITEMS
-- ============================================================
CREATE TABLE event_checklist_items (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  section TEXT NOT NULL,
  title TEXT NOT NULL,
  photo_required BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES profiles(id),
  completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  photo_path TEXT,
  sort_order INTEGER DEFAULT 0
);

-- ============================================================
-- MEALS
-- ============================================================
CREATE TABLE meals (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  meals_needed BOOLEAN DEFAULT false,
  assigned_to UUID REFERENCES profiles(id),
  order_details TEXT,
  order_confirmed BOOLEAN DEFAULT false,
  order_confirmed_at TIMESTAMPTZ,
  delivery_confirmed BOOLEAN DEFAULT false,
  delivery_confirmed_at TIMESTAMPTZ,
  delivery_photo_path TEXT
);

-- ============================================================
-- HUNTING BLINDS
-- ============================================================
CREATE TABLE hunting_blinds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  blind_type TEXT NOT NULL CHECK (blind_type IN ('box','bow')),
  status TEXT DEFAULT 'ok' CHECK (status IN ('ok','warn','out_of_service')),
  last_inspection DATE,
  notes TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO hunting_blinds (name, blind_type, status, last_inspection) VALUES
  ('North ridge', 'box', 'ok', '2026-05-28'),
  ('Creek bend', 'box', 'ok', '2026-05-28'),
  ('South pasture', 'box', 'warn', '2026-05-10'),
  ('West oak', 'bow', 'ok', '2026-05-28'),
  ('Pine hollow', 'bow', 'ok', '2026-05-20'),
  ('Lake view', 'box', 'ok', '2026-05-28'),
  ('Back pasture', 'bow', 'warn', '2026-04-15'),
  ('East cedar', 'box', 'ok', '2026-05-28'),
  ('River run', 'bow', 'ok', '2026-05-25'),
  ('Mesquite stand', 'box', 'ok', '2026-05-22'),
  ('Hill top', 'bow', 'ok', '2026-05-28');

-- ============================================================
-- FEEDERS
-- ============================================================
CREATE TABLE feeders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  blind_id UUID REFERENCES hunting_blinds(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  feeder_type TEXT NOT NULL CHECK (feeder_type IN ('corn','protein')),
  fill_level INTEGER DEFAULT 75 CHECK (fill_level IN (25,50,75,100)),
  timer_am TIME, -- corn only
  timer_pm TIME, -- corn only
  timer_duration_seconds INTEGER, -- corn only
  last_checked DATE,
  active BOOLEAN DEFAULT true
);

-- ============================================================
-- GAME CAMERAS
-- ============================================================
CREATE TABLE game_cameras (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  blind_id UUID REFERENCES hunting_blinds(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'ok' CHECK (status IN ('ok','low_battery','issue','offline')),
  battery_level INTEGER DEFAULT 100,
  last_checked DATE,
  notes TEXT,
  active BOOLEAN DEFAULT true
);

-- ============================================================
-- HUNT LOGS
-- ============================================================
CREATE TABLE hunt_logs (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  blind_id UUID REFERENCES hunting_blinds(id),
  hunter_id UUID REFERENCES profiles(id),
  hunter_name TEXT, -- for guests not in system
  hunt_date DATE NOT NULL,
  session TEXT CHECK (session IN ('am','pm','all_day')),
  animal_type TEXT,
  sightings INTEGER DEFAULT 0,
  harvest TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EQUIPMENT SERVICE
-- ============================================================
CREATE TABLE equipment_service (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  asset_id UUID REFERENCES assets(id),
  service_needed BOOLEAN DEFAULT false,
  service_description TEXT,
  assigned_to UUID REFERENCES profiles(id),
  completed BOOLEAN DEFAULT false,
  completed_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ,
  photo_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FUEL TRAILER LOG
-- ============================================================
CREATE TABLE fuel_trailer_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  gallons INTEGER NOT NULL,
  position TEXT CHECK (position IN ('storage','staged_helipad','in_transit')),
  logged_by UUID REFERENCES profiles(id),
  logged_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);

-- ============================================================
-- AUDIT LOG
-- ============================================================
CREATE TABLE audit_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  actor_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  diff_json JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('task-photos', 'task-photos', false),
  ('event-photos', 'event-photos', false),
  ('hunting-photos', 'hunting-photos', false);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE hunt_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_service ENABLE ROW LEVEL SECURITY;
ALTER TABLE fuel_trailer_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read everything
CREATE POLICY "Authenticated read all" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON task_occurrences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON task_completions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON event_checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON hunt_logs FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON equipment_service FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON fuel_trailer_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON hunting_blinds FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON feeders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON game_cameras FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON assets FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON photos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read all" ON audit_log FOR SELECT TO authenticated USING (true);

-- Caretakers and above can insert completions, comments, photos
CREATE POLICY "Caretakers can complete tasks" ON task_completions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Caretakers can comment" ON comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Caretakers can upload photos" ON photos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Caretakers can log hunts" ON hunt_logs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Caretakers can log fuel" ON fuel_trailer_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Caretakers can update checklist" ON event_checklist_items FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Caretakers can update feeders" ON feeders FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Caretakers can update cameras" ON game_cameras FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Caretakers can update blinds" ON hunting_blinds FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Caretakers can update occurrences" ON task_occurrences FOR UPDATE TO authenticated USING (true);

-- Only owners/admins can create/edit tasks and events (enforced in app layer)
CREATE POLICY "Anyone can insert tasks" ON tasks FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update tasks" ON tasks FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anyone can insert events" ON events FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update events" ON events FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Anyone can insert occurrences" ON task_occurrences FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone can insert service" ON equipment_service FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Anyone can update service" ON equipment_service FOR UPDATE TO authenticated USING (true);

-- Profiles
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Anyone can insert profile" ON profiles FOR INSERT TO authenticated WITH CHECK (true);

-- Audit log append only
CREATE POLICY "Anyone can insert audit" ON audit_log FOR INSERT TO authenticated WITH CHECK (true);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role, avatar_initials)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'caretaker'),
    UPPER(LEFT(COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), 2))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
