const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true
}));

app.use(express.json());

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth', require('./routes/authRoutes'));
app.use('/profile', require('./routes/profileRoutes'));
app.use('/pets', require('./routes/petsRoutes'));
app.use('/addresses', require('./routes/addressesRoutes'));
app.use('/services', require('./routes/servicesRoutes'));
app.use('/bookings', require('./routes/bookingsRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

app.listen(PORT, () => {
  console.log(`Tantans server running on port ${PORT}`);
});