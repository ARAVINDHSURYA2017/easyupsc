require('dotenv').config();
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => console.error('Unexpected pg pool error', err));

async function initDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mobile TEXT,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      exam_category TEXT,
      target_exam TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subjects (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS topics (
      id SERIAL PRIMARY KEY,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS question_bank (
      id SERIAL PRIMARY KEY,
      question_text TEXT NOT NULL,
      option_a TEXT,
      option_b TEXT,
      option_c TEXT,
      option_d TEXT,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      difficulty_level TEXT DEFAULT 'medium',
      question_type TEXT DEFAULT 'single',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tests (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT,
      subject_id INTEGER REFERENCES subjects(id) ON DELETE SET NULL,
      topic_id INTEGER REFERENCES topics(id) ON DELETE SET NULL,
      duration INTEGER NOT NULL DEFAULT 60,
      total_marks INTEGER DEFAULT 0,
      negative_marks REAL DEFAULT 0,
      num_questions INTEGER DEFAULT 0,
      status TEXT DEFAULT 'draft',
      created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Multi-exam / PYQ support (added incrementally; safe on existing tables)
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS exam TEXT;
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS test_type TEXT DEFAULT 'test_series';
    ALTER TABLE tests ADD COLUMN IF NOT EXISTS exam_year INTEGER;

    CREATE TABLE IF NOT EXISTS test_questions (
      id SERIAL PRIMARY KEY,
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
      marks INTEGER DEFAULT 1,
      order_num INTEGER DEFAULT 0,
      UNIQUE(test_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS user_test_attempts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
      start_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      end_time TIMESTAMP,
      score REAL DEFAULT 0,
      percentage REAL DEFAULT 0,
      total_questions INTEGER DEFAULT 0,
      attempted INTEGER DEFAULT 0,
      correct INTEGER DEFAULT 0,
      wrong INTEGER DEFAULT 0,
      unattempted INTEGER DEFAULT 0,
      status TEXT DEFAULT 'in_progress'
    );

    CREATE TABLE IF NOT EXISTS user_responses (
      id SERIAL PRIMARY KEY,
      attempt_id INTEGER NOT NULL REFERENCES user_test_attempts(id) ON DELETE CASCADE,
      question_id INTEGER NOT NULL REFERENCES question_bank(id) ON DELETE CASCADE,
      selected_answer TEXT,
      is_correct INTEGER DEFAULT 0,
      time_spent INTEGER DEFAULT 0,
      marked_for_review INTEGER DEFAULT 0,
      UNIQUE(attempt_id, question_id)
    );
  `);

  // Seed admin
  const adminRes = await pool.query('SELECT id FROM users WHERE email = $1', ['admin@otp.com']);
  if (adminRes.rows.length === 0) {
    const hash = await bcrypt.hash('Admin@123', 10);
    await pool.query(
      `INSERT INTO users (name, email, mobile, password, role) VALUES ($1, $2, $3, $4, $5)`,
      ['Super Admin', 'admin@otp.com', '9999999999', hash, 'admin']
    );
    console.log('Default admin created: admin@otp.com / Admin@123');
  }

  // Seed subjects & topics
  const countRes = await pool.query('SELECT COUNT(*) as c FROM subjects');
  if (Number(countRes.rows[0].c) === 0) {
    const topicsMap = {
      Mathematics: ['Algebra', 'Geometry', 'Calculus', 'Statistics', 'Trigonometry'],
      Physics: ['Mechanics', 'Thermodynamics', 'Optics', 'Electromagnetism', 'Modern Physics'],
      Chemistry: ['Organic Chemistry', 'Inorganic Chemistry', 'Physical Chemistry', 'Biochemistry'],
      Biology: ['Cell Biology', 'Genetics', 'Ecology', 'Human Anatomy', 'Botany'],
      'General Knowledge': ['History', 'Geography', 'Current Affairs', 'Science & Technology'],
      English: ['Grammar', 'Vocabulary', 'Reading Comprehension', 'Writing'],
      'Computer Science': ['Data Structures', 'Algorithms', 'Databases', 'Networks', 'OS'],
    };
    for (const [name, topics] of Object.entries(topicsMap)) {
      const sr = await pool.query('INSERT INTO subjects (name) VALUES ($1) RETURNING id', [name]);
      const sid = sr.rows[0].id;
      for (const t of topics) {
        await pool.query('INSERT INTO topics (subject_id, name) VALUES ($1, $2)', [sid, t]);
      }
    }
    console.log('Subjects and topics seeded');
  }

  console.log('Database initialised successfully (NeonDB PostgreSQL)');
}

module.exports = { pool, initDatabase };
