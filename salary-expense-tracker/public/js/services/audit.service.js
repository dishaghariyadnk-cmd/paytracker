// Audit Logs API Service
class AuditService {
  async fetchLogs(limit = 30) {
    const client = dbConfig.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('audit_logs')
        .select('*')
        .order('logged_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.warn('Error fetching audit logs from DB:', error);
        return [];
      }
      return data || [];
    } catch (err) {
      console.warn('Audit logs fetch exception:', err);
      return [];
    }
  }

  async recordLog(username, role, action) {
    const client = dbConfig.getClient();
    const userAgent = navigator.userAgent || 'Unknown Browser';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);
    const deviceType = isMobile ? (navigator.platform || 'Mobile Device') : 'Desktop PC';

    const logEntry = {
      username: username,
      role: role,
      action: action,
      user_agent: userAgent,
      device_type: deviceType,
      logged_at: new Date().toISOString()
    };

    if (!client) return false;

    try {
      const { error } = await client.from('audit_logs').insert([logEntry]);
      if (error) {
        console.warn('Error writing audit log to DB:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Audit log record exception:', err);
      return false;
    }
  }
}

const auditService = new AuditService();
