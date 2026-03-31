// src/middleware/adminMiddleware.js
const { supabase } = require('../config/supabase');

const adminMiddleware = async (req, res, next) => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', req.user.id)
      .single();

    if (error || !data?.is_admin) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    next();
  } catch {
    return res.status(403).json({ success: false, error: 'Forbidden' });
  }
};

module.exports = adminMiddleware;