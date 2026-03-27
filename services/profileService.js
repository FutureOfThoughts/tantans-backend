// src/services/profileService.js
const { supabase } = require('../config/supabase');

const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const updateProfile = async (userId, updates) => {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date() })
    .eq('id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

module.exports = { getProfile, updateProfile };