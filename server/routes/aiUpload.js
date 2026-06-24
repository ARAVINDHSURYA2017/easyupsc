require('dotenv').config();
const express = require('express');
const multer  = require('multer');
const pdfParse = require('pdf-parse');
const Anthropic = require('@anthropic-ai/sdk');
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

// ── Text-based PDF parser (no API needed) ─────────────────────────────────────
function parseTextPDF(rawText) {
  // Normalise line endings and clean up header/footer noise
  const text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove page headers like "UPSC CSE PRELIMS-KEY & EXPLANATION 2020 2020"
    .replace(/UPSC CSE PRELIMS[\s\S]{0,60}?\d{4}\s*\n/gi, '')
    // Remove "IASBABA N" page footers
    .replace(/IASBABA\s+\d+\s*\n/gi, '')
    // Remove URL lines (REFERENCE links)
    .replace(/https?:\/\/\S+/g, '')
    .replace(/REFERENCE\s*:/gi, '')
    .replace(/Babapedia\s*:/gi, '')
    .replace(/IASbaba[^\n]*/gi, '')
    .trim();

  const questions = [];

  // Split on question boundaries Q.1) Q.2) ... or Q1. Q2.
  const qSplitRe = /(?=Q\.\s*\d+\))/gi;
  const blocks = text.split(qSplitRe).filter(b => /Q\.\s*\d+\)/i.test(b));

  for (const block of blocks) {
    try {
      // ── Question number ───────────────────────────────────────────────────
      const numMatch = block.match(/Q\.\s*(\d+)\)/i);
      if (!numMatch) continue;
      const question_number = parseInt(numMatch[1], 10);

      // ── Correct answer from Solution (x) ─────────────────────────────────
      const solMatch = block.match(/Solution\s*[:\-]?\s*\(([a-dA-D])\)/i);
      const correct_answer = solMatch ? solMatch[1].toUpperCase() : null;

      // ── Explanation text ──────────────────────────────────────────────────
      let explanation = '';
      const expMatch = block.match(/EXPLANATION\s*[:\-]?\s*([\s\S]*?)(?=REFERENCE\s*:|Q\.\s*\d+\)|$)/i);
      if (expMatch) {
        explanation = expMatch[1]
          .replace(/\n{3,}/g, '\n\n')
          .replace(/^\s+|\s+$/g, '')
          .trim();
        // Truncate very long explanations
        if (explanation.length > 2000) explanation = explanation.slice(0, 2000) + '…';
      }

      // ── Remove solution + explanation tail from the question block ────────
      const questionBody = block
        .replace(/Solution\s*[:\-]?\s*\([a-dA-D]\)[\s\S]*/i, '')
        .trim();

      // ── Options a) b) c) d) ───────────────────────────────────────────────
      // Match: a) ...text up to b)
      const optRe = /\b([a-d])\)\s*([\s\S]*?)(?=\b[a-d]\)|Solution|$)/gi;
      const opts = { a: '', b: '', c: '', d: '' };
      let optMatch;
      while ((optMatch = optRe.exec(questionBody)) !== null) {
        const key = optMatch[1].toLowerCase();
        if (opts.hasOwnProperty(key)) {
          opts[key] = optMatch[2].replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
        }
      }

      // ── Question text = everything between Q.N) and first a) ─────────────
      const firstOptIdx = questionBody.search(/\ba\)\s/i);
      let question_text = firstOptIdx > 0
        ? questionBody.slice(numMatch[0].length, firstOptIdx)
        : questionBody.slice(numMatch[0].length);
      question_text = question_text.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

      // Skip if question text is empty or too short
      if (!question_text || question_text.length < 10) continue;

      // ── Build option-wise explanation from explanation text ───────────────
      // Best effort: mark the correct option's explanation and note others
      const option_wise_explanation = { A: '', B: '', C: '', D: '' };
      if (correct_answer && explanation) {
        option_wise_explanation[correct_answer] = `Correct. ${explanation.slice(0, 300)}`;
        for (const k of ['A','B','C','D']) {
          if (k !== correct_answer) {
            option_wise_explanation[k] = `Incorrect. The correct answer is (${correct_answer}). ${explanation.slice(0, 150)}`;
          }
        }
      }

      questions.push({
        question_number,
        question_text,
        option_a: opts.a,
        option_b: opts.b,
        option_c: opts.c,
        option_d: opts.d,
        correct_answer,
        explanation,
        option_wise_explanation,
        topic: guessTopic(question_text),
        difficulty_level: guessdifficulty(question_text),
      });
    } catch (e) {
      console.warn(`Skipped block (parse error): ${e.message}`);
    }
  }

  return questions;
}

// Rough topic guesser based on keywords
function guessTopic(text) {
  const t = text.toLowerCase();
  if (/histor|mughal|british|maurya|gupta|ashoka|dynasty|medieval|ancient/i.test(t)) return 'History';
  if (/geograph|river|mountain|climate|rainfall|plateau|delta|bay|ocean/i.test(t)) return 'Geography';
  if (/constitu|article|amendment|parliament|supreme court|fundamental|directive|lok sabha|rajya/i.test(t)) return 'Polity & Governance';
  if (/econom|gdp|inflation|budget|fiscal|monetary|rbi|bank|trade|export|import/i.test(t)) return 'Economy';
  if (/science|technology|nano|robot|space|isro|nasa|satellite|nuclear|physics|chemistry|biology/i.test(t)) return 'Science & Technology';
  if (/environment|ecology|biodiversity|species|forest|climate change|carbon|pollution|wildlife/i.test(t)) return 'Environment & Ecology';
  if (/internation|united nations|un |who |wto |imf |world bank|treaty|agreement|summit/i.test(t)) return 'International Relations';
  if (/scheme|yojana|mission|programme|government|ministry|policy/i.test(t)) return 'Government Schemes';
  return 'General Studies';
}

