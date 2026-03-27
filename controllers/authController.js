const authService = require('../services/authService');

const signup = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;

    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const result = await authService.signup({ email, password, first_name, last_name, phone });

    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    console.error('Signup error:', error);
    return res.status(500).json({ success: false, error: error.message || 'Signup failed' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email and password required' });
    }

    const { supabase } = require('../config/supabase');

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    return res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
};

const logout = async (req, res) => {
  try {
    const { supabase } = require('../config/supabase');
    await supabase.auth.signOut();
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ success: false, error: 'Logout failed' });
  }
};

module.exports = { signup, login, logout };