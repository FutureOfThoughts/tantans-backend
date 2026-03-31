// src/routes/stripeRoutes.js
const express        = require('express');
const stripeRouter  = express.Router();
const paymentService = require('../services/paymentService');
const { supabase }   = require('../config/supabase');

const getStripe = () => {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is not set');
  return require('stripe')(process.env.STRIPE_SECRET_KEY);
};

// Raw body required for Stripe signature verification — must come before express.json()
// Mounted at POST /payments/webhook in app.js
stripeRouter.post(
  '/',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig    = req.headers['stripe-signature'];
    const secret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!secret) {
      console.error('STRIPE_WEBHOOK_SECRET is not set');
      return res.status(500).send('Webhook secret not configured');
    }

    let event;
    try {
      const stripe = getStripe();
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Acknowledge immediately — process async
    res.json({ received: true });

    try {
      switch (event.type) {

        // ── Payment authorised (hold placed) ─────────────────────────────────
        // Fired when a manual-capture PaymentIntent moves to requires_capture.
        // Mirrors confirmAuthorisation in case the frontend POST fails after Stripe succeeds.
        case 'payment_intent.amount_capturable_updated': {
          const intent    = event.data.object;
          const bookingId = intent.metadata?.booking_id;

          if (!bookingId) {
            console.warn('payment_intent.amount_capturable_updated: no booking_id in metadata');
            break;
          }

          // Fetch invoice — check it isn't already authorised (idempotency)
          const { data: invoice } = await supabase
            .from('invoices')
            .select('id, payment_status')
            .eq('booking_id', bookingId)
            .single();

          if (!invoice) {
            console.warn(`payment_intent.amount_capturable_updated: invoice not found for booking ${bookingId}`);
            break;
          }

          if (invoice.payment_status === 'authorised') {
            console.log(`payment_intent.amount_capturable_updated: booking ${bookingId} already authorised, skipping`);
            break;
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
            .eq('id', bookingId);

          await supabase.from('transactions').insert({
            booking_id:  bookingId,
            user_id:     intent.metadata.user_id,
            type:        'charge',
            amount:      intent.amount / 100,
            description: 'Card authorisation hold placed (webhook)',
          });

          console.log(`✅ Webhook: booking ${bookingId} authorised via payment_intent.amount_capturable_updated`);
          break;
        }

        // ── Payment failed (hold attempt failed) ──────────────────────────────
        case 'payment_intent.payment_failed': {
          const intent    = event.data.object;
          const bookingId = intent.metadata?.booking_id;

          if (!bookingId) {
            console.warn('payment_intent.payment_failed: no booking_id in metadata');
            break;
          }

          const failureReason =
            intent.last_payment_error?.message ?? 'Payment failed';

          await supabase
            .from('invoices')
            .update({
              status:         'hold_failed',
              payment_status: 'hold_failed',
              stripe_status:  intent.status,
              failure_reason: failureReason,
              updated_at:     new Date(),
            })
            .eq('booking_id', bookingId);

          console.warn(`⚠️  Webhook: booking ${bookingId} hold failed — ${failureReason}`);
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error(`Webhook handler error (${event.type}):`, err.message);
    }
  }
);

module.exports = stripeRouter;