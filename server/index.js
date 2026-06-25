require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const authRoutes = require('./routes/auth');
const adminRoutes = require('./routes/admin');
const testsRoutes = require('./routes/tests');
const attemptsRoutes = require('./routes/attempts');
const aiUploadRoutes = require('./routes/aiUpload');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:4173',
    'https://easyupsc.com',
    'https://www.easyupsc.com',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '150mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

initDatabase()
  .then(() => {
    app.use('/api/auth', authRoutes);
    app.use('/api/admin/ai-upload', aiUploadRoutes);  // must be before /api/admin
    app.use('/api/admin', adminRoutes);
    app.use('/api/tests', testsRoutes);
    app.use('/api/attempts', attemptsRoutes);
    app.get('/api/health', (req, res) => res.json({ status: 'ok', db: 'NeonDB PostgreSQL', time: new Date().toISOString() }));

    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on http://localhost:${PORT}`);
      console.log(`   Database: NeonDB PostgreSQL`);
      console.log(`   Default admin: admin@otp.com / Admin@123\n`);
    });
  })
  .catch(err => {
    console.error('Failed to initialise database:', err);
    process.exit(1);
  });
