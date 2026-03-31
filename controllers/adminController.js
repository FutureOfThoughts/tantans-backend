// src/controllers/adminController.js
const bookingsService     = require('../services/bookingsService');
const pawPointsService    = require('../services/pawPointsService');
const paymentService      = require('../services/paymentService');
const discountCodeService = require('../services/discountCodeService');
const { supabase }        = require('../config/supabase');

// ---------------------------------------------------------------------------
// getAllBookings
// ---------------------------------------------------------------------------

/**
 * Returns all bookings with expected paw points per booking.
 * For captured bookings, pulls actuals from paw_points ledger.
 * For uncaptured bookings, calculates expected from booking_items + services.paw_points.
 */
const getAllBookings = async (_req, res) => {
  try {
    const bookings = await bookingsService.getAllBookings();

    // Fetch actual awarded points from ledger for all booking IDs
    const bookingIds = bookings.map(b => b.id);

    const { data: ledgerRows, error: ledgerError } = await supabase
      .from('paw_points')
      .select('booking_id, points')
      .in('booking_id', bookingIds)
      .eq('transaction_type', 'earned');

    if (ledgerError) throw new Error(ledgerError.message);

    // Sum actual awarded points per booking
    const actualPointsMap = {};
    for (const row of ledgerRows ?? []) {
      actualPointsMap[row.booking_id] = (actualPointsMap[row.booking_id] ?? 0) + row.points;
    }

    // For each booking, attach paw_points_awarded (actual or expected)
    const enriched = await Promise.all(
      bookings.map(async (booking) => {
        let paw_points_display = null;
        let paw_points_status  = 'none';

        const invoice = booking.invoice;

        if (actualPointsMap[booking.id]) {
          // Already awarded — show actual
          paw_points_display = actualPointsMap[booking.id];
          paw_points_status  = 'awarded';
        } else if (booking.booking_items?.length) {
          // Not yet awarded — calculate expected
          try {
            const expected = await pawPointsService.calculateBookingPoints(
              booking.booking_items.map(i => ({ service_id: i.service_id, quantity: i.quantity }))
            );
            paw_points_display = expected;
            paw_points_status  = 'expected';
          } catch {
            paw_points_display = null;
          }
        }

        return {
          ...booking,
          paw_points_display,
          paw_points_status,
        };
      })
    );

    return res.json({ success: true, data: enriched });
  } catch (err) {
    console.error('getAllBookings admin error:', err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ---------------------------------------------------------------------------
// updateBookingStatus
// ---------------------------------------------------------------------------

/**
 * PATCH /admin/bookings/:bookingId/status
 * body: { action: 'capture' | 'cancel' }
 */
const updateBookingStatus = async (req, res) => {
  const { bookingId } = req.params;
  const { action }    = req.body;

  try {
    if (action === 'capture') {
      const result = await paymentService.capturePayment(bookingId);
      return res.json({ success: true, data: result });
    }

    if (action === 'cancel') {
      const result = await paymentService.cancelHold(bookingId);
      return res.json({ success: true, data: result });
    }

    return res.status(400).json({ success: false, error: 'Invalid action. Use capture or cancel.' });
  } catch (err) {
    console.error(`updateBookingStatus (${action}) error:`, err.message);
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ---------------------------------------------------------------------------
// getAllUsers
// ---------------------------------------------------------------------------

const getAllUsers = async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, first_name, last_name, paw_points_balance, is_admin, created_at')
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ---------------------------------------------------------------------------
// getAllServices
// ---------------------------------------------------------------------------

const getAllServices = async (_req, res) => {
  try {
    const { data, error } = await supabase
      .from('services')
      .select('*')
      .order('name');

    if (error) throw new Error(error.message);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ---------------------------------------------------------------------------
// updateService
// ---------------------------------------------------------------------------

const updateService = async (req, res) => {
  const { serviceId } = req.params;
  try {
    const { data, error } = await supabase
      .from('services')
      .update({ ...req.body, updated_at: new Date() })
      .eq('id', serviceId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};

// ---------------------------------------------------------------------------
// createDiscountCode
// ---------------------------------------------------------------------------

/**
 * POST /admin/discount-codes
 * body: { code, discount_type, discount_value, max_uses, expires_at, min_booking_value }
 */
const createDiscountCode = async (req, res) => {
  try {
    const result = await discountCodeService.createPromoCode(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (err) {
    console.error('createDiscountCode error:', err.message);
    return res.status(400).json({ success: false, error: err.message });
  }
};

module.exports = {
  getAllBookings,
  updateBookingStatus,
  getAllUsers,
  getAllServices,
  updateService,
  createDiscountCode,
};