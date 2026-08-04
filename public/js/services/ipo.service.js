// IPO Application API Service (CRUD)
class IPOService {
  async fetchAll() {
    const client = dbConfig.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('ipo_applications')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching IPO applications from DB:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        name: item.name,
        amount: parseFloat(item.amount || 0),
        paymentMethod: item.payment_method,
        date: item.date,
        status: item.status
      }));
    } catch (err) {
      console.warn('IPO fetch exception:', err);
      return [];
    }
  }

  async create(ipoItem) {
    const client = dbConfig.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client.from('ipo_applications').insert([{
        id: ipoItem.id,
        name: ipoItem.name,
        amount: ipoItem.amount,
        payment_method: ipoItem.paymentMethod,
        date: ipoItem.date,
        status: ipoItem.status || 'Blocked'
      }]);

      if (error) {
        console.warn('Error creating IPO application in DB:', error);
      }
      return data;
    } catch (err) {
      console.warn('IPO create exception:', err);
      return null;
    }
  }

  async updateStatus(ipoId, newStatus) {
    const client = dbConfig.getClient();
    if (!client) return false;

    try {
      const { error } = await client
        .from('ipo_applications')
        .update({ status: newStatus })
        .eq('id', ipoId);

      if (error) {
        console.warn('Error updating IPO status in DB:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('IPO status update exception:', err);
      return false;
    }
  }

  async delete(ipoId) {
    const client = dbConfig.getClient();
    if (!client) return false;

    try {
      const { error } = await client.from('ipo_applications').delete().eq('id', ipoId);
      if (error) {
        console.warn('Error deleting IPO application in DB:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('IPO delete exception:', err);
      return false;
    }
  }
}

const ipoService = new IPOService();
