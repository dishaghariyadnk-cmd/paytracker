// Frontend API Client Layer for Express REST APIs
class ApiClient {
  constructor() {
    this.BASE_URL = window.location.origin.includes('localhost') || window.location.origin.includes('127.0.0.1') 
      ? 'http://localhost:3000/api/v1' 
      : 'https://qhujytjjpgwovpzeierr.supabase.co/rest/v1';
  }

  getHeaders() {
    const token = localStorage.getItem('dishiv_auth_token') || '';
    const user = localStorage.getItem('dishiv_auth_user') || 'dishiv';
    const role = localStorage.getItem('dishiv_auth_role') || 'OWNER';

    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-user-name': user,
      'x-user-role': role
    };
  }

  async get(endpoint) {
    try {
      const res = await fetch(`${this.BASE_URL}${endpoint}`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      return await res.json();
    } catch (err) {
      console.warn(`API GET ${endpoint} error:`, err);
      return { success: false, data: [] };
    }
  }

  async post(endpoint, body) {
    try {
      const res = await fetch(`${this.BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (err) {
      console.warn(`API POST ${endpoint} error:`, err);
      return { success: false };
    }
  }

  async delete(endpoint) {
    try {
      const res = await fetch(`${this.BASE_URL}${endpoint}`, {
        method: 'DELETE',
        headers: this.getHeaders()
      });
      return await res.json();
    } catch (err) {
      console.warn(`API DELETE ${endpoint} error:`, err);
      return { success: false };
    }
  }
}

const api = new ApiClient();
