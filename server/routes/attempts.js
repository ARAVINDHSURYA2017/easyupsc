const express = require('express');
const { pool } = require('../database');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Start attempt
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const { test_id } = req.body;
    if (!test_id) return res.status(400).json({ error: 'test_id required' });

    const testRes = await pool.query("SELECT * FROM tests WHERE id = $1 AND status = 'published'", [test_id]);
    if (!testRes.rows[0]) return res.status(404).json({ error: 'Test not found or not published' });

    const existing = await pool.query(
      "SELECT * FROM user_test_attempts WHERE user_id = $1 AND test_id = $2 AND status = 'in_progress'",
      [req.user.id, test_id]
    );
    if (existing.rows[0]) return res.json(existing.rows[0]);

    const qCount = await pool.query('SELECT COUNT(*) as c FROM test_questions WHERE test_id = $1', [test_id]);
    const result = await pool.query(
      `INSERT INTO user_test_attempts (user_id, test_id, start_time, total_questions, status)
       VALUES ($1, $2, NOW(), $3, 'in_progress') RETURNING *`,
      [req.user.id, test_id, Number(qCount.rows[0].c)]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to start attempt' });
  }
});

// Save single response
router.put('/:id/response', authenticateToken, async (req, res) => {
  try {
    const { question_id, selected_answer, time_spent, marked_for_review } = req.body;
    const attemptRes = await pool.query(
      'SELECT * FROM user_test_attempts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    const attempt = attemptRes.rows[0];
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Attempt already submitted' });

    const qRes = await pool.query('SELECT correct_answer FROM question_bank WHERE id = $1', [question_id]);
    if (!qRes.rows[0]) return res.status(404).json({ error: 'Question not found' });

    const is_correct = selected_answer && selected_answer.trim().toLowerCase() === qRes.rows[0].correct_answer.trim().toLowerCase() ? 1 : 0;

    await pool.query(`
      INSERT INTO user_responses (attempt_id, question_id, selected_answer, is_correct, time_spent, marked_for_review)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (attempt_id, question_id) DO UPDATE SET
        selected_answer = EXCLUDED.selected_answer,
        is_correct = EXCLUDED.is_correct,
        time_spent = EXCLUDED.time_spent,
        marked_for_review = EXCLUDED.marked_for_review
    `, [req.params.id, question_id, selected_answer || null, is_correct, time_spent || 0, marked_for_review ? 1 : 0]);

    res.json({ saved: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save response' });
  }
});

// Auto-save batch
router.post('/:id/autosave', authenticateToken, async (req, res) => {
  try {
    const { responses } = req.body;
    if (!Array.isArray(responses)) return res.status(400).json({ error: 'responses array required' });

    const attemptRes = await pool.query(
      'SELECT * FROM user_test_attempts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    const attempt = attemptRes.rows[0];
    if (!attempt || attempt.status !== 'in_progress') return res.status(400).json({ error: 'Invalid attempt' });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const r of responses) {
        const qRes = await client.query('SELECT correct_answer FROM question_bank WHERE id = $1', [r.question_id]);
        if (!qRes.rows[0]) continue;
        const is_correct = r.selected_answer && r.selected_answer.trim().toLowerCase() === qRes.rows[0].correct_answer.trim().toLowerCase() ? 1 : 0;
        await client.query(`
          INSERT INTO user_responses (attempt_id, question_id, selected_answer, is_correct, time_spent, marked_for_review)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (attempt_id, question_id) DO UPDATE SET
            selected_answer = EXCLUDED.selected_answer,
            is_correct = EXCLUDED.is_correct,
            time_spent = EXCLUDED.time_spent,
            marked_for_review = EXCLUDED.marked_for_review
        `, [attempt.id, r.question_id, r.selected_answer || null, is_correct, r.time_spent || 0, r.marked_for_review ? 1 : 0]);
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({ saved: true, count: responses.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Auto-save failed' });
  }
});

// Submit attempt
router.post('/:id/submit', authenticateToken, async (req, res) => {
  try {
    const attemptRes = await pool.query(
      'SELECT * FROM user_test_attempts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    const attempt = attemptRes.rows[0];
    if (!attempt) return res.status(404).json({ error: 'Attempt not found' });
    if (attempt.status !== 'in_progress') return res.status(400).json({ error: 'Already submitted' });

    // Save any final responses
    if (req.body.responses && Array.isArray(req.body.responses)) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const r of req.body.responses) {
          const qRes = await client.query('SELECT correct_answer FROM question_bank WHERE id = $1', [r.question_id]);
          if (!qRes.rows[0]) continue;
          const is_correct = r.selected_answer && r.selected_answer.trim().toLowerCase() === qRes.rows[0].correct_answer.trim().toLowerCase() ? 1 : 0;
          await client.query(`
            INSERT INTO user_responses (attempt_id, question_id, selected_answer, is_correct, time_spent, marked_for_review)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (attempt_id, question_id) DO UPDATE SET
              selected_answer = EXCLUDED.selected_answer, is_correct = EXCLUDED.is_correct,
              time_spent = EXCLUDED.time_spent, marked_for_review = EXCLUDED.marked_for_review
          `, [attempt.id, r.question_id, r.selected_answer || null, is_correct, r.time_spent || 0, r.marked_for_review ? 1 : 0]);
        }
        await client.query('COMMIT');
      } catch (e) { await client.query('ROLLBACK'); throw e; }
      finally { client.release(); }
    }

    const testRes = await pool.query('SELECT * FROM tests WHERE id = $1', [attempt.test_id]);
    const test = testRes.rows[0];
    const responses = (await pool.query('SELECT * FROM user_responses WHERE attempt_id = $1', [attempt.id])).rows;
    const testQuestions = (await pool.query('SELECT * FROM test_questions WHERE test_id = $1', [attempt.test_id])).rows;

    let score = 0, correct = 0, wrong = 0, attempted = 0;
    for (const tq of testQuestions) {
      const resp = responses.find(r => r.question_id === tq.question_id);
      if (!resp || !resp.selected_answer) continue;
      attempted++;
      if (resp.is_correct) { correct++; score += tq.marks; }
      else { wrong++; score -= Number(test.negative_marks) || 0; }
    }
    const unattempted = attempt.total_questions - attempted;
    const totalMarks = testQuestions.reduce((s, q) => s + q.marks, 0) || attempt.total_questions;
    const percentage = totalMarks > 0 ? Math.max(0, (score / totalMarks) * 100) : 0;

    const updated = await pool.query(`
      UPDATE user_test_attempts SET
        end_time = NOW(), score = $1, percentage = $2,
        attempted = $3, correct = $4, wrong = $5, unattempted = $6, status = 'completed'
      WHERE id = $7 RETURNING *
    `, [Math.max(0, score), Math.round(percentage * 100) / 100, attempted, correct, wrong, unattempted, attempt.id]);

    res.json(updated.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Submit failed' });
  }
});

// Results
router.get('/:id/results', authenticateToken, async (req, res) => {
  try {
    const attemptRes = await pool.query(
      'SELECT * FROM user_test_attempts WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]
    );
    if (!attemptRes.rows[0]) return res.status(404).json({ error: 'Attempt not found' });
    const attempt = attemptRes.rows[0];

    const test = (await pool.query(
      'SELECT t.*, s.name as subject_name FROM tests t LEFT JOIN subjects s ON t.subject_id = s.id WHERE t.id = $1',
      [attempt.test_id]
    )).rows[0];

    const questions = (await pool.query(`
      SELECT q.*, tq.marks, tq.order_num,
             ur.selected_answer, ur.is_correct, ur.time_spent, ur.marked_for_review
      FROM test_questions tq
      JOIN question_bank q ON tq.question_id = q.id
      LEFT JOIN user_responses ur ON ur.question_id = q.id AND ur.attempt_id = $1
      WHERE tq.test_id = $2
      ORDER BY tq.order_num ASC, tq.id ASC
    `, [attempt.id, attempt.test_id])).rows;

    res.json({ attempt, test, questions });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// History
router.get('/', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT a.*, t.title as test_title, t.duration, t.total_marks, t.category, s.name as subject_name
      FROM user_test_attempts a
      JOIN tests t ON a.test_id = t.id
      LEFT JOIN subjects s ON t.subject_id = s.id
      WHERE a.user_id = $1
      ORDER BY a.id DESC
    `, [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

// Student dashboard stats
router.get('/stats/summary', authenticateToken, async (req, res) => {
  try {
    const uid = req.user.id;
    const totalAttempts = Number((await pool.query(
      "SELECT COUNT(*) as c FROM user_test_attempts WHERE user_id = $1 AND status = 'completed'", [uid]
    )).rows[0].c);
    const avgScore = Number((await pool.query(
      "SELECT COALESCE(AVG(percentage), 0) as avg FROM user_test_attempts WHERE user_id = $1 AND status = 'completed'", [uid]
    )).rows[0].avg);
    const bestScore = Number((await pool.query(
      "SELECT COALESCE(MAX(percentage), 0) as best FROM user_test_attempts WHERE user_id = $1 AND status = 'completed'", [uid]
    )).rows[0].best);
    const recentAttempts = (await pool.query(`
      SELECT a.*, t.title as test_title, t.category
      FROM user_test_attempts a JOIN tests t ON a.test_id = t.id
      WHERE a.user_id = $1 AND a.status = 'completed' ORDER BY a.id DESC LIMIT 5
    `, [uid])).rows;
    const subjectPerf = (await pool.query(`
      SELECT s.name as subject, AVG(a.percentage) as avg_score, COUNT(*) as attempts
      FROM user_test_attempts a JOIN tests t ON a.test_id = t.id JOIN subjects s ON t.subject_id = s.id
      WHERE a.user_id = $1 AND a.status = 'completed' GROUP BY s.id, s.name
    `, [uid])).rows;

    res.json({
      totalAttempts,
      avgScore: Math.round(avgScore * 100) / 100,
      bestScore: Math.round(bestScore * 100) / 100,
      recentAttempts,
      subjectPerf,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

module.exports = router;
