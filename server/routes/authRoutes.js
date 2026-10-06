const express = require('express');
const authController = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

const router = express.Router();

router.post('/login', authController.login);
router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.me);

module.exports = router;
