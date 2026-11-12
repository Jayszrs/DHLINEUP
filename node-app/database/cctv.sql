CREATE TABLE IF NOT EXISTS fleetsync.cctv_daily (
 site varchar(12) NOT NULL CHECK(site IN ('ACP','KCP','BCP','BPP','HO','SSCP')),
 work_date date NOT NULL,
 total_count integer NOT NULL CHECK(total_count>0 AND total_count<=10000),
 down_count integer NOT NULL CHECK(down_count>=0 AND down_count<=total_count),
 online_count integer NOT NULL CHECK(online_count>=0 AND online_count<=total_count),
 availability_percent numeric(14,10) NOT NULL CHECK(availability_percent>=0 AND availability_percent<=100),
 remarks text NOT NULL DEFAULT '',
 incidents jsonb NOT NULL DEFAULT '[]' CHECK(jsonb_typeof(incidents)='array'),
 source_snapshot jsonb NOT NULL DEFAULT '{}',
 source_flags jsonb NOT NULL DEFAULT '[]',
 source varchar(20) NOT NULL DEFAULT 'manual' CHECK(source IN ('manual','sheet')),
 version integer NOT NULL DEFAULT 1,
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(site,work_date)
);
CREATE INDEX IF NOT EXISTS cctv_daily_date_site ON fleetsync.cctv_daily(work_date,site);
REVOKE ALL ON fleetsync.cctv_daily FROM PUBLIC;
