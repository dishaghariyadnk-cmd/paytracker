const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qhujytjjpgwovpzeierr.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFodWp5dGpqcGd3b3ZwemVpZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjMxNzcsImV4cCI6MjEwMTM5OTE3N30.z5Gqh6YHQXK5GsAVNypfzBO3Gnz51mNNBno8vfvQ52s';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

module.exports = supabase;
