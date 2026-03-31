// src/services/discountCodeService.js
const { supabase }    = require('../config/supabase');
const { REFERRAL_CODE_EXPIRY_DAYS, REFERRAL_DISCOUNT_AMOUNT } = require('../config/pawpoints');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Generates a unique referral code from the user's first name.
 * Format: FIRSTNAME-XXXX where XXXX is a random alphanumeric suffix.
 * Retries up to 5 times if code already exists.
 */
const generateUniqueCode = async (firstName) => {
  const base    = (firstName || 'TANTANS').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 8);
  const chars   = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars (0/O, 1/I)

  for (let attempt = 0; attempt < 5; attempt++) {
    const suffix = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const code   = `${base}-${suffix}`;

    const { data } = await supabase
      .from('discount_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle();

    if (!data) return code; // unique — use it
  }

  throw new Error('Could not generate a unique code. Please try again.');
};

// -----------------------------------------------------------------------------
// generateReferralCode
// -----------------------------------------------------------------------------

/**
 * Generates a new referral discount code for a user.
 * Users can generate multiple codes. Each expires after REFERRAL_CODE_EXPIRY_DAYS.
 *
 * @param {string} userId
 * @param {string} firstName      - used to personalise the code
 * @param {string} recipientNote  - optional note about who the code was given to
 */
