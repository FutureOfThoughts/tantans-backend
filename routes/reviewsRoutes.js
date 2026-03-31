// src/routes/reviewsRoutes.js
const express           = require('express');
const router            = express.Router();
const reviewsController = require('../controllers/reviewsController');
const authMiddleware    = require('../middleware/authMiddleware');
const adminMiddleware   = require('../middleware/adminMiddleware');

// Public
router.get('/', reviewsController.getReviews);

// Admin only
router.post(  '/',           authMiddleware, adminMiddleware, reviewsController.createReview);
router.patch( '/:reviewId',  authMiddleware, adminMiddleware, reviewsController.updateReview);
router.delete('/:reviewId',  authMiddleware, adminMiddleware, reviewsController.deleteReview);

module.exports = router;