// src/routes/profile.js
const express = require('express');
const profileRouter = express.Router();
const profileController = require('../controllers/profileController');
const authMiddleware = require('../middleware/authMiddleware');

profileRouter.get('/', authMiddleware, profileController.getProfile);
profileRouter.patch('/', authMiddleware, profileController.updateProfile);

module.exports = profileRouter;