const generateReferralCode = async (userId, firstName, recipientNote = null) => {
  const code      = await generateUniqueCode(firstName);
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + REFERRAL_CODE_EXPIRY_DAYS);

  const { data, error } = await supabase
    .from('discount_codes')
    .insert({
      code,
      type:            'referral',
      created_by:      userId,
      discount_amount: REFERRAL_DISCOUNT_AMOUNT,
      expires_at:      expiresAt.toISOString(),
      recipient_note:  recipientNote || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// -----------------------------------------------------------------------------
// getUserCodes
// -----------------------------------------------------------------------------

/**
 * Returns all discount codes created by a user — active, redeemed, and expired.
 */
const getUserCodes = async (userId) => {
  const { data, error } = await supabase
    .from('discount_codes')
    .select('id, code, type, discount_amount, expires_at, redeemed_at, recipient_note, created_at')
    .eq('created_by', userId)
    .eq('type', 'referral')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const now = new Date();

  return data.map(code => ({
    ...code,
    status: code.redeemed_at
      ? 'redeemed'
      : new Date(code.expires_at) < now
        ? 'expired'
        : 'active',
  }));
};

// -----------------------------------------------------------------------------
// validateCode
// -----------------------------------------------------------------------------

/**
 * Validates a discount code without applying it.
 * Returns code details if valid, throws if invalid/expired/already redeemed.
 *
 * @param {string} code
 * @param {string} userId - the user trying to use the code
 */
const validateCode = async (code, userId) => {
  const { data, error } = await supabase
    .from('discount_codes')
    .select('*')
    .eq('code', code.toUpperCase().trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data)  throw new Error('Code not found');

  // Cannot use your own code
  if (data.created_by === userId) {
    throw new Error('You cannot use your own referral code');
  }

  // Already redeemed
  if (data.redeemed_at) {
    throw new Error('This code has already been used');
  }

  // Expired
  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    throw new Error('This code has expired');
  }

  // Referral codes can only be used by new users (no previous bookings)
  if (data.type === 'referral') {
    const { count, error: bookingError } = await supabase
      .from('bookings')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (bookingError) throw new Error(bookingError.message);
    if (count > 0) throw new Error('Referral codes are only valid on your first booking');
  }

  return {
    id:              data.id,
    code:            data.code,
    type:            data.type,
    discount_amount: Number(data.discount_amount),
  };
};

// -----------------------------------------------------------------------------
// applyCode
// -----------------------------------------------------------------------------

/**
 * Applies a discount code to a booking.
 * Marks the code as redeemed, links it to the booking and invoice,
 * and updates the invoice discount.
 *
 * @param {string} code
 * @param {string} userId
 * @param {string} bookingId
 */
const applyCode = async (code, userId, bookingId) => {
  // 1 — Validate first (throws if invalid)
  const validated = await validateCode(code, userId);

  // 2 — Fetch invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, total, discount')
    .eq('booking_id', bookingId)
    .single();

  if (invoiceError || !invoice) throw new Error('Invoice not found');

  // 3 — Calculate new discount — cap at invoice total
  const currentDiscount = Number(invoice.discount ?? 0);
  const maxDiscount     = Number(invoice.total);
  const newDiscount     = Math.min(currentDiscount + validated.discount_amount, maxDiscount);
  const actualDiscount  = newDiscount - currentDiscount;

  if (actualDiscount <= 0) throw new Error('Booking is already fully discounted');

  // 4 — Mark code as redeemed
  const { error: redeemError } = await supabase
    .from('discount_codes')
    .update({
      redeemed_by: userId,
      redeemed_at: new Date().toISOString(),
    })
    .eq('id', validated.id);

  if (redeemError) throw new Error(redeemError.message);

  // 5 — Link code to booking
  const { error: bookingUpdateError } = await supabase
    .from('bookings')
    .update({ discount_code_id: validated.id })
    .eq('id', bookingId);

  if (bookingUpdateError) throw new Error(bookingUpdateError.message);

  // 6 — Update invoice discount
  const { error: invoiceUpdateError } = await supabase
    .from('invoices')
    .update({ discount: newDiscount, updated_at: new Date() })
    .eq('id', invoice.id);

  if (invoiceUpdateError) throw new Error(invoiceUpdateError.message);

  // 7 — If referral code, create referrals row
  if (validated.type === 'referral') {
    const { data: codeData } = await supabase
      .from('discount_codes')
      .select('created_by')
      .eq('id', validated.id)
      .single();

    if (codeData?.created_by) {
      await supabase
        .from('referrals')
        .insert({
          referrer_id:      codeData.created_by,
          referred_id:      userId,
          discount_code_id: validated.id,
          points_awarded:   0,
          reward_issued:    false,
        });
    }
  }

  return {
    discount_amount: actualDiscount,
    fully_paid:      newDiscount >= maxDiscount,
  };
};

// -----------------------------------------------------------------------------
// removeCode
// -----------------------------------------------------------------------------

/**
 * Removes a discount code from a booking — reverses the discount.
 * Only possible before payment is authorised.
 */
const removeCode = async (bookingId, userId) => {
  // 1 — Get booking's discount code
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('discount_code_id')
    .eq('id', bookingId)
    .eq('user_id', userId)
    .single();

  if (bookingError || !booking?.discount_code_id) throw new Error('No discount code on this booking');

  // 2 — Get the code details
  const { data: codeData, error: codeError } = await supabase
    .from('discount_codes')
    .select('id, discount_amount, type')
    .eq('id', booking.discount_code_id)
    .single();

  if (codeError || !codeData) throw new Error('Discount code not found');

  // 3 — Revert code redemption
  const { error: revertError } = await supabase
    .from('discount_codes')
    .update({ redeemed_by: null, redeemed_at: null })
    .eq('id', codeData.id);

  if (revertError) throw new Error(revertError.message);

  // 4 — Remove code from booking
  const { error: bookingUpdateError } = await supabase
    .from('bookings')
    .update({ discount_code_id: null })
    .eq('id', bookingId);

  if (bookingUpdateError) throw new Error(bookingUpdateError.message);

  // 5 — Reduce invoice discount
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, discount')
    .eq('booking_id', bookingId)
    .single();

  if (invoiceError || !invoice) throw new Error('Invoice not found');

  const newDiscount = Math.max(0, Number(invoice.discount) - Number(codeData.discount_amount));

  const { error: invoiceUpdateError } = await supabase
    .from('invoices')
    .update({ discount: newDiscount, updated_at: new Date() })
    .eq('id', invoice.id);

  if (invoiceUpdateError) throw new Error(invoiceUpdateError.message);

  // 6 — Remove referral row if it was a referral code
  if (codeData.type === 'referral') {
    await supabase
      .from('referrals')
      .delete()
      .eq('discount_code_id', codeData.id)
      .eq('referred_id', userId);
  }

  return { success: true };
};

// -----------------------------------------------------------------------------
// Admin: createPromoCode
// -----------------------------------------------------------------------------

/**
 * Admin-only — creates a promo discount code with custom amount and expiry.
 */
const createPromoCode = async (adminUserId, { code, discountAmount, expiresAt, notes }) => {
  if (!code || !discountAmount) throw new Error('Code and discount amount are required');

  const { data, error } = await supabase
    .from('discount_codes')
    .insert({
      code:            code.toUpperCase().trim(),
      type:            'promo',
      created_by:      adminUserId,
      discount_amount: discountAmount,
      expires_at:      expiresAt || null,
      notes:           notes || null,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

module.exports = {
  generateReferralCode,
  getUserCodes,
  validateCode,
  applyCode,
  removeCode,
  createPromoCode,
};