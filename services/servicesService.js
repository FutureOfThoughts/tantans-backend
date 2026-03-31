// src/services/servicesService.js
const { supabase } = require('../config/supabase');

// Returns all active services, with their rooms nested if any exist.
const getAllServices = async () => {
  const { data: services, error } = await supabase
    .from('services')
    .select(`
      *,
      service_rooms (
        id,
        name,
        slug,
        price,
        features,
        sort_order
      )
    `)
    .eq('active', true)
    .eq('service_rooms.active', true)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);

  // Sort rooms by sort_order on the JS side (Supabase nested selects don't support order)
  return services.map(service => ({
    ...service,
    service_rooms: (service.service_rooms || []).sort((a, b) => a.sort_order - b.sort_order),
  }));
};

// Returns a single service by slug, with rooms nested.
const getServiceBySlug = async (slug) => {
  const { data, error } = await supabase
    .from('services')
    .select(`
      *,
      service_rooms (
        id,
        name,
        slug,
        price,
        features,
        sort_order
      )
    `)
    .eq('slug', slug)
    .eq('active', true)
    .single();

  if (error) throw new Error(error.message);

  return {
    ...data,
    service_rooms: (data.service_rooms || []).sort((a, b) => a.sort_order - b.sort_order),
  };
};

module.exports = { getAllServices, getServiceBySlug };