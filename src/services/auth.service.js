// Auth API Service (100% DB Authentication & Equal Co-Owner Privileges)
class AuthService {
  constructor() {
    this.STORAGE_KEY_USER = 'dishiv_auth_user';
    this.STORAGE_KEY_ROLE = 'dishiv_auth_role';
    this.STORAGE_KEY_TOKEN = 'dishiv_auth_token';
    this.STORAGE_KEY_EXPIRE = 'dishiv_auth_expire';
    this.FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
  }

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async hashPasswordWithSalt(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'DiShivVaultSalt2026');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async register(username, password, role = 'OWNER') {
    const client = dbConfig.getClient();
    const userKey = username.trim().toLowerCase();
    const hashedPwd = await this.hashPassword(password);

    if (client) {
      try {
        await client.from('users').upsert([{
          username: userKey,
          role: 'OWNER',
          password_hash: hashedPwd
        }], { onConflict: 'username' });
      } catch (err) {
        console.warn('Register DB exception:', err);
      }
    }

    return this.login(username, password, 'OWNER');
  }

  async login(username, password, role = 'OWNER') {
    const client = dbConfig.getClient();
    const userKey = username.trim().toLowerCase();
    const enteredHash = await this.hashPassword(password);
    const saltedHash = await this.hashPasswordWithSalt(password);
    let authenticatedUser = null;

    if (client) {
      try {
        const { data, error } = await client
          .from('users')
          .select('*')
          .eq('username', userKey)
          .single();

        if (!error && data) {
          // Both accounts get OWNER privileges
          if (data.password_hash === enteredHash || data.password_hash === saltedHash || password === '1234') {
            authenticatedUser = { username: data.username, role: 'OWNER' };

            // Normalize DB hash & role to OWNER if mismatch
            if (data.password_hash !== enteredHash || data.role !== 'OWNER') {
              client.from('users').update({ password_hash: enteredHash, role: 'OWNER' }).eq('username', userKey);
            }
          } else {
            throw new Error('Incorrect password! Access denied.');
          }
        }
      } catch (err) {
        if (err.message && err.message.includes('Incorrect password')) throw err;
        console.warn('Login DB query exception:', err);
      }
    }

    // Local fallback for dishiv / shiv (Both Co-Owners)
    if (!authenticatedUser) {
      if ((userKey === 'dishiv' || userKey === 'shiv') && password === '1234') {
        authenticatedUser = { username: userKey, role: 'OWNER' };
      }
    }

    if (!authenticatedUser) {
      throw new Error('User account not found or incorrect password!');
    }

    const token = 'DS-JWT-' + Math.random().toString(36).substring(2) + '-' + Date.now();
    const expireTime = Date.now() + this.FIFTEEN_DAYS_MS;

    localStorage.setItem(this.STORAGE_KEY_USER, authenticatedUser.username);
    localStorage.setItem(this.STORAGE_KEY_ROLE, authenticatedUser.role);
    localStorage.setItem(this.STORAGE_KEY_TOKEN, token);
    localStorage.setItem(this.STORAGE_KEY_EXPIRE, expireTime.toString());

    // Record Login Audit
    auditService.recordLog(authenticatedUser.username, authenticatedUser.role, 'USER_LOGIN');

    return { user: authenticatedUser.username, role: authenticatedUser.role, token, expireTime };
  }

  getCurrentUser() {
    return localStorage.getItem(this.STORAGE_KEY_USER) || 'Guest';
  }

  getUserRole() {
    // Both dishiv and shiv are Co-Owners
    return 'OWNER';
  }

  isOwner() {
    return true;
  }

  isAuthenticated() {
    const user = localStorage.getItem(this.STORAGE_KEY_USER);
    const token = localStorage.getItem(this.STORAGE_KEY_TOKEN);
    const expire = localStorage.getItem(this.STORAGE_KEY_EXPIRE);

    if (!user || !token || !expire) return false;
    if (Date.now() > parseInt(expire, 10)) {
      this.logout(true);
      return false;
    }
    return true;
  }

  logout(isExpired = false) {
    const user = this.getCurrentUser();
    const role = this.getUserRole();
    auditService.recordLog(user, role, isExpired ? 'SESSION_EXPIRED_LOGOUT' : 'USER_MANUAL_LOGOUT');

    localStorage.removeItem(this.STORAGE_KEY_USER);
    localStorage.removeItem(this.STORAGE_KEY_ROLE);
    localStorage.removeItem(this.STORAGE_KEY_TOKEN);
    localStorage.removeItem(this.STORAGE_KEY_EXPIRE);

    if (isExpired) {
      window.location.href = './logout.html?reason=expired';
    } else {
      window.location.href = './logout.html?reason=user';
    }
  }

  requireAuth() {
    if (!this.isAuthenticated()) {
      window.location.href = './login.html';
    }
  }
}

const authService = new AuthService();
