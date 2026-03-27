// src/routes/admin.js
const express = require('express');
const adminRouter = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware = require('../middleware/auth');

adminRouter.get('/bookings', authMiddleware, adminController.getAllBookings);
adminRouter.patch('/bookings/:bookingId/status', authMiddleware, adminController.updateBookingStatus);
adminRouter.get('/users', authMiddleware, adminController.getAllUsers);
adminRouter.get('/services', authMiddleware, adminController.getAllServices);
adminRouter.patch('/services/:serviceId', authMiddleware, adminController.updateService);

module.exports = adminRouter;