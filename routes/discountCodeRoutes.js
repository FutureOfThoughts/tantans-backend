// src/routes/discountCodeRoutes.js
const express                = require('express');
const discountCodeRouter     = express.Router();
const discountCodeController = require('../controllers/discountCodeController');
const authMiddleware         = require('../middleware/authMiddleware');

// POST /discount-codes/generate — generate a new referral code
discountCodeRouter.post('/generate', authMiddleware, discountCodeController.generateReferralCode);

// GET  /discount-codes — get all codes created by the user
discountCodeRouter.get('/',          authMiddleware, discountCodeController.getUserCodes);

// POST /discount-codes/validate — validate a code without applying it
discountCodeRouter.post('/validate', authMiddleware, discountCodeController.validateCode);

module.exports = discountCodeRouter;