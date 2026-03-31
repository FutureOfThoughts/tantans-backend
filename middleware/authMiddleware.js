// src/middleware/authMiddleware.js
const { supabase } = require('../config/supabase');

const authMiddleware = async (req, res, next) => {
  try {
    // Read token from httpOnly cookie (set at login/signup)
    const token = req.cookies?.access_token;

    if (!token) {
      return res.status(401).json({ success: false, error: 'Please log in to continue' });
    }

    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ success: false, error: 'Please log in to continue' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return res.status(404).json({ success: false, error: 'Profile not found' });
    }

    req.user = { id: user.id, email: user.email, ...profile };
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({ success: false, error: 'Authentication failed' });
  }
};

module.exports = authMiddleware;