// src/routes/bookings.js
const express = require('express');
const bookingsRouter = express.Router();
const bookingsController = require('../controllers/bookingsController');
const authMiddleware = require('../middleware/auth');

bookingsRouter.post('/', authMiddleware, bookingsController.createBooking);
bookingsRouter.get('/', authMiddleware, bookingsController.getUserBookings);
bookingsRouter.get('/:bookingId', authMiddleware, bookingsController.getBookingById);

module.exports = bookingsRouter;