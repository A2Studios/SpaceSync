-- Create Houses Table
CREATE TABLE houses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  num_roommates INT NOT NULL,
  theme TEXT DEFAULT 'default',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Roommates Table (Slots)
CREATE TABLE roommates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID REFERENCES houses(id) ON DELETE CASCADE,
  slot_index INT NOT NULL,
  name TEXT,
  note TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Supplies Table
CREATE TABLE supplies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID REFERENCES houses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  quantity INT DEFAULT 3,
  assigned_to UUID REFERENCES roommates(id) ON DELETE SET NULL,
  last_bought_by TEXT,
  last_bought_qty INT,
  last_bought_price NUMERIC DEFAULT 0,
  split_money BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create Chores / To-do Table
CREATE TABLE todos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  house_id UUID REFERENCES houses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assigned_to UUID REFERENCES roommates(id) ON DELETE SET NULL,
  completed BOOLEAN DEFAULT FALSE,
  is_recurring BOOLEAN DEFAULT TRUE,
  last_completed_by TEXT,
  last_completed_at TIMESTAMPTZ,
  completion_counts JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Set up Row Level Security (RLS) to allow all operations (no auth required)
ALTER TABLE houses ENABLE ROW LEVEL SECURITY;
ALTER TABLE roommates ENABLE ROW LEVEL SECURITY;
ALTER TABLE supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE todos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on houses" ON houses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on roommates" ON roommates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on supplies" ON supplies FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on todos" ON todos FOR ALL USING (true) WITH CHECK (true);

-- Enable Realtime for the required tables
alter publication supabase_realtime add table houses;
alter publication supabase_realtime add table roommates;
alter publication supabase_realtime add table supplies;
alter publication supabase_realtime add table todos;

-- Set REPLICA IDENTITY to FULL so that DELETE payloads include all columns (fixes realtime filtering issues)
ALTER TABLE supplies REPLICA IDENTITY FULL;
ALTER TABLE roommates REPLICA IDENTITY FULL;
ALTER TABLE todos REPLICA IDENTITY FULL;
