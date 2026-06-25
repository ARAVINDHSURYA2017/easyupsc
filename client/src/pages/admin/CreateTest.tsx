import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { adminApi } from '../../api';
import { Subject, Topic, Question } from '../../types';

export default function CreateTest() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [form, setForm] = useState({ title: '', description: '', category: '', exam: 'UPSC', test_type: 'test_series', exam_year: '', subject_id: '', topic_id: '', duration: 60, total_marks: 0, negative_marks: 0, num_questions: 0 });
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [allQuestions, setAllQuestions] = useState<Question[]>([]);
  const [testQuestions, setTestQuestions] = useState<Question[]>([]);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'details' | 'questions'>('details');
  const [qSearch, setQSearch] = useState('');
  const [qFilter, setQFilter] = useState('');
  const [testId, setTestId] = useState<number | null>(isEdit ? Number(id) : null);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    adminApi.subjects().then(r => setSubjects(r.data));
    loadAllQuestions();
    if (isEdit) loadTest();
  }, []);

  useEffect(() => {
    if (form.subject_id) adminApi.topics(Number(form.subject_id)).then(r => setTopics(r.data));
    else setTopics([]);
  }, [form.subject_id]);

  async function loadAllQuestions(page = 1) {
    const res = await adminApi.questions({ page, limit: 200, subject_id: qFilter || undefined, search: qSearch || undefined });
    setAllQuestions(res.data.questions);
  }

  async function loadTest() {
    const res = await adminApi.getTest(Number(id));
    const t = res.data;
    setForm({ title: t.title, description: t.description || '', category: t.category || '', exam: t.exam || 'UPSC', test_type: t.test_type || 'test_series', exam_year: t.exam_year?.toString() || '', subject_id: t.subject_id?.toString() || '', topic_id: t.topic_id?.toString() || '', duration: t.duration, total_marks: t.total_marks, negative_marks: t.negative_marks, num_questions: t.num_questions });
    setTestQuestions(t.questions || []);
    setLoading(false);
  }

  useEffect(() => { loadAllQuestions(); }, [qSearch, qFilter]);

  function setField(k: string, v: any) { setForm(f => ({ ...f, [k]: v })); }

  async function handleSaveDetails() {
    if (!form.title || !form.duration) return alert('Title and duration are required');
    if (form.test_type === 'pyq' && !form.exam_year) return alert('Exam year is required for a PYQ paper');
    setSaving(true);
    const payload = { ...form, exam_year: form.exam_year ? Number(form.exam_year) : null };
    try {
      if (isEdit && testId) {
        await adminApi.updateTest(testId, payload);
      } else {
        const res = await adminApi.createTest(payload);
        setTestId(res.data.id);
        navigate(`/admin/tests/${res.data.id}/edit`, { replace: true });
      }
      setTab('questions');
    } catch (e: any) { alert(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function addQuestion(q: Question) {
    if (!testId) return alert('Save test details first');
    if (testQuestions.find(tq => tq.id === q.id)) return;
    await adminApi.addQuestionsToTest(testId, [q.id], 1);
    setTestQuestions(qs => [...qs, q]);
  }

  async function removeQuestion(q: Question) {
    if (!testId) return;
    await adminApi.removeQuestionFromTest(testId, q.id);
    setTestQuestions(qs => qs.filter(tq => tq.id !== q.id));
  }

  const addedIds = new Set(testQuestions.map(q => q.id));
  const filteredAll = allQuestions.filter(q => !addedIds.has(q.id));

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Link to="/admin/tests" className="text-gray-400 hover:text-gray-600">← Tests</Link>
        <span className="text-gray-300">/</span>
        <h1 className="text-xl font-bold text-gray-900">{isEdit ? 'Edit Test' : 'Create New Test'}</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        <button onClick={() => setTab('details')} className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'details' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
          1. Test Details
        </button>
        <button onClick={() => setTab('questions')} disabled={!testId} className={`px-5 py-2.5 text-sm font-medium border-b-2 transition ${tab === 'questions' ? 'border-primary-500 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'} disabled:opacity-40`}>
          2. Questions {testId && <span className="ml-1.5 bg-primary-100 text-primary-700 text-xs px-1.5 py-0.5 rounded-full">{testQuestions.length}</span>}
        </button>
      </div>

      {tab === 'details' && (
        <div className="card max-w-2xl">
          <div className="space-y-4">
            {/* Content type */}
            <div>
              <label className="label">Content Type *</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { val: 'test_series', icon: '📚', title: 'Test Series', desc: 'Practice / mock test' },
                  { val: 'pyq', icon: '📅', title: 'Previous Year (PYQ)', desc: 'Actual exam paper by year' },
                ].map(opt => (
                  <button key={opt.val} type="button" onClick={() => setField('test_type', opt.val)}
                    className={`text-left p-3 rounded-xl border-2 transition ${form.test_type === opt.val ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-primary-300'}`}>
                    <div className="text-xl mb-1">{opt.icon}</div>
                    <p className="font-semibold text-sm text-gray-800">{opt.title}</p>
                    <p className="text-xs text-gray-400">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Exam + Year */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Exam *</label>
                <select className="input" value={form.exam} onChange={e => setField('exam', e.target.value)}>
                  <option value="UPSC">UPSC</option>
                  <option value="TNPSC">TNPSC</option>
                </select>
              </div>
              {form.test_type === 'pyq' && (
                <div>
                  <label className="label">Exam Year *</label>
                  <select className="input" value={form.exam_year} onChange={e => setField('exam_year', e.target.value)}>
                    <option value="">Select year</option>
                    {Array.from({ length: 16 }, (_, i) => 2026 - i).map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="label">{form.test_type === 'pyq' ? 'Paper Title *' : 'Test Series Title *'}</label>
              <input className="input" value={form.title} onChange={e => setField('title', e.target.value)}
                placeholder={form.test_type === 'pyq' ? 'e.g. UPSC Prelims GS Paper I — 2024' : 'e.g. UPSC GS Mock Test 1'} />
            </div>
            <div>
              <label className="label">Description</label>
              <textarea rows={2} className="input resize-none" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Optional test description…" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label">Category</label>
                <input className="input" value={form.category} onChange={e => setField('category', e.target.value)} placeholder="e.g. Engineering, Medical" />
              </div>
              <div>
                <label className="label">Subject</label>
                <select className="input" value={form.subject_id} onChange={e => { setField('subject_id', e.target.value); setField('topic_id', ''); }}>
                  <option value="">Select subject</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Topic</label>
                <select className="input" value={form.topic_id} onChange={e => setField('topic_id', e.target.value)} disabled={!form.subject_id}>
                  <option value="">Select topic</option>
                  {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Duration (minutes) *</label>
                <input type="number" min="1" className="input" value={form.duration} onChange={e => setField('duration', Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Total Marks</label>
                <input type="number" min="0" className="input" value={form.total_marks} onChange={e => setField('total_marks', Number(e.target.value))} />
              </div>
              <div>
                <label className="label">Negative Marks per Wrong Answer</label>
                <input type="number" min="0" step="0.25" className="input" value={form.negative_marks} onChange={e => setField('negative_marks', Number(e.target.value))} />
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={handleSaveDetails} disabled={saving} className="btn-primary btn-lg flex-1">
              {saving ? 'Saving…' : testId ? 'Update & Continue →' : 'Save & Add Questions →'}
            </button>
          </div>
        </div>
      )}

      {tab === 'questions' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Question bank */}
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">Question Bank</h2>
            <div className="flex gap-2 mb-3">
              <input className="input flex-1 text-sm" placeholder="Search…" value={qSearch} onChange={e => setQSearch(e.target.value)} />
              <select className="input w-36 text-sm" value={qFilter} onChange={e => setQFilter(e.target.value)}>
                <option value="">All subjects</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
              {filteredAll.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm">No questions available</div>
              ) : filteredAll.map(q => (
                <div key={q.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100 hover:border-primary-200 hover:bg-primary-50/30 transition">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{q.question_text}</p>
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {q.subject_name && <span className="badge-blue text-xs">{q.subject_name}</span>}
                      <span className={`badge text-xs ${q.difficulty_level === 'easy' ? 'badge-green' : q.difficulty_level === 'hard' ? 'badge-red' : 'badge-yellow'}`}>{q.difficulty_level}</span>
                    </div>
                  </div>
                  <button onClick={() => addQuestion(q)} className="btn-primary btn-sm text-xs shrink-0">+ Add</button>
                </div>
              ))}
            </div>
          </div>

          {/* Added questions */}
          <div>
            <h2 className="font-semibold text-gray-800 mb-3">Test Questions ({testQuestions.length})</h2>
            <div className="space-y-2 max-h-[65vh] overflow-y-auto pr-1">
              {testQuestions.length === 0 ? (
                <div className="text-center py-10 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">Add questions from the left panel</div>
              ) : testQuestions.map((q, i) => (
                <div key={q.id} className="flex items-start gap-3 p-3 bg-white rounded-xl border border-gray-100">
                  <span className="text-xs font-mono bg-primary-100 text-primary-600 px-2 py-1 rounded shrink-0">{i + 1}</span>
                  <p className="text-sm text-gray-800 flex-1 truncate">{q.question_text}</p>
                  <button onClick={() => removeQuestion(q)} className="text-gray-400 hover:text-danger-600 text-xs shrink-0">✕</button>
                </div>
              ))}
            </div>
            {testQuestions.length > 0 && (
              <div className="mt-4 flex gap-3">
                <Link to="/admin/tests" className="btn-secondary flex-1 text-center">Done</Link>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
