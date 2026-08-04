const supabase = require('../config/supabase');

exports.getAllIPOs = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('ipo_applications')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const formatted = (data || []).map(item => ({
      id: item.id,
      name: item.name,
      amount: parseFloat(item.amount || 0),
      paymentMethod: item.payment_method,
      date: item.date,
      status: item.status
    }));

    return res.json({ success: true, count: formatted.length, data: formatted });
  } catch (err) {
    next(err);
  }
};

exports.createIPO = async (req, res, next) => {
  try {
    const { id, name, amount, paymentMethod, date, status } = req.body;

    if (!name || !amount) {
      return res.status(400).json({ success: false, message: 'IPO name and amount required.' });
    }

    const newIPO = {
      id: id || ('IPO-' + Date.now()),
      name: name,
      amount: amount,
      payment_method: paymentMethod || 'Netbanking',
      date: date || new Date().toLocaleDateString('en-IN'),
      status: status || 'Blocked'
    };

    const { error } = await supabase.from('ipo_applications').insert([newIPO]);
    if (error) throw error;

    return res.status(201).json({ success: true, data: newIPO });
  } catch (err) {
    next(err);
  }
};

exports.updateIPOStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const { error } = await supabase
      .from('ipo_applications')
      .update({ status: status })
      .eq('id', id);

    if (error) throw error;

    return res.json({ success: true, message: 'IPO status updated.' });
  } catch (err) {
    next(err);
  }
};

exports.deleteIPO = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { error } = await supabase.from('ipo_applications').delete().eq('id', id);
    if (error) throw error;

    return res.json({ success: true, message: 'IPO record deleted.' });
  } catch (err) {
    next(err);
  }
};
