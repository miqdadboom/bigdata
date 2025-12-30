const express = require('express');
const router = express.Router();
const clientController = require('../../controllers/CRUD/clientController');

router.get('/', clientController.getAllClients);
router.get('/region/:region', clientController.getClientsByRegion);
router.get('/:id', clientController.getClientById);
router.post('/', clientController.createClient);
router.put('/:id', clientController.updateClient);
router.delete('/:id', clientController.deleteClient);

module.exports = router;

