// src/controllers/servicesController.js
const servicesService = require('../services/servicesService');

const getAllServices = async (req, res) => {
  try {
    const services = await servicesService.getAllServices();
    return res.status(200).json({ success: true, data: services });
  } catch (error) {
    console.error('Get services error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch services' });
  }
};

const getServiceBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const service = await servicesService.getServiceBySlug(slug);
    return res.status(200).json({ success: true, data: service });
  } catch (error) {
    console.error('Get service error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch service' });
  }
};

module.exports = { getAllServices, getServiceBySlug };