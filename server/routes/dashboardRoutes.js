const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/authMiddleware');
const { authorize } = require('../middleware/roleMiddleware');
const { ROLES } = require('../utils/constants');

const router = express.Router();

router.use(authenticate, authorize(ROLES.QA_MANAGER, ROLES.QA_ANALYST));

router.get('/stats', dashboardController.getStats);
router.get('/assignees', dashboardController.listAssignees);

module.exports = router;
