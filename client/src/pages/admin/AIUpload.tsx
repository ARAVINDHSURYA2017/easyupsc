import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { adminApi } from '../../api';

const EXAMS = ['UPSC', 'TNPSC'];
const YEARS = Array.from({ length: 16 }, (_, i) => 2026 - i);
const DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

type Difficulty = typeof DIFFICULTIES[number];

interface AIQuestion {
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_answer: string | null;
  explanation: string;
  option_wise_explanation: { A: string; B: string; C: string; D: string };
  topic: string;
  difficulty_level: Difficulty;
  status: 'pending' | 'approved' | 'rejected';
}

type Step = 'metadata' | 'upload' | 'review' | 'done';

const STEP_LABELS = ['Metadata', 'Upload & Extract', 'Review', 'Done'];

export default function AIUpload() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  // Step
  const [step, setStep] = useState<Step>('metadata');

  // Metadata form
  const [meta, setMeta] = useState({ exam: 'UPSC', exam_year: '2026', test_type: 'pyq', subject_id: '', title: '' });
  const [subjects, setSubjects] = useState<any[]>([]);

  // Upload / processing
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [processingMsg, setProcessingMsg] = useState('');
  const [uploadError, setUploadError] = useState('');

  // Review
  const [questions, setQuestions] = useState<AIQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  // Done
  const [doneTestId, setDoneTestId] = useState<number | null>(null);

  useEffect(() => {
    adminApi.subjects().then(r => setSubjects(r.data)).catch(() => {});
  }, []);

  // ── Metadata step ─────────────────────────────────────────────────────────────
  function handleMetaNext() {
    if (!meta.exam_year) { alert('Please select an exam year'); return; }
    setStep('upload');
  }

  // ── Upload step ───────────────────────────────────────────────────────────────
  const isValidFile = (file: File) =>
    file.type === 'application/pdf' ||
    file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    file.name.match(/\.(pdf|docx|doc)$/i);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && isValidFile(file)) setPdfFile(file);
  }, []);

  async function handleProcess() {
    if (!pdfFile) { setUploadError('Please select a PDF file'); return; }
    setUploadError('');
    setProcessing(true);
    setProcessingMsg('Uploading PDF to server…');

    const form = new FormData();
    form.append('pdf', pdfFile);
    form.append('exam', meta.exam);
    form.append('exam_year', meta.exam_year);
    form.append('test_type', meta.test_type);
    form.append('subject_id', meta.subject_id);

    try {
      setProcessingMsg('Sending to Claude AI for extraction… (this may take 30-90 seconds)');
      const baseUrl = (import.meta.env.VITE_API_URL || '/api').replace(/\/api$/, '');
      const res = await fetch(`${baseUrl}/api/admin/ai-upload/process`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: form,
      });

      // Guard against HTML error pages (e.g. 413, nginx errors, crashes)
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        const text = await res.text();
        const hint = res.status === 413 ? 'File too large — check server upload limits.'
          : res.status === 401 ? 'Session expired — please log in again.'
          : res.status === 404 ? 'API route not found — is the backend running?'
          : `Server error ${res.status}`;
        throw new Error(hint + (text ? '\n' + text.slice(0, 200) : ''));
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Processing failed');

      const qs: AIQuestion[] = (data.questions || []).map((q: any) => ({
        ...q,
        option_a: q.option_a || '',
        option_b: q.option_b || '',
        option_c: q.option_c || '',
        option_d: q.option_d || '',
        option_wise_explanation: q.option_wise_explanation || { A: '', B: '', C: '', D: '' },
        difficulty_level: q.difficulty_level || 'medium',
        topic: q.topic || '',
        status: 'pending',
      }));

      if (!qs.length) {
        setUploadError('AI could not extract questions from this PDF. Please ensure it is a readable question paper.');
        setProcessing(false);
        return;
      }

      setQuestions(qs);
      setCurrentIdx(0);
      setStep('review');
    } catch (err: any) {
      setUploadError(err.message);
    } finally {
      setProcessing(false);
    }
  }

  // ── Review helpers ────────────────────────────────────────────────────────────
  function updateQuestion(idx: number, patch: Partial<AIQuestion>) {
    setQuestions(qs => qs.map((q, i) => i === idx ? { ...q, ...patch } : q));
  }

  function updateOwExplanation(idx: number, key: 'A' | 'B' | 'C' | 'D', val: string) {
    setQuestions(qs => qs.map((q, i) => i === idx ? {
      ...q,
      option_wise_explanation: { ...q.option_wise_explanation, [key]: val },
    } : q));
  }

  function setStatus(idx: number, status: 'approved' | 'rejected' | 'pending') {
    updateQuestion(idx, { status });
    if (status !== 'pending' && idx < questions.length - 1) setCurrentIdx(idx + 1);
  }

  function approveAll() {
    setQuestions(qs => qs.map(q => ({ ...q, status: 'approved' })));
  }

  const approved = questions.filter(q => q.status === 'approved').length;
  const rejected = questions.filter(q => q.status === 'rejected').length;
  const pending  = questions.filter(q => q.status === 'pending').length;

  async function handlePublish(publish: boolean) {
    const toSave = questions.filter(q => q.status === 'approved');
    if (!toSave.length) { alert('Approve at least one question first'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/ai-upload/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ questions: toSave, metadata: { ...meta, subject_id: meta.subject_id || null } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');

      // Publish if requested
      if (publish && data.testId) {
        await fetch(`/api/admin/tests/${data.testId}/publish`, {
          method: 'PUT',
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
      }
      setDoneTestId(data.testId);
      setStep('done');
    } catch (err: any) {
      alert('Failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const q = questions[currentIdx];

  const statusColor = (s: AIQuestion['status']) =>
    s === 'approved' ? 'bg-success-500 text-white' :
    s === 'rejected' ? 'bg-danger-500 text-white' :
    'bg-gray-200 text-gray-600';

  const stepIndex = { metadata: 0, upload: 1, review: 2, done: 3 }[step];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/tests" className="text-gray-400 hover:text-gray-600">← Tests</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">AI-Powered PDF Upload</h1>
        <span className="badge-blue ml-auto">✨ Claude AI</span>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${i < stepIndex ? 'bg-success-500 text-white' : i === stepIndex ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
              {i < stepIndex ? '✓' : i + 1}
            </div>
            <span className={`text-sm font-medium hidden sm:block ${i === stepIndex ? 'text-primary-700' : 'text-gray-400'}`}>{label}</span>
            {i < STEP_LABELS.length - 1 && <div className="w-8 h-px bg-gray-200 hidden sm:block" />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: Metadata ───────────────────────────────────────────────────── */}
      {step === 'metadata' && (
        <div className="card max-w-xl">
          <h2 className="text-lg font-semibold text-gray-800 mb-1">Paper Details</h2>
          <p className="text-gray-500 text-sm mb-6">Tell us about the question paper before uploading.</p>

          <div className="space-y-5">
            {/* Content type */}
            <div>
              <label className="label">Paper Type *</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: 'pyq', icon: '📅', title: 'Previous Year Paper (PYQ)', desc: 'Actual exam paper' },
                  { val: 'test_series', icon: '📚', title: 'Test Series / Mock', desc: 'Practice paper' },
                ].map(opt => (
                  <button key={opt.val} type="button" onClick={() => setMeta(m => ({ ...m, test_type: opt.val }))}
                    className={`text-left p-3 rounded-xl border-2 transition ${meta.test_type === opt.val ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}>
                    <div className="text-xl mb-1">{opt.icon}</div>
                    <p className="font-semibold text-sm text-gray-800">{opt.title}</p>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Exam */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Exam *</label>
                <div className="flex gap-2">
                  {EXAMS.map(ex => (
                    <button key={ex} type="button" onClick={() => setMeta(m => ({ ...m, exam: ex }))}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border-2 transition ${meta.exam === ex ? 'border-primary-500 bg-primary-600 text-white' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Exam Year *</label>
                <select className="input" value={meta.exam_year} onChange={e => setMeta(m => ({ ...m, exam_year: e.target.value }))}>
                  <option value="">Select year</option>
                  {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            {/* Subject */}
            <div>
              <label className="label">Subject <span className="text-gray-400 font-normal">(optional)</span></label>
              <select className="input" value={meta.subject_id} onChange={e => setMeta(m => ({ ...m, subject_id: e.target.value }))}>
                <option value="">Auto-detect from AI</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            {meta.test_type === 'test_series' && (
              <div>
                <label className="label">Test Series Title *</label>
                <input className="input" value={meta.title} onChange={e => setMeta(m => ({ ...m, title: e.target.value }))} placeholder={`e.g. ${meta.exam} GS Mock Test 1`} />
              </div>
            )}

            <button onClick={handleMetaNext} className="btn-primary w-full">Continue to Upload →</button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Upload ─────────────────────────────────────────────────────── */}
      {step === 'upload' && (
        <div className="max-w-xl">
          {/* Meta summary */}
          <div className="card mb-5 bg-primary-50 border-primary-100 flex items-center gap-4">
            <div className="text-3xl">{meta.test_type === 'pyq' ? '📅' : '📚'}</div>
            <div>
              <p className="font-semibold text-primary-900">{meta.exam} — {meta.exam_year}</p>
              <p className="text-sm text-primary-600">{meta.test_type === 'pyq' ? 'Previous Year Paper' : 'Test Series'}</p>
            </div>
            <button onClick={() => setStep('metadata')} className="ml-auto text-xs text-primary-600 hover:underline">Edit</button>
          </div>

          {!processing ? (
            <>
              {/* Drop zone */}
              <div
                onDrop={onDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition
                  ${pdfFile ? 'border-success-500 bg-success-50' : 'border-gray-300 bg-gray-50 hover:border-primary-400 hover:bg-primary-50'}`}
              >
                <input ref={fileRef} type="file" accept=".pdf,.docx,.doc" className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f && isValidFile(f)) setPdfFile(f); }} />
                {pdfFile ? (
                  <>
                    <div className="text-4xl mb-3">✅</div>
                    <p className="font-semibold text-success-700">{pdfFile.name}</p>
                    <p className="text-sm text-success-600 mt-1">{(pdfFile.size / 1024 / 1024).toFixed(1)} MB — Ready to process</p>
                    <button className="text-xs text-gray-500 mt-2 hover:underline" onClick={e => { e.stopPropagation(); setPdfFile(null); }}>Remove</button>
                  </>
                ) : (
                  <>
                    <div className="text-5xl mb-4">📄</div>
                    <p className="font-semibold text-gray-700">Drop PDF or DOCX here or click to browse</p>
                    <p className="text-sm text-gray-400 mt-1">Supports .pdf, .docx — text extracted automatically, no API needed</p>
                  </>
                )}
              </div>

              {uploadError && (
                <div className="mt-4 p-4 bg-danger-50 border border-red-200 rounded-xl text-sm text-danger-700">
                  ❌ {uploadError}
                </div>
              )}

              <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                <strong>⚠️ Note:</strong> AI extraction requires an Anthropic API key configured in <code>server/.env</code>.
                Large PDFs ({">"} 28 MB) will be split and processed in batches. Processing takes 30–120 seconds.
              </div>

              <div className="flex gap-3 mt-5">
                <button onClick={() => setStep('metadata')} className="btn-secondary flex-1">← Back</button>
                <button onClick={handleProcess} disabled={!pdfFile} className="btn-primary flex-1 disabled:opacity-50">
                  🤖 Extract with AI →
                </button>
              </div>
            </>
          ) : (
            <div className="card text-center py-16">
              <div className="w-16 h-16 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin mx-auto mb-6" />
              <h3 className="text-lg font-semibold text-gray-800 mb-2">AI Processing…</h3>
              <p className="text-gray-500 text-sm max-w-xs mx-auto">{processingMsg}</p>
              <div className="mt-6 space-y-2 text-xs text-gray-400">
                <p>📄 Extracting questions from PDF</p>
                <p>🧠 Generating explanations with Claude AI</p>
                <p>✅ Validating answers and difficulty levels</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 3: Review ─────────────────────────────────────────────────────── */}
      {step === 'review' && q && (
        <div className="flex gap-4 h-[calc(100vh-220px)] min-h-[600px]">
          {/* Question list sidebar */}
          <aside className="w-52 shrink-0 flex flex-col">
            <div className="card mb-2 p-3 text-xs space-y-1.5">
              <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold">{questions.length}</span></div>
              <div className="flex justify-between"><span className="text-success-600">✓ Approved</span><span className="font-bold text-success-600">{approved}</span></div>
              <div className="flex justify-between"><span className="text-danger-600">✗ Rejected</span><span className="font-bold text-danger-600">{rejected}</span></div>
              <div className="flex justify-between"><span className="text-gray-400">⏳ Pending</span><span className="font-bold text-gray-500">{pending}</span></div>
            </div>
            <button onClick={approveAll} className="btn-success btn-sm mb-2 text-xs">✓ Approve All</button>
            <div className="flex-1 overflow-y-auto space-y-1 pr-1">
              {questions.map((qq, i) => (
                <button key={i} onClick={() => setCurrentIdx(i)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium flex items-center gap-2 transition
                    ${i === currentIdx ? 'bg-primary-100 text-primary-700 ring-1 ring-primary-300' : 'hover:bg-gray-100'}`}>
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-xs shrink-0 ${statusColor(qq.status)}`}>
                    {qq.status === 'approved' ? '✓' : qq.status === 'rejected' ? '✗' : i + 1}
                  </span>
                  <span className="truncate">Q{qq.question_number || i + 1}</span>
                </button>
              ))}
            </div>
          </aside>

          {/* Question editor */}
          <div className="flex-1 min-w-0 overflow-y-auto space-y-4">
            {/* Header bar */}
            <div className="card p-3 flex items-center justify-between flex-wrap gap-2 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <span className="badge-blue text-xs">Q {q.question_number || currentIdx + 1} of {questions.length}</span>
                <span className="text-xs text-gray-400">{meta.exam} {meta.exam_year}</span>
              </div>
              <div className="flex gap-2">
                <button disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)} className="btn-secondary btn-sm text-xs">← Prev</button>
                <button disabled={currentIdx === questions.length - 1} onClick={() => setCurrentIdx(i => i + 1)} className="btn-secondary btn-sm text-xs">Next →</button>
              </div>
            </div>

            {/* Question text */}
            <div className="card">
              <label className="label">Question Text</label>
              <textarea rows={3} className="input resize-none text-sm"
                value={q.question_text}
                onChange={e => updateQuestion(currentIdx, { question_text: e.target.value })} />
            </div>

            {/* Options */}
            <div className="card">
              <label className="label mb-3">Options & Correct Answer</label>
              <div className="space-y-2">
                {(['A', 'B', 'C', 'D'] as const).map(key => {
                  const field = `option_${key.toLowerCase()}` as keyof AIQuestion;
                  const isCorrect = q.correct_answer === key;
                  return (
                    <div key={key} className={`flex items-center gap-2 p-2 rounded-lg border-2 transition ${isCorrect ? 'border-success-400 bg-success-50' : 'border-gray-100'}`}>
                      <button
                        onClick={() => updateQuestion(currentIdx, { correct_answer: key })}
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${isCorrect ? 'bg-success-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-primary-100 hover:text-primary-700'}`}
                        title="Set as correct answer"
                      >
                        {key}
                      </button>
                      <input className="flex-1 text-sm bg-transparent outline-none border-0 focus:ring-0"
                        value={q[field] as string || ''}
                        onChange={e => updateQuestion(currentIdx, { [field]: e.target.value } as any)} />
                      {isCorrect && <span className="text-xs text-success-600 font-semibold shrink-0">✓ Correct</span>}
                    </div>
                  );
                })}
              </div>
              {!q.correct_answer && (
                <p className="text-xs text-amber-600 mt-2">⚠ Answer not found in PDF — click an option button above to set it.</p>
              )}
            </div>

            {/* Metadata */}
            <div className="card grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <label className="label">Difficulty</label>
                <select className="input text-sm" value={q.difficulty_level}
                  onChange={e => updateQuestion(currentIdx, { difficulty_level: e.target.value as Difficulty })}>
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="label">Topic</label>
                <input className="input text-sm" value={q.topic}
                  onChange={e => updateQuestion(currentIdx, { topic: e.target.value })}
                  placeholder="e.g. Indian History – Mughal Period" />
              </div>
            </div>

            {/* Explanation */}
            <div className="card">
              <label className="label">AI Explanation</label>
              <textarea rows={3} className="input resize-none text-sm"
                value={q.explanation}
                onChange={e => updateQuestion(currentIdx, { explanation: e.target.value })} />
            </div>

            {/* Option-wise explanations */}
            <div className="card">
              <label className="label mb-3">Option-wise Explanations</label>
              <div className="space-y-3">
                {(['A', 'B', 'C', 'D'] as const).map(key => {
                  const isCorrect = q.correct_answer === key;
                  return (
                    <div key={key}>
                      <label className="text-xs font-semibold mb-1 flex items-center gap-2">
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${isCorrect ? 'bg-success-500 text-white' : 'bg-gray-200 text-gray-600'}`}>{key}</span>
                        {isCorrect ? 'Why correct' : 'Why incorrect'}
                      </label>
                      <textarea rows={2} className="input resize-none text-sm"
                        value={q.option_wise_explanation?.[key] || ''}
                        onChange={e => updateOwExplanation(currentIdx, key, e.target.value)} />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Approve / Reject */}
            <div className="card flex gap-3 sticky bottom-0 bg-white border-t border-gray-100">
              <button onClick={() => setStatus(currentIdx, 'rejected')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${q.status === 'rejected' ? 'bg-danger-500 text-white border-danger-500' : 'border-danger-300 text-danger-600 hover:bg-danger-50'}`}>
                ✗ Reject
              </button>
              <button onClick={() => setStatus(currentIdx, 'pending')}
                className="px-4 py-2.5 rounded-xl text-sm font-medium border-2 border-gray-200 text-gray-500 hover:bg-gray-50 transition">
                ⏭ Skip
              </button>
              <button onClick={() => setStatus(currentIdx, 'approved')}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition ${q.status === 'approved' ? 'bg-success-500 text-white border-success-500' : 'border-success-400 text-success-600 hover:bg-success-50'}`}>
                ✓ Approve
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Review footer: submit bar */}
      {step === 'review' && (
        <div className="mt-4 card flex items-center justify-between gap-4 flex-wrap">
          <div className="text-sm text-gray-600">
            <strong className="text-success-600">{approved} approved</strong> out of {questions.length} questions ready to import.
          </div>
          <div className="flex gap-3">
            <button onClick={() => handlePublish(false)} disabled={saving || approved === 0}
              className="btn-secondary disabled:opacity-50">
              {saving ? 'Saving…' : 'Save as Draft'}
            </button>
            <button onClick={() => handlePublish(true)} disabled={saving || approved === 0}
              className="btn-primary disabled:opacity-50">
              {saving ? 'Publishing…' : `🚀 Publish ${approved} Questions`}
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Done ───────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="card max-w-lg mx-auto text-center py-12">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Questions Imported!</h2>
          <p className="text-gray-500 mb-2">{approved} AI-extracted questions have been saved to the question bank.</p>
          <p className="text-gray-400 text-sm mb-8">
            {meta.exam} {meta.exam_year} — {meta.test_type === 'pyq' ? 'Previous Year Paper' : 'Test Series'}
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            {doneTestId && (
              <Link to={`/admin/tests/${doneTestId}/edit`} className="btn-primary">View Test →</Link>
            )}
            <Link to="/admin/questions" className="btn-secondary">Question Bank</Link>
            <button onClick={() => { setStep('metadata'); setQuestions([]); setPdfFile(null); setUploadError(''); }}
              className="btn-secondary">Upload Another</button>
          </div>
        </div>
      )}
    </div>
  );
}
