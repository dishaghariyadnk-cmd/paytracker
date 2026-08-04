const supabase = require('../config/supabase');

exports.getSalary = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('monthly_budgets')
      .select('monthly_salary')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const salary = data ? parseFloat(data.monthly_salary || 0) : 0;
    return res.json({ success: true, salary });
  } catch (err) {
    next(err);
  }
};

exports.saveSalary = async (req, res, next) => {
  try {
    const { salary } = req.body;
    if (isNaN(salary) || salary < 0) {
      return res.status(400).json({ success: false, message: 'Valid salary amount required.' });
    }

    const { error } = await supabase.from('monthly_budgets').insert([{
      user_id: req.user?.username || 'dishiv',
      monthly_salary: salary,
      month_year: new Date().toISOString().slice(0, 7),
      updated_at: new Date().toISOString()
    }]);

    if (error) throw error;

    return res.json({ success: true, salary, message: 'Monthly salary updated successfully.' });
  } catch (err) {
    next(err);
  }
};

exports.getConfig = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { data, error } = await supabase
      .from('app_config')
      .select('config_value')
      .eq('config_key', key)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    return res.json({ success: true, key, value: data ? data.config_value : null });
  } catch (err) {
    next(err);
  }
};

exports.saveConfig = async (req, res, next) => {
  try {
    const { key, value } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ success: false, message: 'Key and value required.' });
    }

    const { error } = await supabase.from('app_config').upsert([{
      config_key: key,
      config_value: value,
      updated_at: new Date().toISOString()
    }]);

    if (error) throw error;

    return res.json({ success: true, message: 'Config saved.' });
  } catch (err) {
    next(err);
  }
};
