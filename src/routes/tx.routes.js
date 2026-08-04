const express = require('express');
const router = express.Router();
const txController = require('../controllers/tx.controller');
const { verifyAuth } = require('../middleware/auth.middleware');

router.use(verifyAuth);
router.get('/', txController.getAllTransactions);
router.post('/', txController.createTransaction);
router.delete('/:id', txController.deleteTransaction);

module.exports = router;
