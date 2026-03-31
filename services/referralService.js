// src/services/referralService.js
const { supabase }       = require('../config/supabase');
const pawPointsService   = require('./pawPointsService');
const { REFERRAL_POINTS_REWARD } = require('../config/pawpoints');

// -----------------------------------------------------------------------------
// getReferralByBooking
// -----------------------------------------------------------------------------

/**
 * Checks if a booking was made by a referred user and returns the referral row.
 * Used at capture time to determine if referrer reward should be issued.
 */
const getReferralByBooking = async (bookingId) => {
  // Get the discount_code_id from the booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('discount_code_id, user_id')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking?.discount_code_id) return null;

  // Find referral linked to this discount code
  const { data: referral, error: referralError } = await supabase
    .from('referrals')
    .select('*')
    .eq('discount_code_id', booking.discount_code_id)
    .eq('referred_id', booking.user_id)
    .eq('reward_issued', false)
    .maybeSingle();

  if (referralError) throw new Error(referralError.message);
  return referral;
};

// -----------------------------------------------------------------------------
// awardReferrerPoints
// -----------------------------------------------------------------------------

/**
 * Awards REFERRAL_POINTS_REWARD paw points to the referrer after the referred
 * user's first booking payment is captured. Marks reward_issued = true.
 *
 * Called from paymentService.capturePayment after successful capture.
 *
 * @param {string} bookingId - the booking that was just captured
 */
const awardReferrerPoints = async (bookingId) => {
  const referral = await getReferralByBooking(bookingId);
  if (!referral) return null;

  // Award points to the referrer
  await pawPointsService.awardPoints(
    referral.referrer_id,
    REFERRAL_POINTS_REWARD,
    bookingId,
    `Referral reward — friend completed their first booking`,
    true // isReferralBonus
  );

  // Mark reward as issued and record points awarded
  const { error: updateError } = await supabase
    .from('referrals')
    .update({
      points_awarded: REFERRAL_POINTS_REWARD,
      reward_issued:  true,
    })
    .eq('id', referral.id);

  if (updateError) throw new Error(updateError.message);

  return {
    referrer_id:   referral.referrer_id,
    points_issued: REFERRAL_POINTS_REWARD,
  };
};

// -----------------------------------------------------------------------------
// getReferralStats
// -----------------------------------------------------------------------------

/**
 * Returns referral statistics for a user — how many referrals they've made,
 * how many have been redeemed, and total points earned from referrals.
 */
const getReferralStats = async (userId) => {
  const { data: referrals, error } = await supabase
    .from('referrals')
    .select('id, referred_id, points_awarded, reward_issued, created_at')
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const totalReferrals  = referrals.length;
  const rewardedCount   = referrals.filter(r => r.reward_issued).length;
  const totalPoints     = referrals.reduce((s, r) => s + (r.points_awarded || 0), 0);

  return {
    total_referrals: totalReferrals,
    rewarded_count:  rewardedCount,
    pending_count:   totalReferrals - rewardedCount,
    total_points:    totalPoints,
  };
};

module.exports = {
  getReferralByBooking,
  awardReferrerPoints,
  getReferralStats,
};