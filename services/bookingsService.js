// src/services/bookingsService.js
const { supabase } = require('../config/supabase');

const createBooking = async (userId, bookingData) => {
  const { address_id, booking_date, time_slot, notes, items } = bookingData;

  // Step 1 — create booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      user_id: userId,
      address_id,
      booking_date,
      time_slot,
      notes: notes || null,
      status: 'pending'
    })
    .select()
    .single();

  if (bookingError) throw new Error(bookingError.message);

  // Step 2 — create booking items
  const bookingItems = items.map(item => ({
    booking_id: booking.id,
    service_id: item.service_id,
    quantity: item.quantity || 1,
    base_price: item.base_price,
    surcharge: item.surcharge || 0,
    surcharge_reason: item.surcharge_reason || null,
    line_total: (item.base_price * (item.quantity || 1)) + (item.surcharge || 0)
  }));

  const { error: itemsError } = await supabase
    .from('booking_items')
    .insert(bookingItems);

  if (itemsError) {
    // Rollback booking
    await supabase.from('bookings').delete().eq('id', booking.id);
    throw new Error(itemsError.message);
  }

  // Step 3 — create transaction record
  const total = bookingItems.reduce((sum, item) => sum + item.line_total, 0);

  const { error: transactionError } = await supabase
    .from('transactions')
    .insert({
      booking_id: booking.id,
      user_id: userId,
      type: 'charge',
      amount: total,
      description: `Booking ${booking.id}`
    });

  if (transactionError) throw new Error(transactionError.message);

  return booking;
};

const getUserBookings = async (userId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, booking_items(*, services(*)), addresses(*)')
    .eq('user_id', userId)
    .order('booking_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
};

const getBookingById = async (userId, bookingId) => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, booking_items(*, services(*)), addresses(*), invoices(*), transactions(*)')
    .eq('id', bookingId)
    .eq('user_id', userId)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

module.exports = { createBooking, getUserBookings, getBookingById };