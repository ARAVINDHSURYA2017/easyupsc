require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const pdfParse = require('pdf-parse');
const { PDFDocument } = require('pdf-lib');
const { pool } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) =>
    file.mimetype === 'application/pdf' ? cb(null, true) : cb(new Error('Only PDF files allowed')),
});

// ─────────────────────────────────────────────────────────────────────────────
// PDF TEXT PARSER — extracts all content from text-based PDFs without any API
// Handles formats:
//   Format 1 (IASbaba/answer-key): Q.N) ... a) b) c) d) Solution(x) EXPLANATION:...
//   Format 2 (DOCX/clean):         Q1.  ... (a)(b)(c)(d) Answer:(x)  Explanation:...
//   Format 3 (numbered):           1.   ... A. B. C. D.  Correct Answer: X
// ─────────────────────────────────────────────────────────────────────────────
function parseTextPDF(rawText) {
  const text = rawText
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    // Strip common page headers/footers
    .replace(/UPSC\s+GS[-\s]*I\s+\d{4}\s+Answer\s+Key[^\n]*/gi, '')
    .replace(/UPSC\s+Civil\s+Services[^\n]*/gi, '')
    .replace(/UPSC CSE PRELIMS[\s\S]{0,60}?\d{4}\s*\n/gi, '')
    .replace(/IASBABA\s+\d+\s*\n/gi, '')
    .replace(/Page\s*\d+\s*of\s*\d+/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/REFERENCE\s*:/gi, '')
    .replace(/Babapedia\s*:/gi, '')
    .replace(/IASbaba[^\n]*/gi, '')
    .trim();

  // ── Detect format ──────────────────────────────────────────────────────────
  const isFormat1 = /Q\.\s*\d+\)/i.test(text);
  const isFormat2 = /^Q\s*\d+\./im.test(text);
  const isFormat3 = /^\d+\.\s+\S/im.test(text);

  let blocks = [];
  if (isFormat1) {
    blocks = text.split(/(?=Q\.\s*\d+\))/gi).filter(b => /Q\.\s*\d+\)/i.test(b));
  } else if (isFormat2) {
    blocks = text.split(/(?=^Q\s*\d+\.)/gim).filter(b => /^Q\s*\d+\./i.test(b.trim()));
  } else if (isFormat3) {
    blocks = text.split(/(?=^\d+\.\s)/gm).filter(b => /^\d+\.\s/.test(b.trim()));
  }

  console.log(`Format: ${isFormat1 ? '1 (Q.N))' : isFormat2 ? '2 (QN.)' : isFormat3 ? '3 (N.)' : 'unknown'}, Blocks: ${blocks.length}`);

  // ── Build topic/difficulty map from "Topic  |  [Difficulty]" metadata lines ─
  const topicMap = {};
  const topicLineRe = /^([A-Za-z ,&\/\-]+?)\s*\|\s*\[\s*(Easy|Medium|Hard)\s*\]/gim;
  let tm;
  while ((tm = topicLineRe.exec(text)) !== null) {
    const afterPos = tm.index + tm[0].length;
    const nextQ = text.slice(afterPos).match(/Q\.\s*(\d+)\)/i);
    if (nextQ) topicMap[parseInt(nextQ[1], 10)] = { topic: tm[1].trim(), difficulty: tm[2].toLowerCase() };
  }

  const questions = [];

  for (const block of blocks) {
    try {
      // ── Question number ──────────────────────────────────────────────────
      const numMatch = block.match(/Q\.\s*(\d+)\)|^Q\s*(\d+)\.|^(\d+)\./im);
      if (!numMatch) continue;
      const question_number = parseInt(numMatch[1] || numMatch[2] || numMatch[3], 10);

      // ── Correct answer — try multiple patterns ───────────────────────────
      let correct_answer = null;
      const ansPatterns = [
        /Solution\s*[:\-]?\s*\(([a-dA-D])\)/i,
        /Answer\s*[:\-]\s*\(?([a-dA-D])\)?/i,
        /Correct\s+(?:Answer|Option)\s*[:\-]\s*\(?([a-dA-D])\)?/i,
        /Ans\s*[:\-]\s*\(?([a-dA-D])\)?/i,
        /Key\s*[:\-]\s*\(?([a-dA-D])\)?/i,
      ];
      for (const p of ansPatterns) {
        const m = block.match(p);
        if (m) { correct_answer = m[1].toUpperCase(); break; }
      }

      // ── Explanation — try multiple labels ────────────────────────────────
      let explanation = '';
      const expPatterns = [
        /EXPLANATION\s*[:\-]?\s*([\s\S]*?)(?=REFERENCE\s*:|Q\.\s*\d+\)|$)/i,
        /Explanation\s*[:\-]\s*([\s\S]*?)(?=Q\s*\d+\.|^\d+\.|$)/im,
        /Solution\s*[:\-]?\s*\([a-dA-D]\)\s*([\s\S]*?)(?=Q\.\s*\d+\)|$)/i,
      ];
      for (const p of expPatterns) {
        const m = block.match(p);
        if (m && m[1].trim().length > 10) {
          explanation = m[1]
            .replace(/\n{3,}/g, '\n\n')
            // Strip trailing topic metadata line
            .replace(/\n[A-Za-z ,&\/\-]+?\s*\|\s*\[(?:Easy|Medium|Hard)\]\s*$/i, '')
            .trim();
          if (explanation.length > 2000) explanation = explanation.slice(0, 2000) + '…';
          break;
        }
      }

      // ── Strip answer + explanation from block to isolate question+options ─
      let questionBody = block
        .replace(/Solution\s*[:\-]?\s*\([a-dA-D]\)[\s\S]*/i, '')
        .replace(/Answer\s*[:\-]\s*\(?[a-dA-D]\)?[\s\S]*/i, '')
        .replace(/Correct\s+(?:Answer|Option)\s*[:\-][\s\S]*/i, '')
        .replace(/EXPLANATION\s*[:\-]?[\s\S]*/i, '')
        .replace(/Explanation\s*[:\-][\s\S]*/i, '')
        .trim();

      // ── Options — support (a), a), A., A) formats ────────────────────────
      const opts = { a: '', b: '', c: '', d: '' };
      const optPatterns = [
        /\b([a-d])\)\s*([\s\S]*?)(?=\b[a-d]\)|Solution|Answer|$)/gi,   // a) text
        /\(([a-d])\)\s*([\s\S]*?)(?=\([a-d]\)|Solution|Answer|$)/gi,   // (a) text
        /^([A-D])\.\s*([\s\S]*?)(?=^[A-D]\.\s|Solution|Answer|$)/gim, // A. text
      ];
      for (const re of optPatterns) {
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(questionBody)) !== null) {
          const k = m[1].toLowerCase();
          if (!opts[k]) opts[k] = m[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        }
        if (opts.a && opts.b) break; // found options
      }

      // ── Question text ────────────────────────────────────────────────────
      const firstOptIdx = questionBody.search(/\b[a-d]\)\s|\([a-d]\)\s|^[A-D]\.\s/im);
      let question_text = (firstOptIdx > 0 ? questionBody.slice(0, firstOptIdx) : questionBody)
        .replace(numMatch[0], '').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

      if (!question_text || question_text.length < 10) continue;

      // ── Topic & difficulty from PDF metadata or keyword heuristic ─────────
      const meta = topicMap[question_number];
      const topic = meta ? meta.topic : guessTopic(question_text);
      const difficulty_level = meta ? meta.difficulty : guessdifficulty(question_text, explanation);

      // ── Option-wise explanation — derived from the explanation text ────────
      const option_wise_explanation = buildOptionWiseExplanation(
        correct_answer, explanation, opts
      );

      questions.push({
        question_number, question_text,
        option_a: opts.a, option_b: opts.b, option_c: opts.c, option_d: opts.d,
        correct_answer, explanation, option_wise_explanation,
        topic, difficulty_level,
      });
    } catch (e) {
      console.warn(`Skipped block: ${e.message}`);
    }
  }

  return questions;
}

