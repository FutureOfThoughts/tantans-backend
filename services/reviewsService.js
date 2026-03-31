// src/services/reviewsService.js
const { supabase } = require('../config/supabase');

// -----------------------------------------------------------------------------
// getReviews — public
// -----------------------------------------------------------------------------

/**
 * Returns active reviews, optionally filtered by service_id and/or stars.
 * @param {{ service_id?: string, stars?: number }} filters
 */
const getReviews = async (filters = {}) => {
  let query = supabase
    .from('reviews')
    .select('id, content, stars, service_id, service_date, customer_name, source, source_url, created_at')
    .eq('active', true)
    .order('created_at', { ascending: false });

  if (filters.service_id) query = query.eq('service_id', filters.service_id);
  if (filters.stars)      query = query.eq('stars', Number(filters.stars));

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
};

// -----------------------------------------------------------------------------
// createReview — admin
// -----------------------------------------------------------------------------

const createReview = async (payload) => {
  const { content, stars, service_id, service_date, customer_name, source, source_url, active } = payload;

  if (!content)            throw new Error('content is required');
  if (!stars || stars < 1 || stars > 5) throw new Error('stars must be between 1 and 5');

  const { data, error } = await supabase
    .from('reviews')
    .insert({
      content,
      stars:         Number(stars),
      service_id:    service_id    ?? null,
      service_date:  service_date  ?? null,
      customer_name: customer_name ?? null,
      source:        source        ?? 'internal',
      source_url:    source_url    ?? null,
      active:        active        !== undefined ? active : true,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// -----------------------------------------------------------------------------
// updateReview — admin
// -----------------------------------------------------------------------------

const updateReview = async (reviewId, payload) => {
  const allowed = ['content', 'stars', 'service_id', 'service_date', 'customer_name', 'source', 'source_url', 'active'];
  const updates = Object.fromEntries(
    Object.entries(payload).filter(([k]) => allowed.includes(k))
  );

  if (!Object.keys(updates).length) throw new Error('No valid fields to update');

  const { data, error } = await supabase
    .from('reviews')
    .update({ ...updates, updated_at: new Date() })
    .eq('id', reviewId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
};

// -----------------------------------------------------------------------------
// deleteReview — admin (hard delete)
// -----------------------------------------------------------------------------

const deleteReview = async (reviewId) => {
  const { error } = await supabase
    .from('reviews')
    .delete()
    .eq('id', reviewId);

  if (error) throw new Error(error.message);
  return { deleted: true };
};

module.exports = { getReviews, createReview, updateReview, deleteReview };