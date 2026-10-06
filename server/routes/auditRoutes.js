const express = require('express');
const auditController = require('../controllers/auditController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate, requireAdmin);
router.get('/', auditController.listAuditLogs);

module.exports = router;
