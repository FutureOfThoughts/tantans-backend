// src/services/servicesService.js
const { supabase } = require('../config/supabase');

const getAllServices = async () => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
};

const getServiceBySlug = async (slug) => {
  const { data, error } = await supabase
    .from('services')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (error) throw new Error(error.message);
  return data;
};

module.exports = { getAllServices, getServiceBySlug };