// DiShiv Auth Engine Wrapper (Delegates to modular AuthService)
class DiShivAuthEngine {
  constructor() {
    this.FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000;
  }

  async hashPassword(password) {
    return authService.hashPassword(password);
  }

  async register(username, password, role = 'OWNER') {
    return authService.register(username, password, role);
  }

  async login(username, password, role = 'OWNER') {
    return authService.login(username, password, role);
  }

  getCurrentUser() {
    return authService.getCurrentUser();
  }

  getUserRole() {
    return authService.getUserRole();
  }

  isOwner() {
    return authService.isOwner();
  }

  isAuthenticated() {
    return authService.isAuthenticated();
  }

  logout(isExpired = false) {
    authService.logout(isExpired);
  }

  requireAuth() {
    authService.requireAuth();
  }
}

const auth = new DiShivAuthEngine();
