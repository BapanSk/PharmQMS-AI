const express = require('express');
const userController = require('../controllers/userController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

const router = express.Router();

router.use(authenticate, requireAdmin);

router.get('/', userController.listUsers);
router.post('/', userController.createUser);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

module.exports = router;
