ALTER TABLE fleetsync.lineups ADD COLUMN IF NOT EXISTS equipment_kind varchar(100) NOT NULL DEFAULT '';
ALTER TABLE fleetsync.operators ADD COLUMN IF NOT EXISTS equipment_kind varchar(100) NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS fleetsync.equipment_options (
  category varchar(10) NOT NULL CHECK (category IN ('unit','kind','model')),
  value varchar(100) NOT NULL CHECK (length(trim(value))>0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS equipment_options_unique ON fleetsync.equipment_options(category,lower(value));
ALTER TABLE fleetsync.equipment_options ADD COLUMN IF NOT EXISTS is_removed boolean NOT NULL DEFAULT false;
ALTER TABLE fleetsync.equipment_options ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fleetsync.equipment_options FROM PUBLIC;
