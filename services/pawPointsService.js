// src/services/pawPointsService.js
const { supabase }  = require('../config/supabase');
const { pointsToGBP, gbpToPoints, MIN_REDEMPTION_POINTS } = require('../config/pawpoints');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const incrementBalance = async (userId, amount) => {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('paw_points_balance')
    .eq('id', userId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ paw_points_balance: (profile?.paw_points_balance ?? 0) + amount })
    .eq('id', userId);

  if (updateError) throw new Error(updateError.message);
};

const decrementBalance = async (userId, amount) => {
  const { data: profile, error: fetchError } = await supabase
    .from('profiles')
    .select('paw_points_balance')
    .eq('id', userId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const newBalance = (profile?.paw_points_balance ?? 0) - amount;
  if (newBalance < 0) throw new Error('Insufficient points balance');

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ paw_points_balance: newBalance })
    .eq('id', userId);

  if (updateError) throw new Error(updateError.message);

  return newBalance;
};

// -----------------------------------------------------------------------------
// getBalance
// -----------------------------------------------------------------------------

const getBalance = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('paw_points_balance')
    .eq('id', userId)
    .single();

  if (error) throw new Error(error.message);
  return data.paw_points_balance ?? 0;
};

// -----------------------------------------------------------------------------
// getHistory
// -----------------------------------------------------------------------------

const getHistory = async (userId) => {
  const { data, error } = await supabase
    .from('paw_points')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
};

// -----------------------------------------------------------------------------
// awardPoints
// -----------------------------------------------------------------------------

/**
 * Awards points to a user after a booking is captured.
 * Inserts a row into paw_points and increments profiles.paw_points_balance.
 */
const awardPoints = async (userId, points, bookingId = null, notes = null, isReferralBonus = false) => {
  if (!points || points <= 0) return null;

  const { data: pointsRow, error: insertError } = await supabase
    .from('paw_points')
    .insert({
      user_id:           userId,
      points,
      transaction_type:  'earned',
      booking_id:        bookingId,
      notes,
      is_referral_bonus: isReferralBonus,
    })
    .select()
    .single();

  if (insertError) throw new Error(insertError.message);

  await incrementBalance(userId, points);

  return pointsRow;
};

// -----------------------------------------------------------------------------
// redeemPoints
// -----------------------------------------------------------------------------

/**
 * Validates and redeems points against a booking invoice.
 * Deducts from profile balance, inserts a redemption row, updates invoice discount.
 * Returns fully_paid: true if points cover the entire booking — frontend skips Stripe.
 */
const redeemPoints = async (userId, bookingId, pointsToRedeem) => {
  if (!pointsToRedeem || pointsToRedeem < MIN_REDEMPTION_POINTS) {
    throw new Error(`Minimum redemption is ${MIN_REDEMPTION_POINTS} point`);
  }

  // 1 — Get current balance
  const currentBalance = await getBalance(userId);
  if (currentBalance < pointsToRedeem) {
    throw new Error(`Insufficient points. Balance: ${currentBalance}, requested: ${pointsToRedeem}`);
  }

  // 2 — Fetch invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, total, discount')
    .eq('booking_id', bookingId)
    .single();

  if (invoiceError || !invoice) throw new Error('Invoice not found');

  // 3 — Calculate discount — cap at remaining balance after existing discounts
  const discountValue   = pointsToGBP(pointsToRedeem);
  const currentDiscount = Number(invoice.discount ?? 0);
  const maxDiscount     = Number(invoice.total);
  const totalDiscount   = Math.min(currentDiscount + discountValue, maxDiscount);
  const actualDiscount  = totalDiscount - currentDiscount;
  const actualPoints    = gbpToPoints(actualDiscount);

  if (actualPoints <= 0) throw new Error('Booking is already fully discounted');

  // 4 — Deduct points
  const newBalance = await decrementBalance(userId, actualPoints);

  // 5 — Insert redemption row
  const { error: redemptionError } = await supabase
    .from('paw_points')
    .insert({
      user_id:          userId,
      points:           -actualPoints,
      transaction_type: 'redeemed',
      booking_id:       bookingId,
      notes:            `Redeemed ${actualPoints} points for £${actualDiscount.toFixed(2)} off booking`,
    });

  if (redemptionError) throw new Error(redemptionError.message);

  // 6 — Update invoice discount
  const { error: invoiceUpdateError } = await supabase
    .from('invoices')
    .update({ discount: totalDiscount, updated_at: new Date() })
    .eq('id', invoice.id);

  if (invoiceUpdateError) throw new Error(invoiceUpdateError.message);

  const fullyPaid = totalDiscount >= maxDiscount;

  return {
    discount_amount: actualDiscount,
    points_redeemed: actualPoints,
    new_balance:     newBalance,
    fully_paid:      fullyPaid,
  };
};

// -----------------------------------------------------------------------------
// reverseRedemption
// -----------------------------------------------------------------------------

/**
 * Reverses points redemption if a booking is cancelled — refunds points.
 */
const reverseRedemption = async (userId, bookingId) => {
  const { data: redemptions, error } = await supabase
    .from('paw_points')
    .select('*')
    .eq('user_id', userId)
    .eq('booking_id', bookingId)
    .eq('transaction_type', 'redeemed');

  if (error) throw new Error(error.message);
  if (!redemptions?.length) return null;

  const totalRedeemed = redemptions.reduce((s, r) => s + Math.abs(r.points), 0);

  await awardPoints(userId, totalRedeemed, bookingId, 'Points refunded due to booking cancellation');

  return { points_refunded: totalRedeemed };
};

// -----------------------------------------------------------------------------
// calculateBookingPoints
// -----------------------------------------------------------------------------

/**
 * Calculates how many points a booking will earn based on its items and services.
 * Used to display "earn X paw points" before and after payment.
 */
const calculateBookingPoints = async (items) => {
  if (!items?.length) return 0;

  const serviceIds = [...new Set(items.map(i => i.service_id))];

  const { data: services, error } = await supabase
    .from('services')
    .select('id, paw_points')
    .in('id', serviceIds);

  if (error) throw new Error(error.message);

  const serviceMap = Object.fromEntries(services.map(s => [s.id, s]));

  return items.reduce((total, item) => {
    const service = serviceMap[item.service_id];
    if (!service) return total;
    const qty = item.quantity || 1;
    return total + (service.paw_points * qty);
  }, 0);
};

module.exports = {
  getBalance,
  getHistory,
  awardPoints,
  redeemPoints,
  reverseRedemption,
  calculateBookingPoints,
};