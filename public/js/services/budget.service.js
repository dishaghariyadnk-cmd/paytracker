// Budget & Salary API Service
class BudgetService {
  async fetchSalary() {
    const client = dbConfig.getClient();
    if (!client) return 0;

    try {
      const { data, error } = await client
        .from('monthly_budgets')
        .select('monthly_salary')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && data) {
        return parseFloat(data.monthly_salary || 0);
      }
      return 0;
    } catch (err) {
      console.warn('Salary fetch exception:', err);
      return 0;
    }
  }

  async saveSalary(amount) {
    const client = dbConfig.getClient();
    if (!client) return false;

    try {
      const { error } = await client.from('monthly_budgets').insert([{
        user_id: 'dishiv',
        monthly_salary: amount,
        month_year: new Date().toISOString().slice(0, 7),
        updated_at: new Date().toISOString()
      }]);

      if (error) {
        console.warn('Error saving salary to DB:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Salary save exception:', err);
      return false;
    }
  }

  async fetchConfig(key) {
    const client = dbConfig.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client
        .from('app_config')
        .select('config_value')
        .eq('config_key', key)
        .single();

      if (!error && data) {
        return data.config_value;
      }
      return null;
    } catch (err) {
      console.warn('App config fetch exception:', err);
      return null;
    }
  }

  async saveConfig(key, value) {
    const client = dbConfig.getClient();
    if (!client) return false;

    try {
      const { error } = await client.from('app_config').upsert([{
        config_key: key,
        config_value: value,
        updated_at: new Date().toISOString()
      }]);

      if (error) {
        console.warn('Error saving app config to DB:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('App config save exception:', err);
      return false;
    }
  }
}

const budgetService = new BudgetService();
