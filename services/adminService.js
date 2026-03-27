// src/services/adminService.js
const { supabase } = require('../config/supabase');

const getAllBookings = async () => {
  const { data, error } = await supabase
    .from('bookings')
    .select('*, booking_items(*, services(*)), addresses(*), profiles(*)')
    .order('booking_date', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
};

const updateBookingStatus = async (bookingId, status) => {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status, updated_at: new Date() })
    .eq('id', bookingId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const getAllUsers = async () => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, pets(*)')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data;
};

const getAllServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
};

const updateService = async (serviceId, updates) => {
  const { data, error } = await supabase
    .from('services')
    .update(updates)
    .eq('id', serviceId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

module.exports = { getAllBookings, updateBookingStatus, getAllUsers, getAllServices, updateService };