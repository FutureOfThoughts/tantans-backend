// src/controllers/paymentController.js
const paymentService = require('../services/paymentService');

// -----------------------------------------------------------------------------
// POST /bookings/:bookingId/payment-intent
// -----------------------------------------------------------------------------
const createPaymentIntent = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) return res.status(400).json({ success: false, error: 'bookingId is required' });

    const result = await paymentService.createPaymentIntent(req.user.id, bookingId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Create payment intent error:', error);
    if (error.message === 'Booking not found')
      return res.status(404).json({ success: false, error: 'Booking not found' });
    if (error.message === 'Invoice not found for this booking')
      return res.status(404).json({ success: false, error: 'Invoice not found for this booking' });
    if (error.message?.startsWith('Invalid invoice total'))
      return res.status(422).json({ success: false, error: error.message });
    return res.status(500).json({ success: false, error: 'Failed to create payment intent' });
  }
};

// -----------------------------------------------------------------------------
// POST /bookings/:bookingId/confirm-authorisation
// -----------------------------------------------------------------------------
const confirmAuthorisation = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) return res.status(400).json({ success: false, error: 'bookingId is required' });

    const result = await paymentService.confirmAuthorisation(req.user.id, bookingId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Confirm authorisation error:', error);
    if (error.message?.startsWith('Unexpected PaymentIntent status'))
      return res.status(422).json({ success: false, error: error.message });
    return res.status(500).json({ success: false, error: 'Failed to confirm authorisation' });
  }
};

// -----------------------------------------------------------------------------
// POST /bookings/:bookingId/capture
// Body: { amount?: number } — optional partial capture amount in £
// -----------------------------------------------------------------------------
const capturePayment = async (req, res) => {
  try {
    const { bookingId }  = req.params;
    const overrideAmount = req.body.amount ? Number(req.body.amount) : null;

    if (!bookingId) return res.status(400).json({ success: false, error: 'bookingId is required' });

    const result = await paymentService.capturePayment(bookingId, overrideAmount);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Capture payment error:', error);
    if (error.message?.startsWith('Invalid capture amount'))
      return res.status(422).json({ success: false, error: error.message });
    return res.status(500).json({ success: false, error: 'Failed to capture payment' });
  }
};

// -----------------------------------------------------------------------------
// POST /bookings/:bookingId/cancel
// -----------------------------------------------------------------------------
const cancelHold = async (req, res) => {
  try {
    const { bookingId } = req.params;
    if (!bookingId) return res.status(400).json({ success: false, error: 'bookingId is required' });

    const result = await paymentService.cancelHold(bookingId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    console.error('Cancel hold error:', error);
    return res.status(500).json({ success: false, error: 'Failed to cancel hold' });
  }
};

module.exports = { createPaymentIntent, confirmAuthorisation, capturePayment, cancelHold };