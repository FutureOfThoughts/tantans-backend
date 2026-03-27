// src/routes/services.js
const express = require('express');
const servicesRouter = express.Router();
const servicesController = require('../controllers/servicesController');

servicesRouter.get('/', servicesController.getAllServices);
servicesRouter.get('/:slug', servicesController.getServiceBySlug);

module.exports = servicesRouter;