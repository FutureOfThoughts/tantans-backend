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

app.use('/auth', require('./routes/auth'));
app.use('/profile', require('./routes/profile'));
app.use('/pets', require('./routes/pets'));
app.use('/addresses', require('./routes/addresses'));
app.use('/services', require('./routes/services'));
app.use('/bookings', require('./routes/bookings'));
app.use('/admin', require('./routes/admin'));

app.listen(PORT, () => {
  console.log(`Tantans server running on port ${PORT}`);
});