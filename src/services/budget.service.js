// Budget & Salary API Service (Exact DB Persistence)
class BudgetService {
  async fetchSalary() {
    const localSalary = localStorage.getItem('paytracker_savedSalary');
    const client = dbConfig.getClient();

    if (!client) {
      return localSalary ? parseFloat(localSalary) : 0;
    }

    try {
      const { data, error } = await client
        .from('monthly_budgets')
        .select('monthly_salary')
        .order('updated_at', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0 && data[0].monthly_salary !== null) {
        const dbSalary = parseFloat(data[0].monthly_salary);
        localStorage.setItem('paytracker_savedSalary', dbSalary.toString());
        return dbSalary;
      }
      
      return localSalary ? parseFloat(localSalary) : 0;
    } catch (err) {
      console.warn('Salary fetch exception:', err);
      return localSalary ? parseFloat(localSalary) : 0;
    }
  }

  async saveSalary(amount) {
    localStorage.setItem('paytracker_savedSalary', amount.toString());
    const client = dbConfig.getClient();
    if (!client) return true;

    try {
      const { error } = await client.from('monthly_budgets').insert([{
        user_id: 'dishiv',
        monthly_salary: amount,
        month_year: new Date().toISOString().slice(0, 7),
        updated_at: new Date().toISOString()
      }]);

      if (error) {
        console.warn('Error saving salary to DB:', error);
      }
      return true;
    } catch (err) {
      console.warn('Salary save exception:', err);
      return true;
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
        .limit(1);

      if (!error && data && data.length > 0) {
        return data[0].config_value;
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
