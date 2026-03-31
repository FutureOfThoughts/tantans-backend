// src/routes/bookingsRoutes.js
const express            = require('express');
const bookingsRouter     = express.Router();
const bookingsController = require('../controllers/bookingsController');
const authMiddleware     = require('../middleware/authMiddleware');
const adminMiddleware    = require('../middleware/adminMiddleware');
const paymentRouter      = require('./paymentRoutes');

// Core booking routes
bookingsRouter.post('/',          authMiddleware, bookingsController.createBooking);
bookingsRouter.get('/',           authMiddleware, bookingsController.getUserBookings);
bookingsRouter.get('/:bookingId', authMiddleware, bookingsController.getBookingById);

// Admin — all bookings across all users
bookingsRouter.get('/all',        authMiddleware, adminMiddleware, bookingsController.getAllBookings);

// Payment sub-routes mounted under /:bookingId
bookingsRouter.use('/:bookingId', paymentRouter);

module.exports = bookingsRouter;