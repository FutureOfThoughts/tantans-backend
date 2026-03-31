// src/controllers/bookingsController.js
const bookingsService = require('../services/bookingsService');

// -----------------------------------------------------------------------------
// POST /bookings
// -----------------------------------------------------------------------------
const createBooking = async (req, res) => {
  try {
    const { address_id, booking_date, time_slot, items, media } = req.body;

    if (!address_id || !booking_date || !time_slot || !items?.length) {
      return res.status(400).json({
        success: false,
        error:   'Address, date, time slot and at least one service are required',
      });
    }

    const booking = await bookingsService.createBooking(req.user.id, {
      address_id,
      booking_date,
      time_slot,
      items,
      media: media || [],
    });

    return res.status(201).json({ success: true, data: booking });
  } catch (error) {
    console.error('Create booking error:', error);
    return res.status(500).json({ success: false, error: 'Failed to create booking' });
  }
};

// -----------------------------------------------------------------------------
// GET /bookings
// -----------------------------------------------------------------------------
const getUserBookings = async (req, res) => {
  try {
    const bookings = await bookingsService.getUserBookings(req.user.id);
    return res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error('Get bookings error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
};

// -----------------------------------------------------------------------------
// GET /bookings/:bookingId
// -----------------------------------------------------------------------------
const getBookingById = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await bookingsService.getBookingById(req.user.id, bookingId);
    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('Get booking error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch booking' });
  }
};

// -----------------------------------------------------------------------------
// GET /bookings/all  (admin only)
// -----------------------------------------------------------------------------
const getAllBookings = async (req, res) => {
  try {
    const bookings = await bookingsService.getAllBookings();
    return res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error('Get all bookings error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
};

module.exports = { createBooking, getUserBookings, getBookingById, getAllBookings };