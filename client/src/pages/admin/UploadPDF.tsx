import { useState, useRef } from 'react';
import { adminApi } from '../../api';
import { Subject, Topic } from '../../types';
import { useEffect } from 'react';

export default function UploadPDF() {
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => { adminApi.subjects().then(r => setSubjects(r.data)); }, []);
  useEffect(() => {
    if (selectedSubject) adminApi.topics(Number(selectedSubject)).then(r => setTopics(r.data));
    else setTopics([]);
  }, [selectedSubject]);

  function handleFile(f: File) {
    if (f.type !== 'application/pdf') { alert('Please select a PDF file'); return; }
    setFile(f);
    setExtracted([]);
    setSaved(false);
  }

  async function handleExtract() {
    if (!file) return;
    setExtracting(true);
    try {
      const res = await adminApi.uploadPdf(file);
      setExtracted(res.data.questions || []);
      if ((res.data.questions || []).length === 0) alert('No questions could be extracted. Please check the PDF format.');
    } catch (e: any) {
      alert('Extraction failed: ' + (e.response?.data?.error || e.message));
    } finally { setExtracting(false); }
  }

  function updateQ(idx: number, field: string, value: string) {
    setExtracted(qs => qs.map((q, i) => i === idx ? { ...q, [field]: value } : q));
  }

  function removeQ(idx: number) { setExtracted(qs => qs.filter((_, i) => i !== idx)); }

  async function handleSave() {
    if (extracted.length === 0) return;
    setSaving(true);
    try {
      await adminApi.bulkImportQuestions({ questions: extracted, subject_id: selectedSubject || undefined, topic_id: selectedTopic || undefined });
      setSaved(true);
      setExtracted([]);
      setFile(null);
    } catch (e: any) { alert('Import failed: ' + (e.response?.data?.error || e.message)); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Upload PDF Question Paper</h1>
        <p className="text-gray-500 mt-1">Extract questions automatically from PDF files</p>
      </div>

      {saved && (
        <div className="bg-success-50 border border-success-200 text-success-700 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">✅</span>
          <div>
            <p className="font-semibold">Questions imported successfully!</p>
            <p className="text-sm">You can now add them to tests from the Question Bank.</p>
          </div>
        </div>
      )}

      {/* Upload area */}
      <div className="card mb-6">
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition ${dragOver ? 'border-primary-400 bg-primary-50' : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onClick={() => fileRef.current?.click()}
        >
          <input ref={fileRef} type="file" accept=".pdf" className="hidden" onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <div className="text-5xl mb-3">📄</div>
          {file ? (
            <div>
              <p className="font-semibold text-gray-900">{file.name}</p>
              <p className="text-sm text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          ) : (
            <div>
              <p className="font-medium text-gray-700">Drop your PDF here or click to browse</p>
              <p className="text-sm text-gray-400 mt-1">Supports question papers with numbered questions and A/B/C/D options</p>
            </div>
          )}
        </div>

        {file && (
          <div className="mt-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <label className="label">Assign Subject (optional)</label>
              <select className="input" value={selectedSubject} onChange={e => { setSelectedSubject(e.target.value); setSelectedTopic(''); }}>
                <option value="">None</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="flex-1">
              <label className="label">Assign Topic (optional)</label>
              <select className="input" value={selectedTopic} onChange={e => setSelectedTopic(e.target.value)} disabled={!selectedSubject}>
                <option value="">None</option>
                {topics.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div className="flex items-end">
              <button onClick={handleExtract} disabled={extracting} className="btn-primary btn-lg w-full sm:w-auto">
                {extracting ? '⏳ Extracting…' : '🔍 Extract Questions'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* PDF Format Guide */}
      {!file && (
        <div className="card bg-primary-50 border-primary-100">
          <h3 className="font-semibold text-primary-900 mb-3">📋 Supported PDF Format</h3>
          <pre className="text-xs text-primary-800 bg-white/60 p-3 rounded-lg overflow-x-auto">{`1. What is the capital of France?
A) London
B) Berlin
C) Paris
D) Madrid
Answer: C
Explanation: Paris is the capital of France.

2. Which planet is closest to the Sun?
A) Venus
B) Mercury
C) Earth
D) Mars
Answer: B`}</pre>
          <p className="text-xs text-primary-600 mt-2">Questions should be numbered (1., 2., etc.) with options labeled A) B) C) D)</p>
        </div>
      )}

      {/* Extracted questions */}
      {extracted.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">{extracted.length} Questions Extracted — Review & Edit</h2>
            <button onClick={handleSave} disabled={saving} className="btn-success btn-sm">
              {saving ? 'Importing…' : `✓ Import ${extracted.length} Questions`}
            </button>
          </div>
          <div className="space-y-4">
            {extracted.map((q, i) => (
              <div key={i} className="card border border-gray-200">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span className="badge-blue shrink-0">Q {i + 1}</span>
                  <button onClick={() => removeQ(i)} className="text-gray-400 hover:text-danger-600 text-sm">✕ Remove</button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="label">Question</label>
                    <textarea rows={2} className="input resize-none text-sm" value={q.question_text} onChange={e => updateQ(i, 'question_text', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {['A', 'B', 'C', 'D'].map(k => (
                      <div key={k}>
                        <label className="label">Option {k}</label>
                        <input className="input text-sm" value={q[`option_${k.toLowerCase()}`] || ''} onChange={e => updateQ(i, `option_${k.toLowerCase()}`, e.target.value)} />
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label">Correct Answer</label>
                      <select className="input text-sm" value={q.correct_answer} onChange={e => updateQ(i, 'correct_answer', e.target.value)}>
                        {['A', 'B', 'C', 'D'].map(k => <option key={k} value={k}>{k}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Difficulty</label>
                      <select className="input text-sm" value={q.difficulty_level} onChange={e => updateQ(i, 'difficulty_level', e.target.value)}>
                        {['easy', 'medium', 'hard'].map(d => <option key={d} value={d}>{d}</option>)}
                      </select>
                    </div>
                  </div>
                  {q.explanation && (
                    <div>
                      <label className="label">Explanation</label>
                      <input className="input text-sm" value={q.explanation} onChange={e => updateQ(i, 'explanation', e.target.value)} />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-end">
            <button onClick={handleSave} disabled={saving} className="btn-success btn-lg">
              {saving ? 'Importing…' : `✓ Import ${extracted.length} Questions to Bank`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
