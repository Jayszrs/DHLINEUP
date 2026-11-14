CREATE TABLE IF NOT EXISTS fleetsync.occ_assets (
  id varchar(80) PRIMARY KEY,
  category varchar(120) NOT NULL,
  name varchar(200) NOT NULL,
  asset_code varchar(120) NOT NULL DEFAULT '',
  qty integer CHECK(qty IS NULL OR qty>=0),
  brand varchar(150) NOT NULL DEFAULT '',
  model varchar(150) NOT NULL DEFAULT '',
  specifications text NOT NULL DEFAULT '',
  related_device varchar(300) NOT NULL DEFAULT '',
  placement varchar(200) NOT NULL DEFAULT '',
  availability varchar(60) NOT NULL DEFAULT 'To Check',
  condition varchar(60) NOT NULL DEFAULT 'To Check',
  photo_url text NOT NULL DEFAULT '',
  photo_label varchar(200) NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  source_row integer,
  source varchar(80) NOT NULL DEFAULT 'manual',
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fleetsync.occ_assets ALTER COLUMN asset_code TYPE text;
ALTER TABLE fleetsync.occ_assets ADD COLUMN IF NOT EXISTS photos jsonb NOT NULL DEFAULT '[]';
CREATE INDEX IF NOT EXISTS occ_assets_code_prefix ON fleetsync.occ_assets(left(asset_code,120));
DROP INDEX IF EXISTS fleetsync.occ_assets_code;
CREATE TABLE IF NOT EXISTS fleetsync.occ_checks (
  kind varchar(20) NOT NULL CHECK(kind IN ('cctv','availability')),
  work_date date NOT NULL,
  statuses jsonb NOT NULL DEFAULT '{}',
  notes text NOT NULL DEFAULT '',
  source_row integer,
  source varchar(80) NOT NULL DEFAULT 'manual',
  version integer NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(kind,work_date)
);
CREATE INDEX IF NOT EXISTS occ_checks_date ON fleetsync.occ_checks(work_date);
REVOKE ALL ON fleetsync.occ_assets,fleetsync.occ_checks FROM PUBLIC;
