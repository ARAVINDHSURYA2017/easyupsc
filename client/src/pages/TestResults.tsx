import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { attemptsApi } from '../api';

export default function TestResults() {
  const { attemptId } = useParams<{ attemptId: string }>();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [filter, setFilter] = useState<'all' | 'correct' | 'wrong' | 'unattempted'>('all');
  const [openExplanations, setOpenExplanations] = useState<Set<number>>(new Set());

  function toggleExplanation(id: number) {
    setOpenExplanations(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  useEffect(() => {
    attemptsApi.results(Number(attemptId)).then(r => setData(r.data)).finally(() => setLoading(false));
  }, [attemptId]);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;
  if (!data) return <div className="text-center py-20 text-gray-500">Results not found.</div>;

  const { attempt, test, questions } = data;
  const filtered = questions.filter((q: any) => {
    if (filter === 'correct') return q.is_correct;
    if (filter === 'wrong') return q.selected_answer && !q.is_correct;
    if (filter === 'unattempted') return !q.selected_answer;
    return true;
  });

  const pct = attempt.percentage;
  const passed = pct >= 60;
  const duration = attempt.end_time && attempt.start_time
    ? Math.round((new Date(attempt.end_time).getTime() - new Date(attempt.start_time).getTime()) / 60000)
    : null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Result header */}
      <div className={`card mb-6 text-center ${passed ? 'bg-success-50 border-success-200' : 'bg-danger-50 border-red-200'}`}>
        <div className="text-5xl mb-3">{passed ? '🎉' : '😔'}</div>
        <h1 className="text-2xl font-bold text-gray-900">{passed ? 'Congratulations!' : 'Better luck next time!'}</h1>
        <p className="text-gray-500 mt-1 mb-6">{test.title}</p>
        <div className="text-5xl font-extrabold mb-2" style={{ color: passed ? '#16a34a' : '#dc2626' }}>{pct.toFixed(1)}%</div>
        <p className="text-gray-500 text-sm">Score: {attempt.score} / {test.total_marks}</p>
        {duration && <p className="text-gray-400 text-xs mt-1">Time taken: {duration} min</p>}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: attempt.total_questions, color: 'text-gray-800', bg: 'bg-gray-50' },
          { label: 'Correct', value: attempt.correct, color: 'text-success-600', bg: 'bg-success-50' },
          { label: 'Wrong', value: attempt.wrong, color: 'text-danger-600', bg: 'bg-danger-50' },
          { label: 'Skipped', value: attempt.unattempted, color: 'text-warning-600', bg: 'bg-warning-50' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 text-center`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="font-semibold text-gray-800">Question Review</h2>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'correct', 'wrong', 'unattempted'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`btn-sm btn capitalize ${filter === f ? 'btn-primary' : 'btn-secondary'}`}>
              {f} {f === 'all' ? `(${questions.length})` : f === 'correct' ? `(${attempt.correct})` : f === 'wrong' ? `(${attempt.wrong})` : `(${attempt.unattempted})`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        {(showAll ? filtered : filtered.slice(0, 10)).map((q: any, i: number) => {
          const unattempted = !q.selected_answer;
          const correct = q.is_correct;
          const opts = [
            { key: 'A', text: q.option_a }, { key: 'B', text: q.option_b },
            { key: 'C', text: q.option_c }, { key: 'D', text: q.option_d },
          ].filter(o => o.text);

          return (
            <div key={q.id} className={`card border-l-4 ${correct ? 'border-l-success-500' : unattempted ? 'border-l-gray-300' : 'border-l-danger-500'}`}>
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="font-medium text-gray-900 text-sm leading-relaxed">{i + 1}. {q.question_text}</p>
                <span className={`shrink-0 badge ${correct ? 'badge-green' : unattempted ? 'badge-gray' : 'badge-red'}`}>
                  {correct ? '✓ Correct' : unattempted ? '— Skipped' : '✗ Wrong'}
                </span>
              </div>
              {opts.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  {opts.map(opt => {
                    const isCorrect = opt.key === q.correct_answer;
                    const isSelected = opt.key === q.selected_answer;
                    return (
                      <div key={opt.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${isCorrect ? 'bg-success-50 text-success-800 font-medium' : isSelected && !isCorrect ? 'bg-danger-50 text-danger-700' : 'text-gray-600'}`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${isCorrect ? 'bg-success-500 text-white' : isSelected ? 'bg-danger-500 text-white' : 'bg-gray-100 text-gray-500'}`}>{opt.key}</span>
                        <span>{opt.text}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {q.explanation && (
                <div>
                  <button
                    onClick={() => toggleExplanation(q.id)}
                    className="text-primary-600 text-sm font-medium hover:underline mt-1"
                  >
                    {openExplanations.has(q.id) ? '▲ Hide Explanation' : '▼ View Explanation'}
                  </button>
                  {openExplanations.has(q.id) && (
                    <div className="mt-2 bg-primary-50 border border-primary-100 rounded-lg p-3 text-sm text-primary-800">
                      {q.explanation}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {!showAll && filtered.length > 10 && (
          <button onClick={() => setShowAll(true)} className="btn-secondary w-full">Show all {filtered.length} questions</button>
        )}
      </div>

      <div className="mt-8 flex gap-3 flex-wrap">
        <Link to="/tests" className="btn-primary">Browse More Tests</Link>
        <Link to="/dashboard" className="btn-secondary">Back to Dashboard</Link>
        <Link to="/history" className="btn-secondary">View History</Link>
      </div>
    </div>
  );
}
