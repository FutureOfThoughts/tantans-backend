// src/services/addressesService.js
const { supabase } = require('../config/supabase');

const getAddresses = async (userId) => {
  const { data, error } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data;
};

const addAddress = async (userId, addressData) => {
  const { data, error } = await supabase
    .from('addresses')
    .insert({ ...addressData, user_id: userId })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

const updateAddress = async (userId, addressId, updates) => {
  const { data, error } = await supabase
    .from('addresses')
    .update({ ...updates, updated_at: new Date() })
    .eq('id', addressId)
    .eq('user_id', userId)
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data;
};

const deleteAddress = async (userId, addressId) => {
  const { error } = await supabase
    .from('addresses')
    .delete()
    .eq('id', addressId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  return true;
};

module.exports = { getAddresses, addAddress, updateAddress, deleteAddress };