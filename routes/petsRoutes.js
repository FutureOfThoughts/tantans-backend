// src/routes/pets.js
const express = require('express');
const petsRouter = express.Router();
const petsController = require('../controllers/petsController');
const authMiddleware = require('../middleware/auth');

petsRouter.get('/', authMiddleware, petsController.getPets);
petsRouter.post('/', authMiddleware, petsController.addPet);
petsRouter.patch('/:petId', authMiddleware, petsController.updatePet);
petsRouter.delete('/:petId', authMiddleware, petsController.deletePet);

module.exports = petsRouter;