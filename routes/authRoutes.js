// src/routes/auth.js
const express = require('express');
const authRouter = express.Router();
const authController = require('../controllers/authController');

authRouter.post('/signup', authController.signup);
authRouter.post('/login', authController.login);
authRouter.post('/refresh', authController.refresh);
authRouter.post('/logout', authController.logout);

module.exports = authRouter;