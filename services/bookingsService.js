// src/services/bookingsService.js
const { supabase }        = require('../config/supabase');
const imageUploadService  = require('./imageUploadService');
const { randomUUID }      = require('crypto');

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

const getBasePrice = (item) => {
  // Trust the frontend-calculated line_total first — already includes addons
  if (item.line_total && Number(item.line_total) > 0) return Number(item.line_total);
  if (item.room?.price)              return Number(item.room.price);
  if (item.clearanceType === 'van')  return 250;
  if (item.clearanceType === 'bags') return 50;
  return Number(item.service?.price_from ?? 0);
};

const buildMeta = (item) => {
  const meta = {};
  if (item.room)          meta.room          = { slug: item.room.slug, name: item.room.name };
  if (item.roomCounts)    meta.roomCounts    = item.roomCounts;
  if (item.roomSummary)   meta.roomSummary   = item.roomSummary;
  if (item.tasks?.length) meta.tasks         = item.tasks;
  if (item.clearanceType) meta.clearanceType = item.clearanceType;
  return Object.keys(meta).length ? meta : null;
};

const buildAddonRows = (bookingItemId, item) => {
  const rows = [];

  if (item.addons?.length) {
    item.addons.forEach(addon => {
      rows.push({
        booking_item_id: bookingItemId,
        label:           addon.label,
        amount:          Number(addon.amount),
        added_by:        'customer',
        payment_status:  'pending',
      });
    });
  }

  if (item.roomCounts) {
    const totalRooms = Object.values(item.roomCounts).reduce((s, n) => s + n, 0);
    const extraRooms = Math.max(0, totalRooms - 8);
    if (extraRooms > 0) {
      rows.push({
        booking_item_id: bookingItemId,
        label:           `${extraRooms} extra room${extraRooms !== 1 ? 's' : ''}`,
        amount:          extraRooms * 50,
        added_by:        'customer',
        payment_status:  'pending',
      });
    }
  }

  return rows;
};

// -----------------------------------------------------------------------------
// createBooking
// -----------------------------------------------------------------------------

/**
 * Creates a booking, booking items, addons, and a draft invoice.
 * discount_code_id is intentionally NOT applied here — discount codes and
 * points are applied after booking creation via their own endpoints, before
 * the payment intent is created.
 */
const createBooking = async (userId, bookingData) => {
  const { address_id, booking_date, time_slot, items, media } = bookingData;

  // 1 — Create booking
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .insert({
      user_id:    userId,
      address_id,
      booking_date,
      time_slot,
      status:     'pending',
    })
    .select()
    .single();

  if (bookingError) throw new Error(bookingError.message);

  // 2 — Create booking items
  // addon_total is 0 — addons are baked into line_total from the frontend
  const bookingItemRows = items.map(item => {
    const base_price = getBasePrice(item);
    return {
      booking_id:  booking.id,
      service_id:  item.service_id,
      quantity:    1,
      base_price,
      addon_total: 0,
      line_total:  base_price,
      notes:       item.notes || null,
      meta:        buildMeta(item),
    };
  });

  const { data: createdItems, error: itemsError } = await supabase
    .from('booking_items')
    .insert(bookingItemRows)
    .select();

  if (itemsError) {
    await supabase.from('bookings').delete().eq('id', booking.id);
    throw new Error(itemsError.message);
  }

  // 3 — Create addon rows (descriptive records, amounts already in line_total)
  const allAddonRows = createdItems.flatMap((createdItem, i) =>
    buildAddonRows(createdItem.id, items[i])
  );

  if (allAddonRows.length) {
    const { error: addonsError } = await supabase
      .from('booking_item_addons')
      .insert(allAddonRows);

    if (addonsError) {
      await supabase.from('bookings').delete().eq('id', booking.id);
      throw new Error(addonsError.message);
    }
  }

  // 4 — Create draft invoice
  const total = createdItems.reduce((s, i) => s + Number(i.line_total), 0);

  if (!total || total <= 0) {
    await supabase.from('bookings').delete().eq('id', booking.id);
    throw new Error('Invoice total is zero — check item line_totals');
  }

  const { error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      booking_id:      booking.id,
      user_id:         userId,
      status:          'draft',
      payment_status:  'draft',
      subtotal:        total,
      addon_total:     0,
      discount:        0,
      total,
      idempotency_key: randomUUID(),
    });

  if (invoiceError) {
    await supabase.from('bookings').delete().eq('id', booking.id);
    throw new Error(invoiceError.message);
  }

  // 5 — Handle media uploads
  if (media?.length) {
    const bucketName = `booking-${booking.id}`;

    await supabase.storage.createBucket(bucketName, {
      public:           false,
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
      fileSizeLimit:    52428800,
    });

    const mediaRows = [];

    for (const file of media) {
      try {
        const filePath = await imageUploadService.uploadFromBase64(
          file.base64,
          bucketName,
          `items/${file.booking_item_index ?? 'general'}`,
          file.name
        );

        const createdItem = file.booking_item_index != null
          ? createdItems[file.booking_item_index]
          : null;

        mediaRows.push({
          booking_id:      booking.id,
          booking_item_id: createdItem?.id ?? null,
          bucket_name:     bucketName,
          file_url:        filePath,
          file_type:       file.type?.startsWith('video') ? 'video' : 'image',
          file_name:       file.name || 'upload',
        });
      } catch (uploadError) {
        console.error('Media upload failed for file:', file.name, uploadError.message);
      }
    }

    if (mediaRows.length) {
      await supabase.from('booking_media').insert(mediaRows);
    }
  }

  return booking;
};

