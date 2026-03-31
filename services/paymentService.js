// src/services/paymentService.js
const { supabase }       = require('../config/supabase');
const pawPointsService   = require('./pawPointsService');
const referralService    = require('./referralService');

// Lazy Stripe initialisation — ensures dotenv has loaded before Stripe reads the key
const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

/**
 * Retrieve or create a Stripe customer for the user.
 * Persists stripe_customer_id back to the profiles table.
 */
const getOrCreateStripeCustomer = async (userId) => {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('stripe_customer_id, first_name, last_name')
    .eq('id', userId)
    .single();

  if (profileError) throw new Error(profileError.message);

  if (profile.stripe_customer_id) return profile.stripe_customer_id;

  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError) throw new Error(userError.message);

  const stripe   = getStripe();
  const customer = await stripe.customers.create({
    email:    user.email,
    name:     [profile.first_name, profile.last_name].filter(Boolean).join(' ') || undefined,
    metadata: { supabase_user_id: userId },
  });

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ stripe_customer_id: customer.id, updated_at: new Date() })
    .eq('id', userId);

  if (updateError) throw new Error(updateError.message);

  return customer.id;
};

// -----------------------------------------------------------------------------
// createPaymentIntent
// -----------------------------------------------------------------------------

/**
 * Creates a Stripe PaymentIntent in capture_later (manual) mode.
 *
 * If the invoice is already fully covered by points/discounts, returns
 * { fully_paid: true } so the frontend can skip Stripe entirely.
 *
 * payment_method_types: ['card', 'klarna']
 *   - 'card' covers credit/debit, Apple Pay, and Google Pay automatically
 *   - Disable unwanted methods (Revolut, Amazon Pay) in Stripe dashboard
 */
const createPaymentIntent = async (userId, bookingId) => {
  // 1 — Verify booking belongs to this user
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('id', bookingId)
    .eq('user_id', userId)
    .single();

  if (bookingError || !booking) throw new Error('Booking not found');

  // 2 — Fetch invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, total, discount, stripe_payment_intent_id, payment_status, idempotency_key')
    .eq('booking_id', bookingId)
    .single();

  if (invoiceError || !invoice) throw new Error('Invoice not found for this booking');

  // 3 — Check if fully covered by points/discount — skip Stripe
  const chargeableTotal = Number(invoice.total) - Number(invoice.discount ?? 0);

  if (chargeableTotal <= 0) {
    // Mark as authorised without Stripe
    await supabase
      .from('invoices')
      .update({
        status:         'authorised',
        payment_status: 'authorised',
        stripe_status:  null,
        issued_at:      new Date(),
        updated_at:     new Date(),
      })
      .eq('id', invoice.id);

    await supabase
      .from('bookings')
      .update({ status: 'confirmed', updated_at: new Date() })
      .eq('id', bookingId)
      .eq('user_id', userId);

    return { fully_paid: true, invoice_id: invoice.id };
  }

  // 4 — Validate chargeable amount meets Stripe minimum
  const amountInPence = Math.round(chargeableTotal * 100);
  if (amountInPence < 30) {
    throw new Error(`Invalid invoice total: £${chargeableTotal}. Minimum is £0.30`);
  }

  // 5 — Return existing intent if still valid (handles page refresh / retries)
  if (invoice.stripe_payment_intent_id) {
    const stripe   = getStripe();
    const existing = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id);
    if (!['canceled', 'succeeded'].includes(existing.status)) {
      return { client_secret: existing.client_secret, invoice_id: invoice.id, fully_paid: false };
    }
  }

  // 6 — Get or create Stripe customer
  const stripeCustomerId = await getOrCreateStripeCustomer(userId);

  // 7 — Create PaymentIntent with capture_method: manual (hold, not charge)
  const stripe        = getStripe();
  const paymentIntent = await stripe.paymentIntents.create(
    {
      amount:               amountInPence,
      currency:             'gbp',
      capture_method:       'manual',
      customer:             stripeCustomerId,
      setup_future_usage:   'off_session',
      payment_method_types: ['card', 'klarna'],
      metadata: {
        booking_id: bookingId,
        invoice_id: invoice.id,
        user_id:    userId,
      },
      description: `Tan Tan's Cleaning — booking ${bookingId} (authorisation hold)`,
    },
    { idempotencyKey: invoice.idempotency_key }
  );

  // 8 — Persist PaymentIntent to invoice
  await supabase
    .from('invoices')
    .update({
      stripe_payment_intent_id: paymentIntent.id,
      stripe_status:            paymentIntent.status,
      payment_status:           'draft',
      updated_at:               new Date(),
    })
    .eq('id', invoice.id);

  return { client_secret: paymentIntent.client_secret, invoice_id: invoice.id, fully_paid: false };
};

