require('dotenv').config();
const express  = require('express');
const multer   = require('multer');
const pdfParse = require('pdf-parse');
const mammoth  = require('mammoth');
const { PDFDocument } = require('pdf-lib');
const Anthropic = require('@anthropic-ai/sdk');
const { pool } = require('../database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(authenticateToken, requireAdmin);

// Accept PDF and DOCX
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(pdf|docx|doc)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF or DOCX files are allowed'));
    }
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// UNIFIED TEXT PARSER — works for both PDF and DOCX extracted text
// Supports two common formats:
//   Format A (IASbaba PDFs):  Q.1) ... a) ... Solution (d) ... EXPLANATION: ...
//   Format B (DOCX / clean):  Q1.  ... (a) ... Answer: (d)   ... Explanation: ...
// ─────────────────────────────────────────────────────────────────────────────
function parseQuestions(rawText) {
  const text = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove common PDF header/footer noise
    .replace(/UPSC CSE PRELIMS[\s\S]{0,80}?\d{4}\s*\n/gi, '')
    .replace(/IASBABA\s*\d*\s*\n/gi, '')
    .replace(/https?:\/\/\S+/g, '')
    .replace(/REFERENCE\s*:/gi, '')
    .replace(/Babapedia\s*:/gi, '')
    .replace(/IASbaba[^\n]*/gi, '')
    .trim();

  // Detect format: Q1. style vs Q.1) style
  const isFormatB = /^Q\d+\./m.test(text);
  const splitRe   = isFormatB ? /(?=^Q\d+\.)/gm : /(?=Q\.\s*\d+\))/gi;

  const blocks = text.split(splitRe).filter(b =>
    isFormatB ? /^Q\d+\./i.test(b.trim()) : /Q\.\s*\d+\)/i.test(b)
  );

  console.log(`Detected format: ${isFormatB ? 'B (Q1. style)' : 'A (Q.1) style)'}, blocks: ${blocks.length}`);

  const questions = [];

  for (const block of blocks) {
    try {
      const q = isFormatB ? parseFormatB(block) : parseFormatA(block);
      if (q) questions.push(q);
    } catch (e) {
      console.warn('Block parse error:', e.message);
    }
  }

  return questions;
}

// ── Format A: Q.1) ... a) ... Solution (d) ... EXPLANATION: ... ──────────────
function parseFormatA(block) {
  const numMatch = block.match(/Q\.\s*(\d+)\)/i);
  if (!numMatch) return null;
  const question_number = parseInt(numMatch[1], 10);

  const solMatch = block.match(/Solution\s*[:\-]?\s*\(([a-dA-D])\)/i);
  const correct_answer = solMatch ? solMatch[1].toUpperCase() : null;

  let explanation = '';
  const expMatch = block.match(/EXPLANATION\s*[:\-]?\s*([\s\S]*?)(?=REFERENCE\s*:|Q\.\s*\d+\)|$)/i);
  if (expMatch) {
    explanation = expMatch[1].replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);
  }

  const questionBody = block.replace(/Solution\s*[:\-]?\s*\([a-dA-D]\)[\s\S]*/i, '').trim();

  const opts = extractOptions(questionBody, /\b([a-d])\)\s*/gi);
  const firstOptIdx = questionBody.search(/\ba\)\s/i);
  let question_text = (firstOptIdx > 0
    ? questionBody.slice(numMatch[0].length, firstOptIdx)
    : questionBody.slice(numMatch[0].length)
  ).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  if (!question_text || question_text.length < 10) return null;

  return buildQuestion(question_number, question_text, opts, correct_answer, explanation);
}

// ── Format B: Q1. ... (a) ... Answer: (d) ... Explanation: ... ───────────────
function parseFormatB(block) {
  const numMatch = block.match(/^Q(\d+)\./im);
  if (!numMatch) return null;
  const question_number = parseInt(numMatch[1], 10);

  // Answer: (d) or Answer: d
  const ansMatch = block.match(/Answer\s*:\s*\(?([a-dA-D])\)?/i);
  const correct_answer = ansMatch ? ansMatch[1].toUpperCase() : null;

  // Explanation text
  let explanation = '';
  const expMatch = block.match(/Explanation\s*:\s*([\s\S]*?)(?=Q\d+\.|$)/i);
  if (expMatch) {
    explanation = expMatch[1].replace(/\n{3,}/g, '\n\n').trim().slice(0, 2000);
  }

  // Strip Answer + Explanation tail
  const questionBody = block
    .replace(/Answer\s*:[\s\S]*/i, '')
    .trim();

  // Options: (a) text  (b) text  (c) text  (d) text
  const opts = extractOptions(questionBody, /\(([a-d])\)\s*/gi);

  // Question text = everything before first (a)
  const firstOptIdx = questionBody.search(/\(a\)\s/i);
  let question_text = (firstOptIdx > 0
    ? questionBody.slice(numMatch[0].length, firstOptIdx)
    : questionBody.slice(numMatch[0].length)
  ).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();

  if (!question_text || question_text.length < 10) return null;

  return buildQuestion(question_number, question_text, opts, correct_answer, explanation);
}

