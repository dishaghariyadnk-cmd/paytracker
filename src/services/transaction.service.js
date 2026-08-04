// Transaction API Service (Expenses CRUD)
class TransactionService {
  async fetchAll() {
    const client = dbConfig.getClient();
    if (!client) return [];

    try {
      const { data, error } = await client
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching transactions from DB:', error);
        return [];
      }

      return (data || []).map(item => ({
        id: item.id,
        datetime: item.datetime,
        type: item.type || 'Expense',
        category: item.category,
        amount: parseFloat(item.amount || 0),
        paymentMethod: item.payment_method,
        notes: item.notes,
        loggedBy: item.logged_by,
        status: item.status
      }));
    } catch (err) {
      console.warn('Transaction fetch exception:', err);
      return [];
    }
  }

  async create(txItem) {
    const client = dbConfig.getClient();
    if (!client) return null;

    try {
      const { data, error } = await client.from('transactions').insert([{
        id: txItem.id,
        datetime: txItem.datetime,
        type: txItem.type || 'Expense',
        category: txItem.category,
        amount: txItem.amount,
        payment_method: txItem.paymentMethod,
        notes: txItem.notes,
        logged_by: txItem.loggedBy,
        status: txItem.status || 'Completed'
      }]);

      if (error) {
        console.warn('Error creating transaction in DB:', error);
      }
      return data;
    } catch (err) {
      console.warn('Transaction create exception:', err);
      return null;
    }
  }

  async delete(txId) {
    const client = dbConfig.getClient();
    if (!client) return false;

    try {
      const { error } = await client.from('transactions').delete().eq('id', txId);
      if (error) {
        console.warn('Error deleting transaction in DB:', error);
        return false;
      }
      return true;
    } catch (err) {
      console.warn('Transaction delete exception:', err);
      return false;
    }
  }
}

const transactionService = new TransactionService();