// -----------------------------------------------------------------------------
// confirmAuthorisation
// -----------------------------------------------------------------------------

/**
 * Called after Stripe confirms the PaymentIntent on the frontend.
 * Updates invoice to authorised and booking to confirmed.
 * Also drive this via Stripe webhook (payment_intent.amount_capturable_updated)
 * for reliability in case the frontend call fails after Stripe succeeds.
 */
const confirmAuthorisation = async (userId, bookingId) => {
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, stripe_payment_intent_id, total')
    .eq('booking_id', bookingId)
    .single();

  if (invoiceError || !invoice?.stripe_payment_intent_id) {
    throw new Error('Invoice or PaymentIntent not found');
  }

  const stripe = getStripe();
  const intent = await stripe.paymentIntents.retrieve(invoice.stripe_payment_intent_id);

  if (intent.status !== 'requires_capture') {
    throw new Error(`Unexpected PaymentIntent status: ${intent.status}`);
  }

  await supabase
    .from('invoices')
    .update({
      status:         'authorised',
      payment_status: 'authorised',
      stripe_status:  intent.status,
      issued_at:      new Date(),
      updated_at:     new Date(),
    })
    .eq('id', invoice.id);

  await supabase
    .from('bookings')
    .update({ status: 'confirmed', updated_at: new Date() })
    .eq('id', bookingId)
    .eq('user_id', userId);

  await supabase.from('transactions').insert({
    booking_id:  bookingId,
    user_id:     userId,
    type:        'charge',
    amount:      intent.amount / 100,
    description: 'Card authorisation hold placed',
  });

  return { success: true };
};

// -----------------------------------------------------------------------------
// capturePayment
// -----------------------------------------------------------------------------

/**
 * Captures held funds after the service is completed.
 * Also awards paw points to the customer and referral points to referrer if applicable.
 *
 * Supports partial capture for discounts applied post-booking.
 *
 * @param {string}      bookingId
 * @param {number|null} overrideAmount - Optional partial capture in £. Omit to capture full total minus discounts.
 */
