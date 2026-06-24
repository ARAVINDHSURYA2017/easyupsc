const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../uploads')),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 }, fileFilter: (req, file, cb) => {
  file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Only PDF files allowed'));
}});

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const totalUsers     = Number((await pool.query("SELECT COUNT(*) as c FROM users WHERE role='student'")).rows[0].c);
    const totalTests     = Number((await pool.query('SELECT COUNT(*) as c FROM tests')).rows[0].c);
    const totalAttempts  = Number((await pool.query("SELECT COUNT(*) as c FROM user_test_attempts WHERE status='completed'")).rows[0].c);
    const avgScore       = Number((await pool.query("SELECT COALESCE(AVG(percentage),0) as avg FROM user_test_attempts WHERE status='completed'")).rows[0].avg);
    const totalQuestions = Number((await pool.query('SELECT COUNT(*) as c FROM question_bank')).rows[0].c);

    const recentAttempts = (await pool.query(`
      SELECT a.*, u.name as user_name, t.title as test_title
      FROM user_test_attempts a JOIN users u ON a.user_id = u.id JOIN tests t ON a.test_id = t.id
      WHERE a.status='completed' ORDER BY a.id DESC LIMIT 10
    `)).rows;

    const hardQuestions = (await pool.query(`
      SELECT q.id, q.question_text, COUNT(ur.id) as attempts,
             SUM(CASE WHEN ur.is_correct=0 AND ur.selected_answer IS NOT NULL THEN 1 ELSE 0 END) as wrong_count
      FROM user_responses ur JOIN question_bank q ON ur.question_id = q.id
      GROUP BY q.id HAVING COUNT(ur.id) > 0
      ORDER BY (SUM(CASE WHEN ur.is_correct=0 AND ur.selected_answer IS NOT NULL THEN 1 ELSE 0 END)::REAL / COUNT(ur.id)) DESC
      LIMIT 5
    `)).rows;

    const userRankings = (await pool.query(`
      SELECT u.id, u.name, u.email, AVG(a.percentage) as avg_score, COUNT(a.id) as attempts
      FROM user_test_attempts a JOIN users u ON a.user_id = u.id
      WHERE a.status='completed' GROUP BY u.id ORDER BY avg_score DESC LIMIT 10
    `)).rows;

    res.json({ totalUsers, totalTests, totalAttempts, avgScore: Math.round(avgScore * 100) / 100, totalQuestions, recentAttempts, hardQuestions, userRankings });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Stats failed' }); }
});

// ── Subjects ──────────────────────────────────────────────────────────────────
router.get('/subjects', async (req, res) => {
  const r = await pool.query('SELECT * FROM subjects ORDER BY name');
  res.json(r.rows);
});

router.post('/subjects', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = await pool.query('INSERT INTO subjects (name) VALUES ($1) RETURNING *', [name]);
  res.status(201).json(r.rows[0]);
});

// ── Topics ────────────────────────────────────────────────────────────────────
router.get('/topics', async (req, res) => {
  const { subject_id } = req.query;
  let sql = 'SELECT t.*, s.name as subject_name FROM topics t LEFT JOIN subjects s ON t.subject_id = s.id';
  const params = [];
  if (subject_id) { sql += ' WHERE t.subject_id = $1'; params.push(subject_id); }
  sql += ' ORDER BY t.name';
  res.json((await pool.query(sql, params)).rows);
});

