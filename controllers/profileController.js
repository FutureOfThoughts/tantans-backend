// src/controllers/profileController.js
const profileService = require('../services/profileService');

const getProfile = async (req, res) => {
  try {
    const profile = await profileService.getProfile(req.user.id);
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('Get profile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch profile' });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, phone, profile_img } = req.body;
    const profile = await profileService.updateProfile(req.user.id, { first_name, last_name, phone, profile_img });
    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    console.error('Update profile error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
};

module.exports = { getProfile, updateProfile };