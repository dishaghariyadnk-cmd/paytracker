const supabase = require('../config/supabase');

exports.getAllTransactions = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (data || []).map(item => ({
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

    return res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    next(err);
  }
};

exports.createTransaction = async (req, res, next) => {
  try {
    const { id, datetime, type, category, amount, paymentMethod, notes, loggedBy, status } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ success: false, message: 'Valid amount is required.' });
    }

    const newTx = {
      id: id || ('TX-' + Date.now() + '-' + Math.floor(Math.random() * 1000)),
      datetime: datetime || new Date().toLocaleString('en-IN'),
      type: type || 'Expense',
      category: category || 'General',
      amount: amount,
      payment_method: paymentMethod || 'GPay',
      notes: notes || '',
      logged_by: loggedBy || req.user?.username || 'Disha',
      status: status || 'Completed'
    };

    const { data, error } = await supabase.from('transactions').insert([newTx]);
    if (error) throw error;

    return res.status(201).json({ success: true, data: newTx });
  } catch (err) {
    next(err);
  }
};

exports.deleteTransaction = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    if (error) throw error;

    return res.json({ success: true, message: 'Transaction deleted successfully.' });
  } catch (err) {
    next(err);
  }
};
