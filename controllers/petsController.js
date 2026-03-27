// src/controllers/petsController.js
const petsService = require('../services/petsService');

const getPets = async (req, res) => {
  try {
    const pets = await petsService.getPets(req.user.id);
    return res.status(200).json({ success: true, data: pets });
  } catch (error) {
    console.error('Get pets error:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch pets' });
  }
};

const addPet = async (req, res) => {
  try {
    const { name, pet_type, breed } = req.body;
    if (!name || !pet_type) {
      return res.status(400).json({ success: false, error: 'Name and pet type are required' });
    }
    const pet = await petsService.addPet(req.user.id, { name, pet_type, breed });
    return res.status(201).json({ success: true, data: pet });
  } catch (error) {
    console.error('Add pet error:', error);
    return res.status(500).json({ success: false, error: 'Failed to add pet' });
  }
};

const updatePet = async (req, res) => {
  try {
    const { petId } = req.params;
    const { name, pet_type, breed } = req.body;
    const pet = await petsService.updatePet(req.user.id, petId, { name, pet_type, breed });
    return res.status(200).json({ success: true, data: pet });
  } catch (error) {
    console.error('Update pet error:', error);
    return res.status(500).json({ success: false, error: 'Failed to update pet' });
  }
};

const deletePet = async (req, res) => {
  try {
    const { petId } = req.params;
    await petsService.deletePet(req.user.id, petId);
    return res.status(200).json({ success: true, message: 'Pet deleted successfully' });
  } catch (error) {
    console.error('Delete pet error:', error);
    return res.status(500).json({ success: false, error: 'Failed to delete pet' });
  }
};

module.exports = { getPets, addPet, updatePet, deletePet };