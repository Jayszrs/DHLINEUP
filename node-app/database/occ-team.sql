CREATE TABLE IF NOT EXISTS fleetsync.occ_team_profiles (
 nik varchar(60) PRIMARY KEY,
 bio varchar(2000) NOT NULL DEFAULT '',
 work_status varchar(80) NOT NULL DEFAULT 'Belum diperbarui',
 photo_path text NOT NULL DEFAULT '',
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE fleetsync.occ_team_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON fleetsync.occ_team_profiles FROM PUBLIC;