// Build option-wise explanations from extracted explanation text
function buildOptionWiseExplanation(correct_answer, explanation, opts) {
  const owe = { A: '', B: '', C: '', D: '' };
  if (!explanation) return owe;

  const optLabels = { A: opts.a, B: opts.b, C: opts.c, D: opts.d };
  const shortExp = explanation.slice(0, 300);
  const veryShort = explanation.slice(0, 150);

  for (const k of ['A', 'B', 'C', 'D']) {
    const optText = optLabels[k] ? ` "${optLabels[k]}"` : '';
    if (k === correct_answer) {
      owe[k] = `Option ${k}${optText} is correct. ${shortExp}`;
    } else {
      owe[k] = `Option ${k}${optText} is incorrect. ${correct_answer ? `The correct answer is Option ${correct_answer}. ` : ''}${veryShort}`;
    }
  }

  return owe;
}

// Topic classifier from question text keywords
function guessTopic(text) {
  if (/histor|mughal|british|maurya|gupta|ashoka|dynasty|medieval|ancient|colonial/i.test(text)) return 'History';
  if (/geograph|river|mountain|climate|rainfall|plateau|delta|bay|ocean|latitude|longitude/i.test(text)) return 'Geography';
  if (/constitu|article \d|amendment|parliament|supreme court|fundamental right|directive|lok sabha|rajya sabha|president|governor/i.test(text)) return 'Polity & Governance';
  if (/econom|gdp|inflation|budget|fiscal|monetary|rbi|bank|trade|export|import|gst|tax/i.test(text)) return 'Economy';
  if (/science|technology|nano|robot|space|isro|nasa|satellite|nuclear|physics|chemistry|biology|gene|dna/i.test(text)) return 'Science & Technology';
  if (/environment|ecology|biodiversity|species|forest|climate change|carbon|pollution|wildlife|wetland|biosphere/i.test(text)) return 'Environment & Ecology';
  if (/internation|united nations|un |who |wto |imf |world bank|treaty|agreement|summit|bilateral/i.test(text)) return 'International Relations';
  if (/scheme|yojana|mission|programme|government|ministry|policy|flagship/i.test(text)) return 'Government Schemes';
  if (/culture|art|dance|music|festival|heritage|monument|temple|literature/i.test(text)) return 'Art & Culture';
  return 'General Studies';
}

