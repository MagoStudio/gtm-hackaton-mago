-- Link ICPs → leads → sequences.
-- deals.icp_key: which ICP a deal came from (tagged at approval time).
-- sequences.icp_keys: the ICP(s) a sequence targets (many-to-many via array).
ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS icp_key uuid;
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS icp_keys uuid[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_deals_icp_key ON public.deals (icp_key);
