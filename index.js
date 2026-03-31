// src/app.js
const express      = require('express');
const cors         = require('cors');
const dotenv       = require('dotenv');
const cookieParser = require('cookie-parser');
const { supabase } = require('./config/supabase');

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 8001;

// ─── Payment routes — MUST be before express.json() ─────────────────────────
// Stripe webhook requires raw body for signature verification.
// Webhook path: POST /payments
app.use('/payments',        require('./routes/stripeRoutes'));

// ─── Standard middleware ──────────────────────────────────────────────────────
app.use(cors({
  origin:      process.env.CLIENT_URL,
  credentials: true,
}));
app.use(express.json());
app.use(cookieParser());

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.use('/auth',           require('./routes/authRoutes'));
app.use('/profile',        require('./routes/profileRoutes'));
app.use('/points',         require('./routes/pawPointsRoutes'));
app.use('/discount-codes', require('./routes/discountCodeRoutes'));
app.use('/referrals',      require('./routes/referralRoutes'));
app.use('/pets',           require('./routes/petsRoutes'));
app.use('/addresses',      require('./routes/addressesRoutes'));
app.use('/services',       require('./routes/servicesRoutes'));
app.use('/bookings',       require('./routes/bookingsRoutes'));
app.use('/admin',          require('./routes/adminRoutes'));
app.use('/reviews',        require('./routes/reviewsRoutes'));

app.listen(PORT, async () => {
  console.log(`Tantans server running on port ${PORT}`);

  const { data, error } = await supabase
    .from('services')
    .select('id')
    .limit(1);

  if (error) {
    console.error('❌ Supabase connection failed:', error.message);
  } else {
    console.log('✅ Supabase connected — services table reachable');
  }
});