// -----------------------------------------------------------------------------
// getUserBookings
// -----------------------------------------------------------------------------

const getUserBookings = async (userId) => {
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('*, addresses(*)')
    .eq('user_id', userId)
    .order('booking_date', { ascending: false });

  if (bookingsError) throw new Error(bookingsError.message);
  if (!bookings.length) return [];

  const bookingIds = bookings.map(b => b.id);

  const { data: items, error: itemsError } = await supabase
    .from('booking_items')
    .select('*')
    .in('booking_id', bookingIds);

  if (itemsError) throw new Error(itemsError.message);

  const itemIds = items.map(i => i.id);
  let addons = [];

  if (itemIds.length) {
    const { data: addonData, error: addonsError } = await supabase
      .from('booking_item_addons')
      .select('*')
      .in('booking_item_id', itemIds);
    if (addonsError) throw new Error(addonsError.message);
    addons = addonData;
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('*')
    .in('booking_id', bookingIds);

  if (invoicesError) throw new Error(invoicesError.message);

  return bookings.map(booking => ({
    ...booking,
    booking_items: items
      .filter(i => i.booking_id === booking.id)
      .map(item => ({
        ...item,
        booking_item_addons: addons.filter(a => a.booking_item_id === item.id),
      })),
    invoices: invoices.filter(inv => inv.booking_id === booking.id),
  }));
};

// -----------------------------------------------------------------------------
// getBookingById
// -----------------------------------------------------------------------------

const getBookingById = async (userId, bookingId) => {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('*, addresses(*)')
    .eq('id', bookingId)
    .eq('user_id', userId)
    .single();

  if (bookingError) throw new Error(bookingError.message);

  const { data: items, error: itemsError } = await supabase
    .from('booking_items')
    .select('*')
    .eq('booking_id', bookingId);

  if (itemsError) throw new Error(itemsError.message);

  const itemIds = items.map(i => i.id);
  let addons = [];
  let media  = [];

  if (itemIds.length) {
    const { data: addonData, error: addonsError } = await supabase
      .from('booking_item_addons')
      .select('*')
      .in('booking_item_id', itemIds);
    if (addonsError) throw new Error(addonsError.message);
    addons = addonData;

    const { data: mediaData, error: mediaError } = await supabase
      .from('booking_media')
      .select('*')
      .eq('booking_id', bookingId);
    if (mediaError) throw new Error(mediaError.message);
    media = mediaData;
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('*')
    .eq('booking_id', bookingId);

  if (invoicesError) throw new Error(invoicesError.message);

  return {
    ...booking,
    booking_items: items.map(item => ({
      ...item,
      booking_item_addons: addons.filter(a => a.booking_item_id === item.id),
      booking_media:       media.filter(m => m.booking_item_id === item.id),
    })),
    invoices,
  };
};

// -----------------------------------------------------------------------------
// getAllBookings (admin)
// -----------------------------------------------------------------------------

/**
 * Returns all bookings across all users — for the admin panel.
 * Includes invoice status and customer details.
 */
const getAllBookings = async () => {
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('*, addresses(*), profiles(first_name, last_name, stripe_customer_id)')
    .order('booking_date', { ascending: false });

  if (bookingsError) throw new Error(bookingsError.message);
  if (!bookings.length) return [];

  const bookingIds = bookings.map(b => b.id);

  const { data: items, error: itemsError } = await supabase
    .from('booking_items')
    .select('*, services(name, fun_name, paw_points)')
    .in('booking_id', bookingIds);

  if (itemsError) throw new Error(itemsError.message);

  const { data: invoices, error: invoicesError } = await supabase
    .from('invoices')
    .select('booking_id, status, payment_status, total, discount, paid_at, stripe_payment_intent_id')
    .in('booking_id', bookingIds);

  if (invoicesError) throw new Error(invoicesError.message);

  return bookings.map(booking => ({
    ...booking,
    booking_items: items.filter(i => i.booking_id === booking.id),
    invoice:       invoices.find(inv => inv.booking_id === booking.id) ?? null,
  }));
};

module.exports = { createBooking, getUserBookings, getBookingById, getAllBookings };