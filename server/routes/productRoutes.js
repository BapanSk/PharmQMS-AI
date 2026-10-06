const express = require('express');
const productController = require('../controllers/productController');
const { authenticate, optionalAuthenticate } = require('../middleware/authMiddleware');
const { requireAdmin } = require('../middleware/roleMiddleware');

const router = express.Router();

router.get('/', optionalAuthenticate, productController.listProducts);
router.post('/', authenticate, requireAdmin, productController.createProduct);
router.put('/:id', authenticate, requireAdmin, productController.updateProduct);

module.exports = router;
