const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const authRoutes = require('./src/routes/auth.routes');
const txRoutes = require('./src/routes/tx.routes');
const ipoRoutes = require('./src/routes/ipo.routes');
const budgetRoutes = require('./src/routes/budget.routes');
const auditRoutes = require('./src/routes/audit.routes');
const errorHandler = require('./src/middleware/error.middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// Express Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({ status: 'ok', service: 'DiShiv PayTracker Express API', time: new Date().toISOString() });
});

// API Routes Mounting
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/transactions', txRoutes);
app.use('/api/v1/ipo', ipoRoutes);
app.use('/api/v1/budget', budgetRoutes);
app.use('/api/v1/audit', auditRoutes);

// Global Error Handler
app.use(errorHandler);

// Start Express Server
app.listen(PORT, () => {
  console.log(`🚀 DiShiv PayTracker Express Server running on http://localhost:${PORT}`);
});

module.exports = app;
