const express = require('express');
const router = express.Router();
const productController = require('../../controllers/CRUD/productController');

router.get('/', productController.getAllProducts);
router.get('/brand/:brand', productController.getProductsByBrand);
router.get('/:id', productController.getProductById);
router.post('/', productController.createProduct);
router.put('/:id', productController.updateProduct);
router.delete('/:id', productController.deleteProduct);

module.exports = router;

