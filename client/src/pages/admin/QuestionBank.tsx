import { useEffect, useState } from 'react';
import { adminApi } from '../../api';
import { Question, Subject, Topic } from '../../types';

const EMPTY_Q = { question_text: '', option_a: '', option_b: '', option_c: '', option_d: '', correct_answer: 'A', explanation: '', subject_id: '', topic_id: '', difficulty_level: 'medium', question_type: 'single' };

export default function QuestionBank() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [filter, setFilter] = useState({ subject_id: '', topic_id: '', search: '' });
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<null | 'create' | 'edit'>(null);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<any>(EMPTY_Q);
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [page, filter]);
  useEffect(() => { adminApi.subjects().then(r => setSubjects(r.data)); }, []);
  useEffect(() => {
    if (form.subject_id) adminApi.topics(Number(form.subject_id)).then(r => setTopics(r.data));
    else setTopics([]);
  }, [form.subject_id]);

  async function load() {
    setLoading(true);
    const params: any = { page, limit: 15 };
    if (filter.subject_id) params.subject_id = filter.subject_id;
    if (filter.topic_id) params.topic_id = filter.topic_id;
    if (filter.search) params.search = filter.search;
    const res = await adminApi.questions(params);
    setQuestions(res.data.questions);
    setTotal(res.data.total);
    setPages(res.data.pages);
    setLoading(false);
  }

  function openCreate() { setForm(EMPTY_Q); setEditing(null); setModal('create'); }
  function openEdit(q: any) { setForm({ ...q, subject_id: q.subject_id || '', topic_id: q.topic_id || '' }); setEditing(q); setModal('edit'); }
  function setField(k: string, v: any) { setForm((f: any) => ({ ...f, [k]: v })); }

  async function handleSave() {
    if (!form.question_text || !form.correct_answer) return alert('Question text and correct answer required');
    setSaving(true);
    try {
      if (modal === 'edit') await adminApi.updateQuestion(editing.id, form);
      else await adminApi.createQuestion(form);
      setModal(null);
      load();
    } catch (e: any) { alert(e.response?.data?.error || 'Save failed'); }
    finally { setSaving(false); }
  }

  async function deleteQ(id: number) {
    if (!confirm('Delete this question?')) return;
    await adminApi.deleteQuestion(id);
    load();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Question Bank</h1>
          <p className="text-gray-500 mt-1">{total} questions total</p>
        </div>
        <button onClick={openCreate} className="btn-primary">+ Add Question</button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <input className="input w-56" placeholder="Search questions…" value={filter.search}
          onChange={e => { setFilter(f => ({ ...f, search: e.target.value })); setPage(1); }} />
        <select className="input w-44" value={filter.subject_id} onChange={e => { setFilter(f => ({ ...f, subject_id: e.target.value, topic_id: '' })); setPage(1); }}>
          <option value="">All subjects</option>
          {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>
      ) : questions.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">❓</p>
          <p>No questions found. Add questions or upload a PDF.</p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {questions.map((q, i) => (
              <div key={q.id} className="card hover:shadow-md transition-shadow">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono bg-gray-100 text-gray-500 px-2 py-1 rounded mt-0.5 shrink-0">#{q.id}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 text-sm mb-2">{q.question_text}</p>
                    {[q.option_a, q.option_b, q.option_c, q.option_d].filter(Boolean).length > 0 && (
                      <div className="grid grid-cols-2 gap-1 mb-2">
                        {(['A', 'B', 'C', 'D'] as const).map((k, ki) => {
                          const t = [q.option_a, q.option_b, q.option_c, q.option_d][ki];
                          if (!t) return null;
                          const correct = q.correct_answer === k;
                          return <p key={k} className={`text-xs px-2 py-1 rounded ${correct ? 'bg-success-50 text-success-700 font-semibold' : 'text-gray-500 bg-gray-50'}`}>{k}) {t}</p>;
                        })}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {q.subject_name && <span className="badge-blue">{q.subject_name}</span>}
                      {q.topic_name && <span className="badge-gray">{q.topic_name}</span>}
                      <span className={`badge ${q.difficulty_level === 'easy' ? 'badge-green' : q.difficulty_level === 'hard' ? 'badge-red' : 'badge-yellow'}`}>{q.difficulty_level}</span>
                      <span className="badge-gray">Ans: {q.correct_answer}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={() => openEdit(q)} className="btn-secondary btn-sm text-xs">Edit</button>
                    <button onClick={() => deleteQ(q.id)} className="btn-danger btn-sm text-xs">🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {/* Pagination */}
          {pages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="btn-secondary btn-sm">← Prev</button>
              <span className="btn-sm btn border border-gray-200 bg-white text-gray-600">Page {page} of {pages}</span>
              <button disabled={page === pages} onClick={() => setPage(p => p + 1)} className="btn-secondary btn-sm">Next →</button>
            </div>
          )}
        </>
      )}

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl my-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{modal === 'create' ? 'Add Question' : 'Edit Question'}</h2>
              <button onClick={() => setModal(null)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Question Text *</label>
                <textarea rows={3} className="input resize-none" value={form.question_text} onChange={e => setField('question_text', e.target.value)} placeholder="Enter question…" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                {['A', 'B', 'C', 'D'].map(k => (
                  <div key={k}>
                    <label className="label">Option {k}</label>
                    <input className="input" value={form[`option_${k.toLowerCase()}`]} onChange={e => setField(`option_${k.toLowerCase()}`, e.target.value)} placeholder={`Option ${k}`} />
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Correct Answer *</label>
                  <select className="input" value={form.correct_answer} onChange={e => setField('correct_answer', e.target.value)}>
                    {['A', 'B', 'C', 'D'].map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Difficulty</label>
                  <select className="input" value={form.difficulty_level} onChange={e => setField('difficulty_level', e.target.value)}>
                    {['easy', 'medium', 'hard'].map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Subject</label>
                  <select className="input" value={form.subject_id} onChange={e => setField('subject_id', e.target.value)}>
                    <option value="">Select subject</option>
                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Topic</label>
                  <select className="input" value={form.topic_id} onChange={e => setField('topic_id', e.target.value)}>
                    <option value="">Select topic</option>
                    {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Explanation (optional)</label>
                <textarea rows={2} className="input resize-none" value={form.explanation} onChange={e => setField('explanation', e.target.value)} placeholder="Explanation for the correct answer…" />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0 border-t border-gray-100">
              <button onClick={() => setModal(null)} className="btn-secondary flex-1">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save Question'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
