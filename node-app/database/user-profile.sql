ALTER TABLE fleetsync.users ADD COLUMN IF NOT EXISTS nik varchar(60) NOT NULL DEFAULT '';
ALTER TABLE fleetsync.users ADD COLUMN IF NOT EXISTS site varchar(10) NOT NULL DEFAULT '' CHECK (site IN ('','BCP','ACP','KCP','SSCP'));
ALTER TABLE fleetsync.users ADD COLUMN IF NOT EXISTS profile_photo varchar(255) NOT NULL DEFAULT '';
ALTER TABLE fleetsync.upload_tickets DROP CONSTRAINT IF EXISTS upload_tickets_kind_check;
ALTER TABLE fleetsync.upload_tickets ADD CONSTRAINT upload_tickets_kind_check CHECK (kind IN ('proof_ftw','proof_mine','spreadsheet','profile_photo'));
