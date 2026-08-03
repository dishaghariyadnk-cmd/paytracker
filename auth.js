// DiShiv PayTracker - Professional Auth & 15-Day Session Engine
class DiShivAuthEngine {
  constructor() {
    this.STORAGE_KEY_USER = 'dishiv_auth_user';
    this.STORAGE_KEY_TOKEN = 'dishiv_auth_token';
    this.STORAGE_KEY_EXPIRE = 'dishiv_auth_expire';
    this.FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
  }

  // Cryptographic SHA-256 Password Hash
  async hashPassword(passwordText) {
    const encoder = new TextEncoder();
    const data = encoder.encode('DISHIV_BANK_SALT_PRO_2026_' + passwordText);
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  // Check if current session is valid and not expired (< 15 days)
  isAuthenticated() {
    const user = localStorage.getItem(this.STORAGE_KEY_USER);
    const token = localStorage.getItem(this.STORAGE_KEY_TOKEN);
    const expireTime = parseInt(localStorage.getItem(this.STORAGE_KEY_EXPIRE) || '0', 10);
    const now = Date.now();

    if (!user || !token || !expireTime) {
      return false;
    }

    if (now > expireTime) {
      // 15-day session expired! Revoke session
      this.logout(true); // true = expired
      return false;
    }

    return true;
  }

  // Require Auth Guard (Redirects unauthenticated or expired users to login.html)
  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = './login.html';
    }
  }

  // Register New Account
  async register(username, password) {
    const existingUsers = JSON.parse(localStorage.getItem('dishiv_registered_users') || '{}');
    const userKey = username.trim().toLowerCase();

    if (existingUsers[userKey]) {
      throw new Error('User account already exists! Please login.');
    }

    const hashedPwd = await this.hashPassword(password);
    existingUsers[userKey] = {
      username: username.trim(),
      passwordHash: hashedPwd,
      created: new Date().toISOString()
    };

    localStorage.setItem('dishiv_registered_users', JSON.stringify(existingUsers));
    return this.login(username, password);
  }

  // Login Existing Account & Create 15-Day Session
  async login(username, password) {
    const existingUsers = JSON.parse(localStorage.getItem('dishiv_registered_users') || '{}');
    const userKey = username.trim().toLowerCase();

    // Default Seed user if no users registered yet
    if (Object.keys(existingUsers).length === 0) {
      // Pre-seed default couple account
      const defaultHash = await this.hashPassword(password);
      existingUsers[userKey] = {
        username: username.trim(),
        passwordHash: defaultHash,
        created: new Date().toISOString()
      };
      localStorage.setItem('dishiv_registered_users', JSON.stringify(existingUsers));
    }

    const userAccount = existingUsers[userKey];
    if (!userAccount) {
      throw new Error('User account not found! Check username or register.');
    }

    const enteredHash = await this.hashPassword(password);
    if (enteredHash !== userAccount.passwordHash) {
      throw new Error('Incorrect password! Access denied.');
    }

    // Auth Successful! Issue 15-day token
    const token = 'DS-JWT-' + Math.random().toString(36).substring(2) + '-' + Date.now();
    const expireTime = Date.now() + this.FIFTEEN_DAYS_MS;

    localStorage.setItem(this.STORAGE_KEY_USER, userAccount.username);
    localStorage.setItem(this.STORAGE_KEY_TOKEN, token);
    localStorage.setItem(this.STORAGE_KEY_EXPIRE, expireTime.toString());

    return { user: userAccount.username, token, expireTime };
  }

  // Logout Current Session
  logout(isExpired = false) {
    localStorage.removeItem(this.STORAGE_KEY_USER);
    localStorage.removeItem(this.STORAGE_KEY_TOKEN);
    localStorage.removeItem(this.STORAGE_KEY_EXPIRE);
    sessionStorage.clear();

    if (isExpired) {
      window.location.href = './logout.html?reason=expired';
    } else {
      window.location.href = './logout.html?reason=user';
    }
  }

  getCurrentUser() {
    return localStorage.getItem(this.STORAGE_KEY_USER) || 'Disha & Shivdattsinh';
  }

  getDaysRemainingInSession() {
    const expireTime = parseInt(localStorage.getItem(this.STORAGE_KEY_EXPIRE) || '0', 10);
    const msLeft = expireTime - Date.now();
    return Math.max(0, Math.ceil(msLeft / (1000 * 60 * 60 * 24)));
  }
}

// Global Auth Engine Instance
const auth = new DiShivAuthEngine();
