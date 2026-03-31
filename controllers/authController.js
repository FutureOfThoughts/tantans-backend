// src/controllers/authController.js
const authService = require('../services/authService');
const { supabase } = require('../config/supabase');

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 1000, // 1 hour
};

const signup = async (req, res) => {
  try {
    const { email, password, first_name, last_name, phone } = req.body;
    if (!email || !password || !first_name || !last_name) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    const result = await authService.signup({ email, password, first_name, last_name, phone });
    res.cookie('access_token', result.session.access_token, COOKIE_OPTIONS);
    res.cookie('refresh_token', result.session.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.status(201).json({ success: true, data: { profile: result.profile } });
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();
    if (profileError) {
      return res.status(500).json({ success: false, error: 'Failed to fetch profile' });
    }
    res.cookie('access_token', data.session.access_token, COOKIE_OPTIONS);
    res.cookie('refresh_token', data.session.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.status(200).json({ success: true, data: { profile } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, error: 'Login failed' });
  }
};

const checkEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email required' });
    }
    // Use admin API to check if user exists in Supabase Auth
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw new Error(error.message);
    const exists = data.users.some(u => u.email?.toLowerCase() === email.toLowerCase().trim());
    return res.status(200).json({ success: true, exists });
  } catch (error) {
    console.error('Check email error:', error);
    return res.status(500).json({ success: false, error: 'Failed to check email' });
  }
};

const refresh = async (req, res) => {
  try {
    const refreshToken = req.cookies?.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'No refresh token' });
    }
    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) {
      return res.status(401).json({ success: false, error: 'Session expired, please log in again' });
    }
    res.cookie('access_token', data.session.access_token, COOKIE_OPTIONS);
    res.cookie('refresh_token', data.session.refresh_token, {
      ...COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Refresh error:', error);
    return res.status(500).json({ success: false, error: 'Refresh failed' });
  }
};

const logout = async (req, res) => {
  try {
    await supabase.auth.signOut();
    res.clearCookie('access_token');
    res.clearCookie('refresh_token');
    return res.status(200).json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ success: false, error: 'Logout failed' });
  }
};

module.exports = { signup, login, checkEmail, refresh, logout };