router.post('/topics', async (req, res) => {
  const { name, subject_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = await pool.query('INSERT INTO topics (name, subject_id) VALUES ($1, $2) RETURNING *', [name, subject_id || null]);
  res.status(201).json(r.rows[0]);
});

// ── Questions ─────────────────────────────────────────────────────────────────
router.get('/questions', async (req, res) => {
  try {
    const { subject_id, topic_id, search, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;
    if (subject_id) { where += ` AND q.subject_id = $${idx++}`; params.push(subject_id); }
    if (topic_id)   { where += ` AND q.topic_id = $${idx++}`;   params.push(topic_id); }
    if (search)     { where += ` AND q.question_text ILIKE $${idx++}`; params.push(`%${search}%`); }

    const total = Number((await pool.query(`SELECT COUNT(*) as c FROM question_bank q ${where}`, params)).rows[0].c);
    const questions = (await pool.query(`
      SELECT q.*, s.name as subject_name, t.name as topic_name, u.name as creator_name
      FROM question_bank q
      LEFT JOIN subjects s ON q.subject_id = s.id
      LEFT JOIN topics t ON q.topic_id = t.id
      LEFT JOIN users u ON q.created_by = u.id
      ${where}
      ORDER BY q.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, Number(limit), Number(offset)])).rows;

    res.json({ questions, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch questions' }); }
});

router.post('/questions', async (req, res) => {
  try {
    const { question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, topic_id, subject_id, difficulty_level, question_type } = req.body;
    if (!question_text || !correct_answer) return res.status(400).json({ error: 'question_text and correct_answer required' });
    const r = await pool.query(`
      INSERT INTO question_bank (question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, topic_id, subject_id, difficulty_level, question_type, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *
    `, [question_text, option_a||null, option_b||null, option_c||null, option_d||null, correct_answer, explanation||null, topic_id||null, subject_id||null, difficulty_level||'medium', question_type||'single', req.user.id]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create question' }); }
});

router.put('/questions/:id', async (req, res) => {
  try {
    const { question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, topic_id, subject_id, difficulty_level, question_type } = req.body;
    const q = (await pool.query('SELECT * FROM question_bank WHERE id = $1', [req.params.id])).rows[0];
    if (!q) return res.status(404).json({ error: 'Question not found' });
    const r = await pool.query(`
      UPDATE question_bank SET question_text=$1, option_a=$2, option_b=$3, option_c=$4, option_d=$5,
        correct_answer=$6, explanation=$7, topic_id=$8, subject_id=$9, difficulty_level=$10, question_type=$11
      WHERE id=$12 RETURNING *
    `, [question_text||q.question_text, option_a??q.option_a, option_b??q.option_b, option_c??q.option_c, option_d??q.option_d,
        correct_answer||q.correct_answer, explanation??q.explanation, topic_id??q.topic_id, subject_id??q.subject_id,
        difficulty_level||q.difficulty_level, question_type||q.question_type, q.id]);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update question' }); }
});

router.delete('/questions/:id', async (req, res) => {
  await pool.query('DELETE FROM question_bank WHERE id = $1', [req.params.id]);
  res.json({ deleted: true });
});

router.post('/questions/bulk', async (req, res) => {
  try {
    const { questions, subject_id, topic_id } = req.body;
    if (!Array.isArray(questions) || !questions.length) return res.status(400).json({ error: 'questions array required' });
    const client = await pool.connect();
    const ids = [];
    try {
      await client.query('BEGIN');
      for (const q of questions) {
        const r = await client.query(`
          INSERT INTO question_bank (question_text, option_a, option_b, option_c, option_d, correct_answer, explanation, topic_id, subject_id, difficulty_level, question_type, created_by)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id
        `, [q.question_text, q.option_a||null, q.option_b||null, q.option_c||null, q.option_d||null,
            q.correct_answer||'A', q.explanation||null, topic_id||null, subject_id||null,
            q.difficulty_level||'medium', q.question_type||'single', req.user.id]);
        ids.push(r.rows[0].id);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
    res.status(201).json({ inserted: ids.length, ids });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Bulk import failed' }); }
});

// ── PDF Upload ─────────────────────────────────────────────────────────────────
router.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'PDF file required' });
  try {
    const pdfParse = require('pdf-parse');
    const buffer = fs.readFileSync(req.file.path);
    const data = await pdfParse(buffer);
    const questions = extractQuestionsFromText(data.text);
    fs.unlinkSync(req.file.path);
    res.json({ questions, total_pages: data.numpages });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: 'PDF extraction failed: ' + err.message });
  }
});

function extractQuestionsFromText(text) {
  const questions = [];
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  let i = 0;
  const questionPatterns = [/^(?:Q\.?|Question)?\s*(\d+)[.)]\s+(.+)/i, /^(\d+)\s*[.)]\s+(.+)/];
  const optionPatterns = [/^([A-D])[.)]\s+(.+)/i, /^\(([A-D])\)\s+(.+)/i];
  const answerPattern = /^(?:Answer|Ans|Correct)[:\s]+([A-D])/i;
  const explanationPattern = /^(?:Explanation|Solution)[:\s]+(.+)/i;
  while (i < lines.length) {
    const line = lines[i];
    let qMatch = null;
    for (const p of questionPatterns) { qMatch = line.match(p); if (qMatch) break; }
    if (qMatch) {
      let questionText = qMatch[2] || qMatch[1]; i++;
      while (i < lines.length && !optionPatterns.some(p => lines[i].match(p)) && !questionPatterns.some(p => lines[i].match(p))) {
        questionText += ' ' + lines[i]; i++;
      }
      const options = { A: '', B: '', C: '', D: '' };
      let optCount = 0;
      while (i < lines.length && optCount < 4) {
        let om = null;
        for (const p of optionPatterns) { om = lines[i].match(p); if (om) break; }
        if (!om) break;
        options[om[1].toUpperCase()] = om[2]; optCount++; i++;
      }
      let correctAnswer = 'A', explanation = '';
      if (i < lines.length) { const am = lines[i].match(answerPattern); if (am) { correctAnswer = am[1].toUpperCase(); i++; } }
      if (i < lines.length) { const em = lines[i].match(explanationPattern); if (em) { explanation = em[1]; i++; } }
      if (questionText.length > 5) {
        questions.push({ question_text: questionText.trim(), option_a: options.A||null, option_b: options.B||null, option_c: options.C||null, option_d: options.D||null, correct_answer: correctAnswer, explanation: explanation||null, question_type: 'single', difficulty_level: 'medium' });
      }
    } else { i++; }
  }
  return questions;
}

// ── Tests ──────────────────────────────────────────────────────────────────────
router.get('/tests', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT t.*, s.name as subject_name, u.name as created_by_name,
        (SELECT COUNT(*) FROM test_questions tq WHERE tq.test_id = t.id)::int as question_count,
        (SELECT COUNT(*) FROM user_test_attempts a WHERE a.test_id = t.id AND a.status='completed')::int as attempt_count
      FROM tests t
      LEFT JOIN subjects s ON t.subject_id = s.id
      LEFT JOIN users u ON t.created_by = u.id
      ORDER BY t.created_at DESC
    `);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch tests' }); }
});

router.post('/tests', async (req, res) => {
  try {
    const { title, description, category, exam, test_type, exam_year, subject_id, topic_id, duration, total_marks, negative_marks, num_questions } = req.body;
    if (!title || !duration) return res.status(400).json({ error: 'title and duration required' });
    const type = test_type === 'pyq' ? 'pyq' : 'test_series';
    if (type === 'pyq' && !exam_year) return res.status(400).json({ error: 'Exam year is required for PYQ' });
    const r = await pool.query(`
      INSERT INTO tests (title, description, category, exam, test_type, exam_year, subject_id, topic_id, duration, total_marks, negative_marks, num_questions, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'draft',$13) RETURNING *
    `, [title, description||null, category||null, exam||null, type, exam_year||null, subject_id||null, topic_id||null, duration, total_marks||0, negative_marks||0, num_questions||0, req.user.id]);
    res.status(201).json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to create test' }); }
});

router.get('/tests/:id', async (req, res) => {
  try {
    const t = (await pool.query(`
      SELECT t.*, s.name as subject_name, tp.name as topic_name
      FROM tests t LEFT JOIN subjects s ON t.subject_id = s.id LEFT JOIN topics tp ON t.topic_id = tp.id
      WHERE t.id = $1
    `, [req.params.id])).rows[0];
    if (!t) return res.status(404).json({ error: 'Test not found' });
    const questions = (await pool.query(`
      SELECT tq.id as tq_id, tq.marks, tq.order_num, q.*
      FROM test_questions tq JOIN question_bank q ON tq.question_id = q.id
      WHERE tq.test_id = $1 ORDER BY tq.order_num ASC, tq.id ASC
    `, [req.params.id])).rows;
    res.json({ ...t, questions });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch test' }); }
});

router.put('/tests/:id', async (req, res) => {
  try {
    const { title, description, category, exam, test_type, exam_year, subject_id, topic_id, duration, total_marks, negative_marks, num_questions } = req.body;
    const t = (await pool.query('SELECT * FROM tests WHERE id = $1', [req.params.id])).rows[0];
    if (!t) return res.status(404).json({ error: 'Test not found' });
    const type = test_type === 'pyq' || test_type === 'test_series' ? test_type : t.test_type;
    const r = await pool.query(`
      UPDATE tests SET title=$1, description=$2, category=$3, exam=$4, test_type=$5, exam_year=$6,
        subject_id=$7, topic_id=$8, duration=$9, total_marks=$10, negative_marks=$11, num_questions=$12 WHERE id=$13 RETURNING *
    `, [title||t.title, description??t.description, category??t.category, exam??t.exam, type, exam_year??t.exam_year,
        subject_id??t.subject_id, topic_id??t.topic_id, duration||t.duration, total_marks??t.total_marks,
        negative_marks??t.negative_marks, num_questions??t.num_questions, t.id]);
    res.json(r.rows[0]);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to update test' }); }
});

router.delete('/tests/:id', async (req, res) => {
  await pool.query('DELETE FROM tests WHERE id = $1', [req.params.id]);
  res.json({ deleted: true });
});

router.put('/tests/:id/publish', async (req, res) => {
  const count = Number((await pool.query('SELECT COUNT(*) as c FROM test_questions WHERE test_id = $1', [req.params.id])).rows[0].c);
  if (count === 0) return res.status(400).json({ error: 'Add at least one question before publishing' });
  await pool.query("UPDATE tests SET status='published' WHERE id=$1", [req.params.id]);
  res.json({ status: 'published' });
});

router.put('/tests/:id/unpublish', async (req, res) => {
  await pool.query("UPDATE tests SET status='draft' WHERE id=$1", [req.params.id]);
  res.json({ status: 'draft' });
});

router.post('/tests/:id/questions', async (req, res) => {
  try {
    const { question_ids, marks = 1 } = req.body;
    if (!Array.isArray(question_ids) || !question_ids.length) return res.status(400).json({ error: 'question_ids array required' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const qid of question_ids) {
        await client.query(`
          INSERT INTO test_questions (test_id, question_id, marks, order_num)
          VALUES ($1, $2, $3, (SELECT COALESCE(MAX(order_num),0)+1 FROM test_questions WHERE test_id=$1))
          ON CONFLICT (test_id, question_id) DO NOTHING
        `, [req.params.id, qid, marks]);
      }
      await client.query('COMMIT');
    } catch (e) { await client.query('ROLLBACK'); throw e; }
    finally { client.release(); }
    const total = Number((await pool.query('SELECT COUNT(*) as c FROM test_questions WHERE test_id = $1', [req.params.id])).rows[0].c);
    const totalMarks = Number((await pool.query('SELECT COALESCE(SUM(marks),0) as tm FROM test_questions WHERE test_id = $1', [req.params.id])).rows[0].tm);
    await pool.query('UPDATE tests SET num_questions=$1, total_marks=$2 WHERE id=$3', [total, totalMarks, req.params.id]);
    res.json({ added: question_ids.length, total });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to add questions' }); }
});

router.delete('/tests/:id/questions/:qid', async (req, res) => {
  await pool.query('DELETE FROM test_questions WHERE test_id=$1 AND question_id=$2', [req.params.id, req.params.qid]);
  const total = Number((await pool.query('SELECT COUNT(*) as c FROM test_questions WHERE test_id = $1', [req.params.id])).rows[0].c);
  await pool.query('UPDATE tests SET num_questions=$1 WHERE id=$2', [total, req.params.id]);
  res.json({ deleted: true });
});

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users', async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT u.id, u.name, u.email, u.mobile, u.role, u.exam_category, u.target_exam, u.created_at,
        COUNT(a.id) as attempt_count, COALESCE(AVG(a.percentage),0) as avg_score
      FROM users u
      LEFT JOIN user_test_attempts a ON a.user_id = u.id AND a.status='completed'
      WHERE u.role = 'student'
      GROUP BY u.id ORDER BY u.created_at DESC
    `);
    res.json(r.rows);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Failed to fetch users' }); }
});

module.exports = router;
