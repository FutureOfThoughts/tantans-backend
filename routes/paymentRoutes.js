// src/routes/paymentRoutes.js
const express                = require('express');
const paymentRouter          = express.Router({ mergeParams: true });
const paymentController      = require('../controllers/paymentController');
const pawPointsController    = require('../controllers/pawPointsController');
const discountCodeController = require('../controllers/discountCodeController');
const authMiddleware         = require('../middleware/authMiddleware');

// POST /bookings/:bookingId/payment-intent
paymentRouter.post('/payment-intent',        authMiddleware, paymentController.createPaymentIntent);

// POST /bookings/:bookingId/confirm-authorisation
paymentRouter.post('/confirm-authorisation', authMiddleware, paymentController.confirmAuthorisation);

// POST /bookings/:bookingId/capture
// Body: { amount?: number } — optional partial capture
// Admin only in production
paymentRouter.post('/capture',               authMiddleware, paymentController.capturePayment);

// POST /bookings/:bookingId/cancel
// Admin only in production
paymentRouter.post('/cancel',                authMiddleware, paymentController.cancelHold);

// POST /bookings/:bookingId/redeem-points
// Body: { points: number }
paymentRouter.post('/redeem-points',         authMiddleware, pawPointsController.redeemPoints);

// GET  /bookings/:bookingId/points-preview
// Returns points this booking will earn — displayed before payment
paymentRouter.get('/points-preview',         authMiddleware, pawPointsController.getPointsPreview);

// POST /bookings/:bookingId/apply-discount
// Body: { code: string } — applies a discount/referral code to the booking
paymentRouter.post('/apply-discount',        authMiddleware, discountCodeController.applyCode);

// DELETE /bookings/:bookingId/apply-discount
// Removes a discount code from the booking before payment
paymentRouter.delete('/apply-discount',      authMiddleware, discountCodeController.removeCode);

module.exports = paymentRouter;