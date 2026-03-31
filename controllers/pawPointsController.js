// src/controllers/pawPointsController.js
const pawPointsService        = require('../services/pawPointsService');
const { supabase }            = require('../config/supabase');

// -----------------------------------------------------------------------------
// GET /profile/points
// -----------------------------------------------------------------------------
const getBalance = async (req, res) => {
  try {
    const balance = await pawPointsService.getBalance(req.user.id);
    return res.status(200).json({ success: true, data: balance });
  } catch (error) {
    console.error('Get points balance error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch points balance' });
  }
};

// -----------------------------------------------------------------------------
// GET /profile/points/history
// -----------------------------------------------------------------------------
const getHistory = async (req, res) => {
  try {
    const history = await pawPointsService.getHistory(req.user.id);
    return res.status(200).json({ success: true, data: history });
  } catch (error) {
    console.error('Get points history error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch points history' });
  }
};

// -----------------------------------------------------------------------------
// POST /bookings/:bookingId/redeem-points
// Body: { points: number }
// -----------------------------------------------------------------------------
const redeemPoints = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { points }    = req.body;

    if (!points || isNaN(points) || Number(points) <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid points amount' });
    }

    const result = await pawPointsService.redeemPoints(req.user.id, bookingId, Number(points));
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Redeem points error:', error);
    if (
      error.message?.startsWith('Insufficient') ||
      error.message?.startsWith('Minimum redemption') ||
      error.message === 'Booking is already fully discounted'
    ) {
      return res.status(422).json({ success: false, error: error.message });
    }
    return res.status(500).json({ success: false, error: 'Failed to redeem points' });
  }
};

// -----------------------------------------------------------------------------
// GET /bookings/:bookingId/points-preview
// Returns how many points this booking will earn — shown before payment
// -----------------------------------------------------------------------------
const getPointsPreview = async (req, res) => {
  try {
    const { bookingId } = req.params;

    const { data: items, error } = await supabase
      .from('booking_items')
      .select('service_id, quantity')
      .eq('booking_id', bookingId);

    if (error) throw new Error(error.message);

    const points = await pawPointsService.calculateBookingPoints(items || []);
    return res.status(200).json({ success: true, data: points });
  } catch (error) {
    console.error('Points preview error:', error);
    return res.status(500).json({ success: false, error: 'Failed to calculate points preview' });
  }
};

module.exports = { getBalance, getHistory, redeemPoints, getPointsPreview };