const capturePayment = async (bookingId, overrideAmount = null) => {
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, user_id, total, discount, stripe_payment_intent_id')
    .eq('booking_id', bookingId)
    .single();

  if (invoiceError || !invoice) throw new Error('Invoice not found');

  // ── Handle fully-paid-by-points bookings (no Stripe intent) ──
  if (!invoice.stripe_payment_intent_id) {
    await supabase
      .from('invoices')
      .update({
        status:         'captured',
        payment_status: 'captured',
        paid_at:        new Date(),
        updated_at:     new Date(),
      })
      .eq('id', invoice.id);

    await supabase
      .from('bookings')
      .update({ status: 'completed', updated_at: new Date() })
      .eq('id', bookingId);

    // Award paw points
    await _awardBookingPoints(invoice.user_id, bookingId);

    // Award referral points to referrer if applicable
    await referralService.awardReferrerPoints(bookingId).catch(err =>
      console.error('Referral points award failed (non-fatal):', err.message)
    );

    return { success: true, amount_captured: 0 };
  }

  // ── Standard Stripe capture ──
  const discountedTotal = Number(invoice.total) - Number(invoice.discount ?? 0);
  const captureAmount   = overrideAmount !== null ? overrideAmount : discountedTotal;
  const amountInPence   = Math.round(captureAmount * 100);

  if (!amountInPence || amountInPence < 30) {
    throw new Error(`Invalid capture amount: £${captureAmount}`);
  }

  const stripe = getStripe();
  let intent;

  try {
    intent = await stripe.paymentIntents.capture(invoice.stripe_payment_intent_id, {
      amount_to_capture: amountInPence,
    });
  } catch (stripeError) {
    await supabase
      .from('invoices')
      .update({
        status:         'capture_failed',
        payment_status: 'capture_failed',
        stripe_status:  stripeError.raw?.payment_intent?.status ?? null,
        failure_reason: stripeError.message,
        updated_at:     new Date(),
      })
      .eq('id', invoice.id);
    throw stripeError;
  }

  await supabase
    .from('invoices')
    .update({
      status:         'captured',
      payment_status: 'captured',
      stripe_status:  intent.status,
      paid_at:        new Date(),
      updated_at:     new Date(),
    })
    .eq('id', invoice.id);

  await supabase
    .from('bookings')
    .update({ status: 'completed', updated_at: new Date() })
    .eq('id', bookingId);

  // Log charge transaction
  await supabase.from('transactions').insert({
    booking_id:       bookingId,
    user_id:          invoice.user_id,
    type:             'charge',
    amount:           captureAmount,
    stripe_charge_id: intent.latest_charge ?? null,
    description:      'Payment captured after service completion',
  });

  // Log discount transaction if applicable
  if (invoice.discount && Number(invoice.discount) > 0) {
    await supabase.from('transactions').insert({
      booking_id:  bookingId,
      user_id:     invoice.user_id,
      type:        'discount',
      amount:      Number(invoice.discount),
      description: 'Discount applied at capture',
    });
  }

  // Award paw points to customer
  await _awardBookingPoints(invoice.user_id, bookingId);

  // Award referral points to referrer if applicable — non-fatal if it fails
  await referralService.awardReferrerPoints(bookingId).catch(err =>
    console.error('Referral points award failed (non-fatal):', err.message)
  );

  return { success: true, amount_captured: captureAmount };
};

// -----------------------------------------------------------------------------
// _awardBookingPoints (private)
// -----------------------------------------------------------------------------

/**
 * Sums paw points from all booking items and awards them to the user.
 * Called after both Stripe capture and points-only capture.
 */
const _awardBookingPoints = async (userId, bookingId) => {
  try {
    const { data: items, error } = await supabase
      .from('booking_items')
      .select('service_id, quantity')
      .eq('booking_id', bookingId);

    if (error || !items?.length) return;

    const points = await pawPointsService.calculateBookingPoints(items);
    if (points > 0) {
      await pawPointsService.awardPoints(
        userId,
        points,
        bookingId,
        `Earned from booking`
      );
    }
  } catch (err) {
    // Non-fatal — log but don't fail the capture
    console.error('Paw points award failed (non-fatal):', err.message);
  }
};

// -----------------------------------------------------------------------------
// cancelHold
// -----------------------------------------------------------------------------

/**
 * Cancels the PaymentIntent — releases the hold, no charge made.
 * Also reverses any points redemptions on the booking.
 */
const cancelHold = async (bookingId) => {
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .select('id, user_id, stripe_payment_intent_id')
    .eq('booking_id', bookingId)
    .single();

  if (invoiceError || !invoice) throw new Error('Invoice not found');

  // Cancel Stripe intent if one exists
  if (invoice.stripe_payment_intent_id) {
    const stripe = getStripe();
    const intent = await stripe.paymentIntents.cancel(invoice.stripe_payment_intent_id);

    await supabase
      .from('invoices')
      .update({
        status:         'cancelled',
        payment_status: 'cancelled',
        stripe_status:  intent.status,
        updated_at:     new Date(),
      })
      .eq('id', invoice.id);
  } else {
    // Points-only booking — just update status
    await supabase
      .from('invoices')
      .update({
        status:         'cancelled',
        payment_status: 'cancelled',
        updated_at:     new Date(),
      })
      .eq('id', invoice.id);
  }

  await supabase
    .from('bookings')
    .update({ status: 'cancelled', updated_at: new Date() })
    .eq('id', bookingId);

  // Reverse any points redemptions — refund points to customer
  await pawPointsService.reverseRedemption(invoice.user_id, bookingId).catch(err =>
    console.error('Points reversal failed (non-fatal):', err.message)
  );

  return { success: true };
};

module.exports = {
  createPaymentIntent,
  confirmAuthorisation,
  capturePayment,
  cancelHold,
};