function guessdifficulty(text) {
  const words = text.split(/\s+/).length;
  if (words < 30) return 'easy';
  if (words < 60) return 'medium';
  return 'hard';
}

// ── Claude API fallback for image-based PDFs ──────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MAX_CHUNK_MB = 28;

const CLAUDE_PROMPT = `You are processing a scanned exam question paper (UPSC/TNPSC Civil Services).

STRICT RULES:
1. Extract ONLY English text. Completely IGNORE all Hindi/Tamil text.
2. Extract every MCQ question with all 4 options (A, B, C, D).
3. Look for an answer key anywhere in the document — map correct answers if found.
4. For each question generate:
   - 2-4 sentence EXPLANATION of the correct answer.
   - OPTION-WISE explanation for each option (A/B/C/D): why correct or why wrong.
5. DIFFICULTY: "easy" | "medium" | "hard"
6. TOPIC: specific subject topic.

Return ONLY valid JSON, no markdown:
{
  "questions": [{
    "question_number": 1,
    "question_text": "...",
    "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...",
    "correct_answer": "A",
    "explanation": "...",
    "option_wise_explanation": {"A": "...", "B": "...", "C": "...", "D": "..."},
    "topic": "...",
    "difficulty_level": "easy|medium|hard"
  }]
}`;

async function splitPDFIntoChunks(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const bytesPerPage = pdfBuffer.length / totalPages;
  const pagesPerChunk = Math.max(1, Math.floor((MAX_CHUNK_MB * 1024 * 1024) / bytesPerPage));
  const chunks = [];
  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages);
    const chunk = await PDFDocument.create();
    const copied = await chunk.copyPages(pdfDoc, Array.from({ length: end - start }, (_, i) => start + i));
    copied.forEach(p => chunk.addPage(p));
    const bytes = await chunk.save();
    chunks.push({ buffer: Buffer.from(bytes), startPage: start + 1, endPage: end });
  }
  return chunks;
}

async function extractFromChunk(pdfBuffer, chunkInfo = '') {
  const base64 = pdfBuffer.toString('base64');
  console.log(`Claude API: ${chunkInfo}, ${(pdfBuffer.length / 1024 / 1024).toFixed(1)}MB`);
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    messages: [{ role: 'user', content: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
      { type: 'text', text: CLAUDE_PROMPT },
    ]}],
  });
  const text = response.content[0].text;
  const cleaned = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return [];
  const data = JSON.parse(match[0]);
  return Array.isArray(data.questions) ? data.questions : [];
}

// ── POST /api/admin/ai-upload/process ────────────────────────────────────────
router.post('/process', (req, res, next) => {
  upload.single('pdf')(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message || 'File upload error' });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'PDF file required' });

  const { exam, exam_year, test_type, subject_id } = req.body;

  try {
    const pdfBuffer = req.file.buffer;
    const sizeMB = pdfBuffer.length / 1024 / 1024;
    console.log(`Upload: ${req.file.originalname}, ${sizeMB.toFixed(1)}MB`);

    // ── Try text extraction first ─────────────────────────────────────────
    let allQuestions = [];
    let method = 'text';

    try {
      const parsed = await pdfParse(pdfBuffer);
      const textLength = (parsed.text || '').replace(/\s/g, '').length;
      console.log(`Text extracted: ${textLength} non-whitespace chars`);

      if (textLength > 500) {
        // Text-based PDF — parse with regex, no API needed
        console.log('Using text-based parser (no API)');
        allQuestions = parseTextPDF(parsed.text);
        console.log(`Text parser found ${allQuestions.length} questions`);
        method = 'text';
      }
    } catch (e) {
      console.warn('pdf-parse failed, falling back to Claude:', e.message);
    }

    // ── Fallback: Claude API for image/scanned PDFs ───────────────────────
    if (allQuestions.length === 0) {
      if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
        return res.status(500).json({ error: 'PDF has no extractable text and ANTHROPIC_API_KEY is not configured. Please use a text-based PDF or add the API key.' });
      }
      method = 'claude';
      console.log('Falling back to Claude API (image-based PDF)');

      if (sizeMB <= MAX_CHUNK_MB) {
        allQuestions = await extractFromChunk(pdfBuffer, 'full PDF');
      } else {
        const chunks = await splitPDFIntoChunks(pdfBuffer);
        for (const chunk of chunks) {
          const qs = await extractFromChunk(chunk.buffer, `pages ${chunk.startPage}-${chunk.endPage}`);
          allQuestions = allQuestions.concat(qs);
          await new Promise(r => setTimeout(r, 500));
        }
      }
    }

    // De-duplicate + sort
    const seen = new Set();
    allQuestions = allQuestions.filter(q => {
      if (seen.has(q.question_number)) return false;
      seen.add(q.question_number);
      return true;
    });
    allQuestions.sort((a, b) => (a.question_number || 0) - (b.question_number || 0));

    console.log(`Final: ${allQuestions.length} questions via ${method}`);
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
        q.correct_answer || 'A',
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
