// src/routes/authRoutes.js
const express = require('express');
const authRouter = express.Router();
const authController = require('../controllers/authController');

authRouter.post('/signup',       authController.signup);
authRouter.post('/login',        authController.login);
authRouter.post('/check-email',  authController.checkEmail);
authRouter.post('/refresh',      authController.refresh);
authRouter.post('/logout',       authController.logout);

module.exports = authRouter;