// Difficulty based on question complexity indicators
function guessdifficulty(questionText, explanation = '') {
  const words = questionText.split(/\s+/).length;
  const hasStatements = /statement[\s-]?(i+|1|2|3)/i.test(questionText);
  const hasWhichOf = /which (of the following|one|among)/i.test(questionText);
  const longExplanation = explanation.length > 600;

  if (hasStatements || longExplanation) return 'hard';
  if (hasWhichOf || words > 50) return 'medium';
  if (words < 25) return 'easy';
  return 'medium';
}

// ── POST /api/admin/ai-upload/process ────────────────────────────────────────
router.post('/process', (req, res, next) => {
  upload.single('pdf')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message || 'File upload error' });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'PDF file required' });

  const { exam = 'UPSC', exam_year, test_type, subject_id } = req.body;

  try {
    const pdfBuffer = req.file.buffer;
    const sizeMB = pdfBuffer.length / 1024 / 1024;
    console.log(`\nUpload: ${req.file.originalname}, ${sizeMB.toFixed(1)}MB`);

    let allQuestions = [];
    let method = 'text';

    // Try text extraction
    try {
      const parsed = await pdfParse(pdfBuffer);
      const textLength = (parsed.text || '').replace(/\s/g, '').length;
      console.log(`Extracted ${textLength} chars`);

      if (textLength > 500) {
        allQuestions = parseTextPDF(parsed.text);
        console.log(`Parser found ${allQuestions.length} questions`);
        method = 'text';
      }
    } catch (e) {
      console.warn('pdf-parse failed:', e.message);
    }

    if (allQuestions.length === 0) {
      return res.status(422).json({
        error: 'No questions could be extracted from this PDF. The file may be scanned/image-based or use an unsupported format. Please use a text-based PDF.',
      });
    }

    // De-duplicate + sort
    const seen = new Set();
    allQuestions = allQuestions
      .filter(q => { if (seen.has(q.question_number)) return false; seen.add(q.question_number); return true; })
      .sort((a, b) => (a.question_number || 0) - (b.question_number || 0));

    console.log(`Done: ${allQuestions.length} questions via ${method}`);
    res.json({
      questions: allQuestions,
      total: allQuestions.length,
      method,
      metadata: { exam, exam_year: Number(exam_year) || null, test_type, subject_id },
    });
  } catch (err) {
    console.error('Process error:', err);
    res.status(500).json({ error: 'Processing failed: ' + (err.message || String(err)) });
  }
});

