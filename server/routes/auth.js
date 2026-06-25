const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../database');
const { generateToken, authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.post('/register', async (req, res) => {
  const { name, email, mobile, password, exam_category, target_exam } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const hash = bcrypt.hashSync(password, 10);
    const result = await pool.query(
      `INSERT INTO users (name, email, mobile, password, role, exam_category, target_exam)
       VALUES ($1, $2, $3, $4, 'student', $5, $6) RETURNING id`,
      [name, email, mobile || null, hash, exam_category || null, target_exam || null]
    );

    const user = (await pool.query(
      'SELECT id, name, email, mobile, role, exam_category, target_exam, created_at FROM users WHERE id = $1',
      [result.rows[0].id]
    )).rows[0];

    const token = generateToken(user);
    res.status(201).json({ token, user });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Registration failed' }); }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const { password: _, ...safeUser } = user;
    const token = generateToken(safeUser);
    res.json({ token, user: safeUser });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Login failed' }); }
});

router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, email, mobile, role, exam_category, target_exam, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to get profile' }); }
});

router.put('/profile', authenticateToken, async (req, res) => {
  const { name, mobile, exam_category, target_exam, password, new_password } = req.body;
  try {
    const result = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (new_password) {
      if (!password || !bcrypt.compareSync(password, user.password)) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }
    }

    const hash = new_password ? bcrypt.hashSync(new_password, 10) : user.password;
    await pool.query(
      `UPDATE users SET name=$1, mobile=$2, exam_category=$3, target_exam=$4, password=$5 WHERE id=$6`,
      [name || user.name, mobile || user.mobile, exam_category || user.exam_category, target_exam || user.target_exam, hash, user.id]
    );

    const updated = (await pool.query(
      'SELECT id, name, email, mobile, role, exam_category, target_exam, created_at FROM users WHERE id = $1',
      [user.id]
    )).rows[0];
    res.json(updated);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Profile update failed' }); }
});

module.exports = router;
