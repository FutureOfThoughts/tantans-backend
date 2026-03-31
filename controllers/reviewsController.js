// src/controllers/reviewsController.js
const reviewsService = require('../services/reviewsService');

const getReviews = async (req, res) => {
  try {
    const { service_id, stars } = req.query;
    const data = await reviewsService.getReviews({ service_id, stars });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

const createReview = async (req, res) => {
  try {
    const data = await reviewsService.createReview(req.body);
    return res.status(201).json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

const updateReview = async (req, res) => {
  try {
    const data = await reviewsService.updateReview(req.params.reviewId, req.body);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message });
  }
};

const deleteReview = async (req, res) => {
  try {
    const data = await reviewsService.deleteReview(req.params.reviewId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getReviews, createReview, updateReview, deleteReview };