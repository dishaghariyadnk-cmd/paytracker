const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budget.controller');
const { verifyAuth, requireOwner } = require('../middleware/auth.middleware');

router.use(verifyAuth);
router.get('/salary', budgetController.getSalary);
router.post('/salary', requireOwner, budgetController.saveSalary);
router.get('/config/:key', budgetController.getConfig);
router.post('/config', requireOwner, budgetController.saveConfig);

module.exports = router;
