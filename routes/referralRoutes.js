// src/routes/referralRoutes.js
const express            = require('express');
const referralRouter     = express.Router();
const referralController = require('../controllers/referralController');
const authMiddleware     = require('../middleware/authMiddleware');

// GET /referrals/stats — referral stats for the authenticated user
referralRouter.get('/stats', authMiddleware, referralController.getReferralStats);

module.exports = referralRouter;