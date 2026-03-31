// src/routes/adminRoutes.js
const express         = require('express');
const adminRouter     = express.Router();
const adminController = require('../controllers/adminController');
const authMiddleware  = require('../middleware/authMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// All admin routes require auth + admin role
adminRouter.use(authMiddleware, adminMiddleware);

adminRouter.get('/bookings',                        adminController.getAllBookings);
adminRouter.patch('/bookings/:bookingId/status',    adminController.updateBookingStatus);
adminRouter.get('/users',                           adminController.getAllUsers);
adminRouter.get('/services',                        adminController.getAllServices);
adminRouter.patch('/services/:serviceId',           adminController.updateService);
adminRouter.post('/discount-codes',                 adminController.createDiscountCode);

module.exports = adminRouter;