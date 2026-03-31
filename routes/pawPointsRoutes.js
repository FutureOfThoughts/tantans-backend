// src/routes/paymentRoutes.js
const express             = require('express');
const paymentRouter       = express.Router({ mergeParams: true });
const paymentController   = require('../controllers/paymentController');
const pawPointsController = require('../controllers/pawPointsController');
const authMiddleware      = require('../middleware/authMiddleware');

// POST /bookings/:bookingId/payment-intent
paymentRouter.post('/payment-intent',        authMiddleware, paymentController.createPaymentIntent);

// POST /bookings/:bookingId/confirm-authorisation
paymentRouter.post('/confirm-authorisation', authMiddleware, paymentController.confirmAuthorisation);

// POST /bookings/:bookingId/capture
// Body: { amount?: number } — optional partial capture for discounts
// Admin only in production
paymentRouter.post('/capture',               authMiddleware, paymentController.capturePayment);

// POST /bookings/:bookingId/cancel
// Admin only in production
paymentRouter.post('/cancel',                authMiddleware, paymentController.cancelHold);

// POST /bookings/:bookingId/redeem-points
// Body: { points: number }
paymentRouter.post('/redeem-points',         authMiddleware, pawPointsController.redeemPoints);

// GET /bookings/:bookingId/points-preview
// Returns points this booking will earn — displayed before payment
paymentRouter.get('/points-preview',         authMiddleware, pawPointsController.getPointsPreview);

module.exports = paymentRouter;