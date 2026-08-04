// Database Config & Supabase Client Manager
class DatabaseConfig {
  constructor() {
    this.DEFAULT_SUPABASE_URL = 'https://qhujytjjpgwovpzeierr.supabase.co';
    this.DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFodWp5dGpqcGd3b3ZwemVpZXJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU4MjMxNzcsImV4cCI6MjEwMTM5OTE3N30.z5Gqh6YHQXK5GsAVNypfzBO3Gnz51mNNBno8vfvQ52s';
    
    this.url = localStorage.getItem('paytracker_supabaseUrl') || this.DEFAULT_SUPABASE_URL;
    this.key = localStorage.getItem('paytracker_supabaseKey') || this.DEFAULT_SUPABASE_KEY;
    this.client = null;

    this.init();
  }

  sanitizeUrl(url) {
    if (!url) return '';
    let clean = url.trim();
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = 'https://' + clean;
    }
    try {
      const parsed = new URL(clean);
      clean = parsed.origin;
    } catch (e) {
      clean = clean.replace(/\/+$/, '');
    }
    return clean;
  }

  init() {
    const cleanUrl = this.sanitizeUrl(this.url);
    const cleanKey = (this.key || '').trim();

    if (cleanUrl && cleanKey && typeof supabase !== 'undefined') {
      try {
        this.client = supabase.createClient(cleanUrl, cleanKey);
      } catch (err) {
        console.warn('Database connection failed:', err);
      }
    }
  }

  getClient() {
    if (!this.client) {
      this.init();
    }
    return this.client;
  }

  saveCredentials(url, key) {
    const cleanUrl = this.sanitizeUrl(url);
    this.url = cleanUrl;
    this.key = key.trim();

    localStorage.setItem('paytracker_supabaseUrl', cleanUrl);
    localStorage.setItem('paytracker_supabaseKey', this.key);

    this.init();
  }
}

const dbConfig = new DatabaseConfig();
