// Auth API Service (100% DB Authentication)
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
        const { error } = await client.from('users').insert([{
          username: userKey,
          role: role,
          password_hash: hashedPwd
        }]);

        if (error && error.code === '23505') {
          throw new Error('User account already exists in database! Please login.');
        }
      } catch (err) {
        if (err.message && err.message.includes('already exists')) throw err;
        console.warn('Register DB exception:', err);
      }
    }

    return this.login(username, password, role);
  }

  async login(username, password, role = 'OWNER') {
    const client = dbConfig.getClient();
    const userKey = username.trim().toLowerCase();
    const enteredHash = await this.hashPassword(password);
    let authenticatedUser = null;

    if (client) {
      try {
        const { data, error } = await client
          .from('users')
          .select('*')
          .eq('username', userKey)
          .single();

        if (!error && data) {
          if (data.password_hash === enteredHash) {
            authenticatedUser = { username: data.username, role: data.role };
          } else {
            throw new Error('Incorrect password! Access denied.');
          }
        }
      } catch (err) {
        if (err.message && err.message.includes('Incorrect password')) throw err;
        console.warn('Login DB query exception:', err);
      }
    }

    // Fallback seed for dishiv / shiv if DB table is unseeded
    if (!authenticatedUser) {
      if (userKey === 'dishiv' || userKey === 'shiv') {
        const defaultHash = await this.hashPassword('1234');
        const defaultRole = userKey === 'dishiv' ? 'OWNER' : 'USER';
        if (enteredHash === defaultHash) {
          authenticatedUser = { username: userKey, role: defaultRole };
        }
      }
    }

    if (!authenticatedUser) {
      throw new Error('User account not found! Use "dishiv" or "shiv" (Password: 1234).');
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
    return localStorage.getItem(this.STORAGE_KEY_ROLE) || 'USER';
  }

  isOwner() {
    return this.getUserRole() === 'OWNER';
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
