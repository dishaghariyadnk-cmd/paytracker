-- =================================================================
-- SUPABASE CLOUD POSTGRESQL DATABASE SETUP FOR DISHIV PAYTRACKER
-- =================================================================
-- Instructions:
-- 1. Log in to your free Supabase Dashboard: https://supabase.com
-- 2. Create a project (e.g., dishiv-paytracker).
-- 3. Click on "SQL Editor" in the left sidebar.
-- 4. Click "New query", paste this entire SQL script, and click "Run".
-- 5. Go to Project Settings -> API. Copy your "Project URL" and "anon public key".
-- 6. Paste them into the Sync & Database tab inside your DiShiv PayTracker App!

-- 1. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
    id VARCHAR(100) PRIMARY KEY,
    datetime VARCHAR(50),
    type VARCHAR(30) DEFAULT 'Expense',
    category VARCHAR(50),
    amount NUMERIC(10,2),
    payment_method VARCHAR(30),
    notes TEXT,
    logged_by VARCHAR(50),
    status VARCHAR(30) DEFAULT 'Completed',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 2. IPO Applications Table
CREATE TABLE IF NOT EXISTS public.ipo_applications (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100),
    amount NUMERIC(10,2),
    payment_method VARCHAR(30),
    date VARCHAR(50),
    status VARCHAR(30) DEFAULT 'Blocked',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Audit Logs Table (Device, Login & Access Audit)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50),
    role VARCHAR(20),
    action VARCHAR(100),
    user_agent TEXT,
    device_type VARCHAR(50),
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Enable Public Anonymous Read/Write Access for Web App Sync
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipo_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write ipo" ON public.ipo_applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write audit" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
