const express = require('express');
const router = express.Router();
const authController = require('../../controllers/CRUD/authController');

router.post('/login', authController.login);
router.get('/me', authController.getCurrentUser);

module.exports = router;

