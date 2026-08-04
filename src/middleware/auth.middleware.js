// Express Auth & Role Middleware
const verifyAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Unauthorized access. Token required.' });
  }

  const token = authHeader.split(' ')[1];
  if (!token || !token.startsWith('DS-JWT-')) {
    return res.status(401).json({ success: false, message: 'Invalid authentication token.' });
  }

  req.user = {
    username: req.headers['x-user-name'] || 'dishiv',
    role: req.headers['x-user-role'] || 'OWNER'
  };

  next();
};

const requireOwner = (req, res, next) => {
  const role = req.headers['x-user-role'] || 'USER';
  if (role !== 'OWNER') {
    return res.status(403).json({ success: false, message: 'Forbidden. Owner rights required.' });
  }
  next();
};

module.exports = { verifyAuth, requireOwner };
