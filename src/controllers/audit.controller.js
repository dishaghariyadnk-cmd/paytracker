const supabase = require('../config/supabase');

exports.getAuditLogs = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 30;
    const { data, error } = await supabase
      .from('audit_logs')
      .select('*')
      .order('logged_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return res.json({ success: true, count: (data || []).length, data: data || [] });
  } catch (err) {
    next(err);
  }
};
