import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { testsApi, attemptsApi } from '../api';
import { Test, Question, LocalResponse } from '../types';

type QuestionStatus = 'unattempted' | 'answered' | 'marked' | 'answered-marked';

export default function TakeTest() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();

  const [test, setTest] = useState<Test | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [attemptId, setAttemptId] = useState<number | null>(null);
  const [responses, setResponses] = useState<Map<number, LocalResponse>>(new Map());
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showPanel, setShowPanel] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const questionStartTime = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const autosaveRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    async function init() {
      try {
        const testRes = await testsApi.get(Number(testId));
        const t: Test = testRes.data;
        setTest(t);
        setQuestions(t.questions || []);
        setTimeLeft(t.duration * 60);

        const attemptRes = await attemptsApi.start(Number(testId));
        setAttemptId(attemptRes.data.id);
      } catch (e: any) {
        alert(e.response?.data?.error || 'Failed to load test');
        navigate('/tests');
      } finally { setLoading(false); }
    }
    init();
  }, [testId]);

  useEffect(() => {
    if (!attemptId || timeLeft <= 0) return;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) { clearInterval(timerRef.current); handleSubmit(true); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [attemptId]);

  useEffect(() => {
    if (!attemptId) return;
    autosaveRef.current = setInterval(() => {
      const batch = Array.from(responses.values());
      if (batch.length > 0) attemptsApi.autosave(attemptId, batch).catch(console.error);
    }, 30000);
    return () => clearInterval(autosaveRef.current);
  }, [attemptId, responses]);

  function getStatus(qId: number): QuestionStatus {
    const r = responses.get(qId);
    if (!r) return 'unattempted';
    const answered = !!r.selected_answer;
    const marked = r.marked_for_review;
    if (answered && marked) return 'answered-marked';
    if (marked) return 'marked';
    if (answered) return 'answered';
    return 'unattempted';
  }

  function selectAnswer(answer: string) {
    const q = questions[currentIdx];
    const prev = responses.get(q.id);
    const timeSpent = (prev?.time_spent ?? 0) + Math.round((Date.now() - questionStartTime.current) / 1000);
    const next: LocalResponse = { question_id: q.id, selected_answer: answer, time_spent: timeSpent, marked_for_review: prev?.marked_for_review ?? false };
    setResponses(m => new Map(m).set(q.id, next));
  }

  function toggleMark() {
    const q = questions[currentIdx];
    const prev = responses.get(q.id);
    const timeSpent = (prev?.time_spent ?? 0) + Math.round((Date.now() - questionStartTime.current) / 1000);
    const next: LocalResponse = { question_id: q.id, selected_answer: prev?.selected_answer ?? null, time_spent: timeSpent, marked_for_review: !(prev?.marked_for_review ?? false) };
    setResponses(m => new Map(m).set(q.id, next));
  }

  function clearAnswer() {
    const q = questions[currentIdx];
    const prev = responses.get(q.id);
    const timeSpent = (prev?.time_spent ?? 0) + Math.round((Date.now() - questionStartTime.current) / 1000);
    const next: LocalResponse = { question_id: q.id, selected_answer: null, time_spent: timeSpent, marked_for_review: prev?.marked_for_review ?? false };
    setResponses(m => new Map(m).set(q.id, next));
  }

  function navigate_(idx: number) {
    setShowExplanation(false);
    questionStartTime.current = Date.now();
    setCurrentIdx(idx);
    setShowPanel(false);
  }

  const handleSubmit = useCallback(async (auto = false) => {
    if (!attemptId) return;
    setSubmitting(true);
    clearInterval(timerRef.current);
    clearInterval(autosaveRef.current);
    try {
      const batch = Array.from(responses.values());
      await attemptsApi.submit(attemptId, batch);
      navigate(`/results/${attemptId}`, { replace: true });
    } catch (e: any) {
      alert('Submit failed: ' + (e.response?.data?.error || e.message));
      setSubmitting(false);
    }
  }, [attemptId, responses, navigate]);

  function formatTime(s: number) {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;
  if (!test || questions.length === 0) return <div className="text-center py-20 text-gray-500">Test not found or has no questions.</div>;

  const q = questions[currentIdx];
  const resp = responses.get(q.id);
  const opts: { key: string; text: string | undefined }[] = [
    { key: 'A', text: q.option_a }, { key: 'B', text: q.option_b },
    { key: 'C', text: q.option_c }, { key: 'D', text: q.option_d },
  ].filter(o => o.text);

  const answered = Array.from(responses.values()).filter(r => r.selected_answer).length;
  const marked = Array.from(responses.values()).filter(r => r.marked_for_review).length;
  const danger = timeLeft < 300;

  const statusColors: Record<QuestionStatus, string> = {
    unattempted: 'bg-gray-100 text-gray-600 border border-gray-200',
    answered: 'bg-success-500 text-white',
    marked: 'bg-warning-500 text-white',
    'answered-marked': 'bg-primary-500 text-white',
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <h1 className="font-semibold text-gray-900 text-sm sm:text-base truncate max-w-xs sm:max-w-md">{test.title}</h1>
            <p className="text-xs text-gray-400">{questions.length} Questions • {test.total_marks} Marks</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`font-mono font-bold text-lg px-4 py-1.5 rounded-lg ${danger ? 'bg-danger-50 text-danger-600 animate-pulse' : 'bg-gray-100 text-gray-800'}`}>
              ⏱ {formatTime(timeLeft)}
            </div>
            <button onClick={() => setShowPanel(!showPanel)} className="sm:hidden btn-secondary btn-sm">☰</button>
            <button onClick={() => setShowConfirm(true)} disabled={submitting} className="btn-primary btn-sm hidden sm:flex">
              {submitting ? 'Submitting…' : 'Submit Test'}
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex max-w-7xl mx-auto w-full px-4 py-6 gap-6">
        {/* Question area */}
        <div className="flex-1 min-w-0">
          <div className="card mb-4">
            <div className="flex items-center justify-between mb-4">
              <span className="badge-blue">Q {currentIdx + 1} of {questions.length}</span>
              <div className="flex gap-2">
                <span className={`badge ${resp?.marked_for_review ? 'badge-yellow' : 'badge-gray'}`}>
                  {resp?.marked_for_review ? '🔖 Marked' : 'Not marked'}
                </span>
                <span className="badge text-xs" style={{ background: '#f3f4f6', color: '#6b7280', padding: '2px 8px', borderRadius: '9999px' }}>
                  {q.difficulty_level}
                </span>
              </div>
            </div>
            <p className="text-gray-900 font-medium text-base leading-relaxed mb-6 whitespace-pre-wrap">{q.question_text}</p>

            {opts.length > 0 ? (
              <div className="space-y-3">
                {opts.map(opt => {
                  const selected = resp?.selected_answer === opt.key;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => selectAnswer(opt.key)}
                      className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${selected ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 bg-white hover:border-primary-300 hover:bg-primary-50/50 text-gray-700'}`}
                    >
                      <span className={`inline-flex items-center justify-center w-7 h-7 rounded-full mr-3 text-xs font-bold ${selected ? 'bg-primary-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{opt.key}</span>
                      {opt.text}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {['True', 'False'].map(v => (
                  <button key={v} onClick={() => selectAnswer(v)}
                    className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${resp?.selected_answer === v ? 'border-primary-500 bg-primary-50 text-primary-800' : 'border-gray-200 bg-white hover:border-primary-300 text-gray-700'}`}>
                    {v}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 justify-between items-center">
            <div className="flex gap-2">
              <button onClick={toggleMark} className={`btn-sm btn ${resp?.marked_for_review ? 'bg-warning-500 text-white hover:bg-warning-600' : 'btn-secondary'}`}>
                🔖 {resp?.marked_for_review ? 'Unmark' : 'Mark for Review'}
              </button>
              {(q.explanation || q.correct_answer) && (
                <button onClick={() => setShowExplanation(true)} className="btn-secondary btn-sm text-primary-600">
                  💡 Explanation
                </button>
              )}
              {resp?.selected_answer && (
                <button onClick={clearAnswer} className="btn-secondary btn-sm">✕ Clear</button>
              )}
            </div>
            <div className="flex gap-2">
              <button disabled={currentIdx === 0} onClick={() => navigate_(currentIdx - 1)} className="btn-secondary btn-sm">← Prev</button>
              {currentIdx < questions.length - 1
                ? <button onClick={() => navigate_(currentIdx + 1)} className="btn-primary btn-sm">Next →</button>
                : <button onClick={() => setShowConfirm(true)} className="btn-success btn-sm">Submit →</button>
              }
            </div>
          </div>
          <div className="sm:hidden mt-4">
            <button onClick={() => setShowConfirm(true)} disabled={submitting} className="btn-primary w-full">Submit Test</button>
          </div>
        </div>

        {/* Question panel */}
        <div className={`w-64 shrink-0 ${showPanel ? 'fixed inset-0 bg-black/40 z-40 flex justify-end' : 'hidden sm:block'}`}
          onClick={e => { if (e.target === e.currentTarget) setShowPanel(false); }}>
          <div className={`${showPanel ? 'w-72 h-full overflow-y-auto' : ''} space-y-4`}>
            <div className="card sticky top-20">
              <h3 className="font-semibold text-gray-800 mb-3 text-sm">Question Navigator</h3>
              <div className="grid grid-cols-5 gap-1.5 mb-4">
                {questions.map((qq, i) => {
                  const st = getStatus(qq.id);
                  return (
                    <button key={qq.id} onClick={() => navigate_(i)}
                      className={`w-9 h-9 rounded-lg text-xs font-semibold transition ${statusColors[st]} ${i === currentIdx ? 'ring-2 ring-primary-600 ring-offset-1' : ''}`}>
                      {i + 1}
                    </button>
                  );
                })}
              </div>
              <div className="space-y-1.5 text-xs">
                {[
                  { color: 'bg-success-500', label: `Answered (${answered})` },
                  { color: 'bg-gray-200', label: `Not answered (${questions.length - answered})` },
                  { color: 'bg-warning-500', label: `Marked for review (${marked})` },
                ].map(s => (
                  <div key={s.label} className="flex items-center gap-2">
                    <span className={`w-3 h-3 rounded-sm ${s.color}`} />
                    <span className="text-gray-600">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Explanation modal */}
      {showExplanation && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowExplanation(false)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-gray-900">Answer &amp; Explanation</h2>
              <button onClick={() => setShowExplanation(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
            </div>
            {q.correct_answer && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-sm font-medium text-gray-600">Correct Answer:</span>
                <span className="w-7 h-7 rounded-full bg-success-500 text-white flex items-center justify-center text-xs font-bold">{q.correct_answer}</span>
                <span className="text-sm text-success-700 font-medium">
                  {q[`option_${q.correct_answer.toLowerCase()}` as keyof Question] as string}
                </span>
              </div>
            )}
            {q.explanation ? (
              <div className="bg-primary-50 border border-primary-100 rounded-lg p-3 text-sm text-primary-800">
                {q.explanation}
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No explanation available for this question.</p>
            )}
          </div>
        </div>
      )}

      {/* Confirm submit modal */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Submit Test?</h2>
            <div className="space-y-1 text-sm text-gray-600 mb-6">
              <p>Answered: <strong className="text-success-600">{answered}</strong> / {questions.length}</p>
              <p>Unattempted: <strong className="text-danger-600">{questions.length - answered}</strong></p>
              <p>Marked for review: <strong className="text-warning-600">{marked}</strong></p>
              {timeLeft > 0 && <p className="text-gray-400">Time remaining: {formatTime(timeLeft)}</p>}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={() => handleSubmit(false)} disabled={submitting} className="btn-primary flex-1">
                {submitting ? 'Submitting…' : 'Confirm Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