// ── Extract a/b/c/d options using the given regex ─────────────────────────────
function extractOptions(text, optRe) {
  const opts = { a: '', b: '', c: '', d: '' };
  let m;
  const matches = [];
  const re = new RegExp(optRe.source, optRe.flags);
  while ((m = re.exec(text)) !== null) {
    matches.push({ key: m[1].toLowerCase(), index: m.index, end: m.index + m[0].length });
  }
  for (let i = 0; i < matches.length; i++) {
    const { key, end } = matches[i];
    const nextStart = matches[i + 1]?.index ?? text.length;
    if (opts.hasOwnProperty(key)) {
      opts[key] = text.slice(end, nextStart).replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
    }
  }
  return opts;
}

// ── Build final question object ───────────────────────────────────────────────
function buildQuestion(question_number, question_text, opts, correct_answer, explanation) {
  const option_wise_explanation = { A: '', B: '', C: '', D: '' };
  if (correct_answer && explanation) {
    option_wise_explanation[correct_answer] = `Correct. ${explanation.slice(0, 400)}`;
    for (const k of ['A', 'B', 'C', 'D']) {
      if (k !== correct_answer) {
        option_wise_explanation[k] = `Incorrect. The correct answer is (${correct_answer}). ${explanation.slice(0, 200)}`;
      }
    }
  }

  return {
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
    difficulty_level: guessDifficulty(question_text),
  };
}

function guessTopic(text) {
  if (/histor|mughal|british|maurya|gupta|ashoka|dynasty|medieval|ancient|colonial/i.test(text)) return 'History';
  if (/geograph|river|mountain|climate|rainfall|plateau|delta|bay|ocean|latitude|longitude/i.test(text)) return 'Geography';
  if (/constitu|article|amendment|parliament|supreme court|fundamental|directive|lok sabha|rajya|judiciary/i.test(text)) return 'Polity & Governance';
  if (/econom|gdp|inflation|budget|fiscal|monetary|rbi|bank|trade|export|import|market/i.test(text)) return 'Economy';
  if (/science|technology|nano|robot|space|isro|nasa|satellite|nuclear|physics|chemistry|biology|dna|gene/i.test(text)) return 'Science & Technology';
  if (/environment|ecology|biodiversity|species|forest|climate change|carbon|pollution|wildlife|tiger|sanctuary/i.test(text)) return 'Environment & Ecology';
  if (/internation|united nations|\bun\b|\bwho\b|\bwto\b|\bimf\b|world bank|treaty|agreement|summit|foreign/i.test(text)) return 'International Relations';
  if (/scheme|yojana|mission|programme|government|ministry|policy|welfare/i.test(text)) return 'Government Schemes';
  if (/art|culture|music|dance|painting|sculpture|architecture|temple|festival/i.test(text)) return 'Art & Culture';
  return 'General Studies';
}

function guessDifficulty(text) {
  const words = text.split(/\s+/).length;
  if (words < 25) return 'easy';
  if (words < 55) return 'medium';
  return 'hard';
}

// ─────────────────────────────────────────────────────────────────────────────
// Claude API fallback for image-based PDFs only
// ─────────────────────────────────────────────────────────────────────────────
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MAX_CHUNK_MB = 28;

const CLAUDE_PROMPT = `Extract all MCQ questions from this scanned exam paper (UPSC/TNPSC).
RULES: Extract ONLY English text. Ignore Hindi/Tamil.
Return ONLY valid JSON:
{"questions":[{"question_number":1,"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_answer":"A","explanation":"...","option_wise_explanation":{"A":"...","B":"...","C":"...","D":"..."},"topic":"...","difficulty_level":"easy|medium|hard"}]}`;

