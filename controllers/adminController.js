// src/controllers/adminController.js
const adminService = require('../services/adminService');

const getAllBookings = async (req, res) => {
  try {
    const bookings = await adminService.getAllBookings();
    return res.status(200).json({ success: true, data: bookings });
  } catch (error) {
    console.error('Admin get bookings error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
};

const updateBookingStatus = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ success: false, error: 'Status is required' });
    }
    const booking = await adminService.updateBookingStatus(bookingId, status);
    return res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('Update booking status error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update booking status' });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const users = await adminService.getAllUsers();
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    console.error('Admin get users error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch users' });
  }
};

const getAllServices = async (req, res) => {
  try {
    const services = await adminService.getAllServices();
    return res.status(200).json({ success: true, data: services });
  } catch (error) {
    console.error('Admin get services error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch services' });
  }
};

const updateService = async (req, res) => {
  try {
    const { serviceId } = req.params;
    const updates = req.body;
    const service = await adminService.updateService(serviceId, updates);
    return res.status(200).json({ success: true, data: service });
  } catch (error) {
    console.error('Update service error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update service' });
  }
};

module.exports = { getAllBookings, updateBookingStatus, getAllUsers, getAllServices, updateService };