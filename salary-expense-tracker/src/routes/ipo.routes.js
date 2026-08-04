const express = require('express');
const router = express.Router();
const ipoController = require('../controllers/ipo.controller');
const { verifyAuth } = require('../middleware/auth.middleware');

router.use(verifyAuth);
router.get('/', ipoController.getAllIPOs);
router.post('/', ipoController.createIPO);
router.patch('/:id/status', ipoController.updateIPOStatus);
router.delete('/:id', ipoController.deleteIPO);

module.exports = router;
