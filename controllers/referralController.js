// src/controllers/referralController.js
const referralService = require('../services/referralService');

// -----------------------------------------------------------------------------
// GET /referrals/stats
// Returns referral statistics for the authenticated user.
// -----------------------------------------------------------------------------
const getReferralStats = async (req, res) => {
  try {
    const stats = await referralService.getReferralStats(req.user.id);
    return res.status(200).json({ success: true, data: stats });
  } catch (error) {
    console.error('Get referral stats error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch referral stats' });
  }
};

module.exports = { getReferralStats };