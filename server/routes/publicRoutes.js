const express = require('express');
const complaintController = require('../controllers/complaintController');
const productController = require('../controllers/productController');

const router = express.Router();

router.get('/products', productController.listProducts);
router.get('/track/:complaintId', complaintController.trackComplaint);

module.exports = router;
