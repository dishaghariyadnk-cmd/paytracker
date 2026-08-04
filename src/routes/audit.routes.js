const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { verifyAuth, requireOwner } = require('../middleware/auth.middleware');

router.use(verifyAuth);
router.use(requireOwner);
router.get('/', auditController.getAuditLogs);

module.exports = router;
