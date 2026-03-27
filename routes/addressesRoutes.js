// src/routes/addresses.js
const express = require('express');
const addressesRouter = express.Router();
const addressesController = require('../controllers/addressesController');
const authMiddleware = require('../middleware/authMiddleware');

addressesRouter.get('/', authMiddleware, addressesController.getAddresses);
addressesRouter.post('/', authMiddleware, addressesController.addAddress);
addressesRouter.patch('/:addressId', authMiddleware, addressesController.updateAddress);
addressesRouter.delete('/:addressId', authMiddleware, addressesController.deleteAddress);

module.exports = addressesRouter;