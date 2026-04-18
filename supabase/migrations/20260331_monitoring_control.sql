-- Migration for Monitoring and Control module
CREATE TABLE IF NOT EXISTS monitoring_rows (
    id TEXT PRIMARY KEY, -- GroupKey: service_oae_apoio_resp
    service TEXT NOT NULL,
    oae TEXT NOT NULL,
    apoio TEXT NOT NULL,
    responsible TEXT,
    type_info TEXT,
    daily_data JSONB DEFAULT '{}'::jsonb, -- { "YYYY-MM-DD": { "prev": 10, "real": 5 }, ... }
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id)
);

-- Index for faster filtering by service
CREATE INDEX IF NOT EXISTS idx_monitoring_service ON monitoring_rows(service);

-- Function to handle update timestamp
CREATE OR REPLACE FUNCTION update_monitoring_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tr_monitoring_updated
    BEFORE UPDATE ON monitoring_rows
    FOR EACH ROW
    EXECUTE FUNCTION update_monitoring_timestamp();

-- RLS
ALTER TABLE monitoring_rows ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'monitoring_rows' AND policyname = 'monitoring_rows_access') THEN
        CREATE POLICY monitoring_rows_access ON monitoring_rows FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
