// src/services/petsService.js
const { supabase } = require('../config/supabase');

const getPets = async (userId) => {
  const { data, error } = await supabase
    .from('pets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
};

const addPet = async (userId, petData) => {
  const { data, error } = await supabase
    .from('pets')
    .insert({ ...petData, user_id: userId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const updatePet = async (userId, petId, updates) => {
  const { data, error } = await supabase
    .from('pets')
    .update({ ...updates, updated_at: new Date() })
    .eq('id', petId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

const deletePet = async (userId, petId) => {
  const { error } = await supabase
    .from('pets')
    .delete()
    .eq('id', petId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
  return true;
};

module.exports = { getPets, addPet, updatePet, deletePet };