// ── POST /api/admin/ai-upload/approve ────────────────────────────────────────
router.post('/approve', async (req, res) => {
  const { questions, metadata } = req.body;
  if (!Array.isArray(questions) || !questions.length)
    return res.status(400).json({ error: 'No approved questions provided' });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const marksEach = metadata.exam === 'TNPSC' ? 1 : 2;
    const negMarks  = metadata.exam === 'UPSC'  ? 0.66 : 0.33;

    const qIds = [];
    for (const q of questions) {
      const r = await client.query(`
        INSERT INTO question_bank
          (question_text, option_a, option_b, option_c, option_d, correct_answer,
           explanation, option_wise_explanation, subject_id, exam_type, exam_year,
           difficulty_level, question_type, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'single',$13) RETURNING id
      `, [
        q.question_text,
        q.option_a || null, q.option_b || null, q.option_c || null, q.option_d || null,
        q.correct_answer || null,
        q.explanation || null,
        q.option_wise_explanation ? JSON.stringify(q.option_wise_explanation) : null,
        metadata.subject_id || null,
        metadata.exam || null,
        metadata.exam_year ? Number(metadata.exam_year) : null,
        q.difficulty_level || 'medium',
        req.user.id,
      ]);
      qIds.push(r.rows[0].id);
    }

    const testTitle = metadata.test_type === 'pyq'
      ? `${metadata.exam} Prelims — ${metadata.exam_year}`
      : (metadata.title || `${metadata.exam} Mock Test`);

    const testRes = await client.query(`
      INSERT INTO tests
        (title, description, exam, test_type, exam_year, subject_id,
         duration, total_marks, negative_marks, num_questions, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11) RETURNING id
    `, [
      testTitle,
      `Extracted from uploaded ${metadata.exam} ${metadata.exam_year || ''} paper. ${questions.length} questions.`,
      metadata.exam || null,
      metadata.test_type || 'test_series',
      metadata.exam_year ? Number(metadata.exam_year) : null,
      metadata.subject_id || null,
      Math.max(60, Math.round(questions.length * 1.2)),
      questions.length * marksEach,
      negMarks,
      questions.length,
      req.user.id,
    ]);

    const testId = testRes.rows[0].id;
    for (let i = 0; i < qIds.length; i++) {
      await client.query(
        'INSERT INTO test_questions (test_id, question_id, marks, order_num) VALUES ($1,$2,$3,$4)',
        [testId, qIds[i], marksEach, i + 1],
      );
    }

    await client.query('COMMIT');
    res.json({ testId, questionCount: qIds.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Approve error:', err);
    res.status(500).json({ error: 'Failed to save: ' + err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