async function splitAndExtractWithClaude(pdfBuffer) {
  const pdfDoc = await PDFDocument.load(pdfBuffer, { ignoreEncryption: true });
  const totalPages = pdfDoc.getPageCount();
  const pagesPerChunk = Math.max(1, Math.floor((MAX_CHUNK_MB * 1024 * 1024) / (pdfBuffer.length / totalPages)));
  let all = [];
  for (let start = 0; start < totalPages; start += pagesPerChunk) {
    const end = Math.min(start + pagesPerChunk, totalPages);
    const chunk = await PDFDocument.create();
    const copied = await chunk.copyPages(pdfDoc, Array.from({ length: end - start }, (_, i) => start + i));
    copied.forEach(p => chunk.addPage(p));
    const bytes = Buffer.from(await chunk.save());
    const resp = await anthropic.messages.create({
      model: 'claude-opus-4-8', max_tokens: 16000,
      messages: [{ role: 'user', content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: bytes.toString('base64') } },
        { type: 'text', text: CLAUDE_PROMPT },
      ]}],
    });
    const cleaned = resp.content[0].text.replace(/^```json\s*/i,'').replace(/\s*```$/i,'').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      const data = JSON.parse(match[0]);
      all = all.concat(data.questions || []);
    }
    await new Promise(r => setTimeout(r, 500));
  }
  return all;
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/ai-upload/process
// ─────────────────────────────────────────────────────────────────────────────
router.post('/process', (req, res, next) => {
  upload.single('pdf')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message || 'File upload error' });
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'PDF or DOCX file required' });

  const { exam, exam_year, test_type, subject_id } = req.body;
  const fileName = req.file.originalname.toLowerCase();
  const isDocx   = fileName.endsWith('.docx') || fileName.endsWith('.doc');

  try {
    const buffer = req.file.buffer;
    console.log(`Upload: ${req.file.originalname}, ${(buffer.length/1024/1024).toFixed(1)}MB`);

    let allQuestions = [];
    let method = 'text';

    if (isDocx) {
      // ── DOCX: extract text with mammoth ─────────────────────────────────
      console.log('Processing DOCX with mammoth');
      const result = await mammoth.extractRawText({ buffer });
      const text = result.value || '';
      console.log(`DOCX text extracted: ${text.replace(/\s/g,'').length} chars`);
      allQuestions = parseQuestions(text);
      method = 'docx-text';

    } else {
      // ── PDF: try text extraction first ──────────────────────────────────
      try {
        const parsed = await pdfParse(buffer);
        const textLen = (parsed.text || '').replace(/\s/g,'').length;
        console.log(`PDF text: ${textLen} chars`);

        if (textLen > 500) {
          allQuestions = parseQuestions(parsed.text);
          method = 'pdf-text';
        }
      } catch (e) {
        console.warn('pdf-parse failed:', e.message);
      }

      // ── Fallback: Claude vision API for scanned/image PDFs ──────────────
      if (allQuestions.length === 0) {
        if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'your_api_key_here') {
          return res.status(500).json({ error: 'This PDF has no extractable text (scanned image). Please provide a text-based PDF or DOCX file.' });
        }
        console.log('Falling back to Claude vision API');
        allQuestions = await splitAndExtractWithClaude(buffer);
        method = 'claude-vision';
      }
    }

    // De-duplicate + sort
    const seen = new Set();
    allQuestions = allQuestions
      .filter(q => { if (seen.has(q.question_number)) return false; seen.add(q.question_number); return true; })
      .sort((a, b) => (a.question_number || 0) - (b.question_number || 0));

    console.log(`Done: ${allQuestions.length} questions via [${method}]`);
    res.json({ questions: allQuestions, total: allQuestions.length, method,
      metadata: { exam, exam_year: Number(exam_year) || null, test_type, subject_id } });

  } catch (err) {
    console.error('Process error:', err);
    res.status(500).json({ error: 'Processing failed: ' + (err.message || String(err)) });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/admin/ai-upload/approve
// ─────────────────────────────────────────────────────────────────────────────
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
      INSERT INTO tests (title, description, exam, test_type, exam_year, subject_id,
        duration, total_marks, negative_marks, num_questions, status, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11) RETURNING id
    `, [
      testTitle,
      `Extracted from ${metadata.exam} ${metadata.exam_year || ''} paper. ${questions.length} questions.`,
      metadata.exam || null, metadata.test_type || 'test_series',
      metadata.exam_year ? Number(metadata.exam_year) : null,
      metadata.subject_id || null,
      Math.max(60, Math.round(questions.length * 1.2)),
      questions.length * marksEach, negMarks, questions.length, req.user.id,
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
