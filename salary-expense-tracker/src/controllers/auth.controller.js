const crypto = require('crypto');
const supabase = require('../config/supabase');

const hashPassword = (password) => {
  return crypto.createHash('sha256').update(password + 'DiShivVaultSalt2026').digest('hex');
};

exports.register = async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required.' });
    }

    const userKey = username.trim().toLowerCase();
    const userRole = role || 'OWNER';
    const passwordHash = hashPassword(password);

    const { data, error } = await supabase.from('users').insert([{
      username: userKey,
      role: userRole,
      password_hash: passwordHash
    }]);

    if (error && error.code === '23505') {
      return res.status(400).json({ success: false, message: 'User account already exists!' });
    }

    const token = 'DS-JWT-' + Math.random().toString(36).substring(2) + '-' + Date.now();
    const expireTime = Date.now() + (15 * 24 * 60 * 60 * 1000);

    return res.status(201).json({
      success: true,
      user: userKey,
      role: userRole,
      token,
      expireTime
    });
  } catch (err) {
    next(err);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password required.' });
    }

    const userKey = username.trim().toLowerCase();
    const enteredHash = hashPassword(password);

    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('username', userKey)
      .single();

    let authenticatedUser = null;

    if (!error && data) {
      if (data.password_hash === enteredHash) {
        authenticatedUser = { username: data.username, role: data.role };
      } else {
        return res.status(401).json({ success: false, message: 'Incorrect password! Access denied.' });
      }
    }

    // Default Seed Fallback if table unseeded
    if (!authenticatedUser) {
      if (userKey === 'dishiv' || userKey === 'shiv') {
        const defaultHash = hashPassword('1234');
        const defaultRole = userKey === 'dishiv' ? 'OWNER' : 'USER';
        if (enteredHash === defaultHash) {
          authenticatedUser = { username: userKey, role: defaultRole };
        }
      }
    }

    if (!authenticatedUser) {
      return res.status(404).json({ success: false, message: 'User account not found!' });
    }

    const token = 'DS-JWT-' + Math.random().toString(36).substring(2) + '-' + Date.now();
    const expireTime = Date.now() + (15 * 24 * 60 * 60 * 1000);

    // Record audit log
    const userAgent = req.headers['user-agent'] || 'Unknown Browser';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(userAgent);
    const deviceType = isMobile ? 'Mobile Device' : 'Desktop PC';

    await supabase.from('audit_logs').insert([{
      username: authenticatedUser.username,
      role: authenticatedUser.role,
      action: 'USER_LOGIN',
      user_agent: userAgent,
      device_type: deviceType
    }]);

    return res.json({
      success: true,
      user: authenticatedUser.username,
      role: authenticatedUser.role,
      token,
      expireTime
    });
  } catch (err) {
    next(err);
  }
};
