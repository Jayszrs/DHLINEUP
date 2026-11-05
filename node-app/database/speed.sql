CREATE TABLE IF NOT EXISTS fleetsync.speed_units (
  unit varchar(60) PRIMARY KEY,
  fleet varchar(150) NOT NULL DEFAULT 'DT DARMA HENWA',
  site varchar(10) NOT NULL DEFAULT 'BCP',
  source_gid bigint,
  raw_path text NOT NULL DEFAULT '',
  raw_count integer NOT NULL DEFAULT 0,
  registry jsonb NOT NULL DEFAULT '{}',
  note text NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS fleetsync.speed_daily (
  unit varchar(60) NOT NULL REFERENCES fleetsync.speed_units(unit),
  work_date date NOT NULL,
  total_count integer NOT NULL CHECK(total_count>=0),
  moving_count integer NOT NULL CHECK(moving_count>=0 AND moving_count<=total_count),
  speed_sum numeric(20,4) NOT NULL CHECK(speed_sum>=0),
  max_speed numeric(12,4) NOT NULL CHECK(max_speed>=0),
  source varchar(30) NOT NULL DEFAULT 'manual',
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(unit,work_date)
);
CREATE INDEX IF NOT EXISTS speed_daily_date ON fleetsync.speed_daily(work_date,unit);
CREATE TABLE IF NOT EXISTS fleetsync.speed_source_sheets (
  gid bigint PRIMARY KEY,
  name text NOT NULL,
  object_path text NOT NULL,
  source_rows integer NOT NULL,
  checksum char(64) NOT NULL,
  imported_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fleetsync.speed_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleetsync.speed_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE fleetsync.speed_source_sheets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fleetsync.speed_units,fleetsync.speed_daily,fleetsync.speed_source_sheets FROM PUBLIC;
