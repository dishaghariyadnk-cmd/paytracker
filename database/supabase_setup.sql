-- =================================================================
-- SUPABASE CLOUD POSTGRESQL DATABASE SETUP FOR DISHIV PAYTRACKER
-- =================================================================
-- Instructions:
-- 1. Log in to your free Supabase Dashboard: https://supabase.com
-- 2. Click on "SQL Editor" in the left sidebar.
-- 3. Click "New query", paste this entire SQL script, and click "Run".

-- 0. Reset / Truncate Data for Fresh Start
TRUNCATE TABLE public.transactions;
TRUNCATE TABLE public.ipo_applications;
TRUNCATE TABLE public.audit_logs;

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

-- 3. Monthly Salary & Budget Table
CREATE TABLE IF NOT EXISTS public.monthly_budgets (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(50) DEFAULT 'dishiv',
    monthly_salary NUMERIC(10,2) DEFAULT 0,
    month_year VARCHAR(10) DEFAULT '2026-08',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 4. Audit Logs Table (Device, Login & Access Audit)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50),
    role VARCHAR(20),
    action VARCHAR(100),
    user_agent TEXT,
    device_type VARCHAR(50),
    logged_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 5. Users Table (Database Authentication - Equal Co-Owners)
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    role VARCHAR(20) DEFAULT 'OWNER',
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 6. App Config Table (Permanent API Keys & Google Sheet URL)
CREATE TABLE IF NOT EXISTS public.app_config (
    config_key VARCHAR(100) PRIMARY KEY,
    config_value TEXT NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Pre-seed default couple accounts with Equal Co-Owner privileges (Password: 1234)
INSERT INTO public.users (username, role, password_hash)
VALUES 
  ('dishiv', 'OWNER', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'),
  ('shiv', 'OWNER', '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4')
ON CONFLICT (username) DO UPDATE SET role = 'OWNER';

-- Enable Public Anonymous Read/Write Access for Web App Sync
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ipo_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read/write transactions" ON public.transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write ipo" ON public.ipo_applications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write budget" ON public.monthly_budgets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write audit" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write users" ON public.users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow public read/write config" ON public.app_config FOR ALL USING (true) WITH CHECK (true);
