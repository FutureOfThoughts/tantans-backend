// src/services/referralService.js
const { supabase }                = require('../config/supabase');
const pawPointsService            = require('./pawPointsService');
const { REFERRAL_POINTS_REWARD,
        REFERRAL_CODE_EXPIRY_DAYS,
        REFERRAL_DISCOUNT_AMOUNT } = require('../config/pawpoints');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const generateCode = () => {
  const chars  = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const random = Array.from({ length: 6 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('');
  return `TANTAN-${random}`;
};

// -----------------------------------------------------------------------------
// generateReferralCode
// -----------------------------------------------------------------------------

/**
 * Creates a new referral code in discount_codes for the user.
 * type = 'referral', created_by = userId, expires in REFERRAL_CODE_EXPIRY_DAYS.
 */
const generateReferralCode = async (userId) => {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (REFERRAL_CODE_EXPIRY_DAYS ?? 30));

  let code;
  for (let i = 0; i < 5; i++) {
    const candidate = generateCode();
    const { data: existing } = await supabase
      .from('discount_codes')
      .select('id')
      .eq('code', candidate)
      .maybeSingle();
    if (!existing) { code = candidate; break; }
  }

  if (!code) throw new Error('Failed to generate a unique code. Please try again.');

  const { data, error } = await supabase
    .from('discount_codes')
    .insert({
      code,
      type:            'referral',
      created_by:      userId,
      discount_amount: REFERRAL_DISCOUNT_AMOUNT ?? 20,
      expires_at:      expiresAt,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// -----------------------------------------------------------------------------
// getUserReferralCodes
// -----------------------------------------------------------------------------

/**
 * Returns all referral codes created by this user, newest first.
 * A code is "used" when redeemed_by is set.
 */
const getUserReferralCodes = async (userId) => {
  const { data, error } = await supabase
    .from('discount_codes')
    .select('id, code, discount_amount, expires_at, created_at, redeemed_by, redeemed_at')
    .eq('created_by', userId)
    .eq('type', 'referral')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
};

// -----------------------------------------------------------------------------
// getReferralByBooking
// -----------------------------------------------------------------------------

const getReferralByBooking = async (bookingId) => {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('discount_code_id, user_id')
    .eq('id', bookingId)
    .single();

  if (bookingError || !booking?.discount_code_id) return null;

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

const awardReferrerPoints = async (bookingId) => {
  const referral = await getReferralByBooking(bookingId);
  if (!referral) return null;

  await pawPointsService.awardPoints(
    referral.referrer_id,
    REFERRAL_POINTS_REWARD,
    bookingId,
    `Referral reward — friend completed their first booking`,
    true
  );

  const { error } = await supabase
    .from('referrals')
    .update({ points_awarded: REFERRAL_POINTS_REWARD, reward_issued: true })
    .eq('id', referral.id);

  if (error) throw new Error(error.message);

  return { referrer_id: referral.referrer_id, points_issued: REFERRAL_POINTS_REWARD };
};

// -----------------------------------------------------------------------------
// getReferralStats
// -----------------------------------------------------------------------------

const getReferralStats = async (userId) => {
  const { data: referrals, error } = await supabase
    .from('referrals')
    .select('id, referred_id, points_awarded, reward_issued, created_at')
    .eq('referrer_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const totalReferrals = referrals.length;
  const rewardedCount  = referrals.filter(r => r.reward_issued).length;
  const totalPoints    = referrals.reduce((s, r) => s + (r.points_awarded || 0), 0);

  return {
    total_referrals: totalReferrals,
    rewarded_count:  rewardedCount,
    pending_count:   totalReferrals - rewardedCount,
    total_points:    totalPoints,
  };
};

module.exports = {
  generateReferralCode,
  getUserReferralCodes,
  getReferralByBooking,
  awardReferrerPoints,
  getReferralStats,
};