const express = require('express');
const { pool } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

router.get('/', authenticateToken, async (req, res) => {
  try {
    const { category, search, exam, test_type, year } = req.query;
    let where = "WHERE t.status = 'published'";
    const params = [];
    let idx = 1;
    if (category)  { where += ` AND t.category = $${idx++}`; params.push(category); }
    if (exam)      { where += ` AND t.exam = $${idx++}`; params.push(exam); }
    if (test_type) { where += ` AND t.test_type = $${idx++}`; params.push(test_type); }
    if (year)      { where += ` AND t.exam_year = $${idx++}`; params.push(Number(year)); }
    if (search)    { where += ` AND t.title ILIKE $${idx++}`; params.push(`%${search}%`); }

    const result = await pool.query(`
      SELECT t.*, s.name as subject_name, u.name as created_by_name,
        (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = t.id)::int as question_count
      FROM tests t
      LEFT JOIN subjects s ON t.subject_id = s.id
      LEFT JOIN users u ON t.created_by = u.id
      ${where}
      ORDER BY t.created_at DESC
    `, params);

    const tests = await Promise.all(result.rows.map(async (test) => {
      const att = await pool.query(
        `SELECT id, status, score, percentage FROM user_test_attempts
         WHERE user_id = $1 AND test_id = $2 ORDER BY id DESC LIMIT 1`,
        [req.user.id, test.id]
      );
      return { ...test, last_attempt: att.rows[0] || null };
    }));

    res.json(tests);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch tests' });
  }
});

// Exam facets: counts of published content per exam, split by type
router.get('/exams/facets', authenticateToken, async (req, res) => {
  try {
    const rows = (await pool.query(`
      SELECT COALESCE(exam, 'Other') as exam,
        COUNT(*) FILTER (WHERE test_type = 'pyq')::int as pyq_count,
        COUNT(*) FILTER (WHERE test_type = 'test_series' OR test_type IS NULL)::int as series_count
      FROM tests WHERE status = 'published'
      GROUP BY COALESCE(exam, 'Other')
      ORDER BY exam ASC
    `)).rows;
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch exam facets' });
  }
});

// Series: published test-series grouped by category (optionally filtered by exam)
router.get('/series/all', authenticateToken, async (req, res) => {
  try {
    const { exam } = req.query;
    const params = [];
    let where = "WHERE t.status = 'published' AND (t.test_type = 'test_series' OR t.test_type IS NULL)";
    if (exam) { where += ' AND t.exam = $1'; params.push(exam); }
    const result = await pool.query(`
      SELECT t.*, s.name as subject_name,
        (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = t.id)::int as question_count,
        (SELECT COUNT(*) FROM user_test_attempts a WHERE a.test_id = t.id AND a.status='completed')::int as attempt_count
      FROM tests t
      LEFT JOIN subjects s ON t.subject_id = s.id
      ${where}
      ORDER BY t.category ASC, t.created_at DESC
    `, params);
    const map = new Map();
    for (const t of result.rows) {
      const key = t.category || t.exam || 'General';
      if (!map.has(key)) map.set(key, { category: key, tests: [], total_questions: 0, total_duration: 0 });
      const g = map.get(key);
      g.tests.push(t);
      g.total_questions += t.question_count;
      g.total_duration += t.duration;
    }
    res.json(Array.from(map.values()));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch series' });
  }
});

// PYQ: published previous-year-question papers grouped by year (optionally filtered by exam)
router.get('/pyq/all', authenticateToken, async (req, res) => {
  try {
    const { exam } = req.query;
    const params = [];
    let where = "WHERE t.status = 'published' AND t.test_type = 'pyq'";
    if (exam) { where += ' AND t.exam = $1'; params.push(exam); }
    const result = await pool.query(`
      SELECT t.*, s.name as subject_name,
        (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = t.id)::int as question_count,
        (SELECT COUNT(*) FROM user_test_attempts a WHERE a.test_id = t.id AND a.status='completed')::int as attempt_count
      FROM tests t
      LEFT JOIN subjects s ON t.subject_id = s.id
      ${where}
      ORDER BY t.exam_year DESC NULLS LAST, t.created_at DESC
    `, params);
    const map = new Map();
    for (const t of result.rows) {
      const key = t.exam_year || 'Undated';
      if (!map.has(key)) map.set(key, { year: t.exam_year || null, tests: [], total_questions: 0 });
      const g = map.get(key);
      g.tests.push(t);
      g.total_questions += t.question_count;
    }
    // sort: real years desc, Undated last
    const groups = Array.from(map.values()).sort((a, b) => {
      if (a.year === null) return 1;
      if (b.year === null) return -1;
      return b.year - a.year;
    });
    res.json(groups);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch PYQs' });
  }
});

router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const testRes = await pool.query(`
      SELECT t.*, s.name as subject_name, tp.name as topic_name
      FROM tests t
      LEFT JOIN subjects s ON t.subject_id = s.id
      LEFT JOIN topics tp ON t.topic_id = tp.id
      WHERE t.id = $1 AND t.status = 'published'
    `, [req.params.id]);
    if (!testRes.rows[0]) return res.status(404).json({ error: 'Test not found' });

    const questions = await pool.query(`
      SELECT q.id, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d,
             q.question_type, q.difficulty_level, tq.marks, tq.order_num
      FROM test_questions tq
      JOIN question_bank q ON tq.question_id = q.id
      WHERE tq.test_id = $1
      ORDER BY tq.order_num ASC, tq.id ASC
    `, [req.params.id]);

    res.json({ ...testRes.rows[0], questions: questions.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch test' });
  }
});

module.exports = router;
