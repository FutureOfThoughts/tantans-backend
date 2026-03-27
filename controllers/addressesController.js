// src/controllers/addressesController.js
const addressesService = require('../services/addressesService');

const getAddresses = async (req, res) => {
  try {
    const addresses = await addressesService.getAddresses(req.user.id);
    return res.status(200).json({ success: true, data: addresses });
  } catch (error) {
    console.error('Get addresses error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch addresses' });
  }
};

const addAddress = async (req, res) => {
  try {
    const { label, address_line_1, address_line_2, city, postcode, country } = req.body;
    if (!address_line_1 || !city || !postcode) {
      return res.status(400).json({ success: false, error: 'Address line 1, city and postcode are required' });
    }
    const address = await addressesService.addAddress(req.user.id, { label, address_line_1, address_line_2, city, postcode, country });
    return res.status(201).json({ success: true, data: address });
  } catch (error) {
    console.error('Add address error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add address' });
  }
};

const updateAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    const { label, address_line_1, address_line_2, city, postcode, country } = req.body;
    const address = await addressesService.updateAddress(req.user.id, addressId, { label, address_line_1, address_line_2, city, postcode, country });
    return res.status(200).json({ success: true, data: address });
  } catch (error) {
    console.error('Update address error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update address' });
  }
};

const deleteAddress = async (req, res) => {
  try {
    const { addressId } = req.params;
    await addressesService.deleteAddress(req.user.id, addressId);
    return res.status(200).json({ success: true, message: 'Address deleted successfully' });
  } catch (error) {
    console.error('Delete address error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete address' });
  }
};

module.exports = { getAddresses, addAddress, updateAddress, deleteAddress };