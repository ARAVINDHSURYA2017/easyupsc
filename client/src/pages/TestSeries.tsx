import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { testsApi } from '../api';

const CATEGORY_ICONS: Record<string, string> = {
  'UPSC': '🏛️', 'SSC': '📝', 'Banking': '🏦', 'Railways': '🚂',
  'State PSC': '🏢', 'Engineering': '⚙️', 'Medical': '🏥', 'General': '📚',
  'Mathematics': '📐', 'Science': '🔬', 'History': '📜', 'Geography': '🌍',
  'English': '📖', 'Current Affairs': '📰', 'Computer': '💻', 'Other': '📋',
};

const CATEGORY_COLORS: Record<string, string> = {
  'UPSC': 'from-indigo-500 to-indigo-700',
  'SSC': 'from-blue-500 to-blue-700',
  'Banking': 'from-green-500 to-green-700',
  'Railways': 'from-orange-500 to-orange-700',
  'State PSC': 'from-purple-500 to-purple-700',
  'Engineering': 'from-cyan-500 to-cyan-700',
  'Medical': 'from-red-500 to-red-700',
  'General': 'from-gray-500 to-gray-700',
};

function getColor(cat: string) {
  return CATEGORY_COLORS[cat] || 'from-primary-500 to-primary-700';
}

const EXAMS = ['UPSC', 'TNPSC'];

export default function TestSeries() {
  const [series, setSeries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [exam, setExam] = useState('UPSC');

  useEffect(() => {
    setLoading(true);
    setSelected(null);
    testsApi.series(exam)
      .then(r => setSeries(r.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [exam]);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;

  const selectedSeries = series.find(s => s.category === selected);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Test Series</h1>
        <p className="text-gray-500 mt-1">Browse and attempt tests organised by exam category</p>
      </div>

      {/* Exam toggle */}
      <div className="inline-flex bg-gray-100 rounded-xl p-1 mb-8">
        {EXAMS.map(ex => (
          <button key={ex} onClick={() => setExam(ex)}
            className={`px-6 py-2 rounded-lg text-sm font-semibold transition ${exam === ex ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
            {ex}
          </button>
        ))}
      </div>

      {series.length === 0 ? (
        <div className="card text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-lg">No test series available yet.</p>
          <Link to="/tests" className="btn-primary btn-sm mt-4 inline-flex">Browse All Tests</Link>
        </div>
      ) : !selected ? (
        /* Series grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {series.map(s => (
            <button key={s.category} onClick={() => setSelected(s.category)}
              className="text-left rounded-2xl overflow-hidden shadow-sm hover:shadow-lg transition-all group border border-gray-100">
              <div className={`bg-gradient-to-br ${getColor(s.category)} p-6 text-white`}>
                <div className="text-4xl mb-3">{CATEGORY_ICONS[s.category] || '📚'}</div>
                <h2 className="text-xl font-bold">{s.category}</h2>
                <p className="text-white/70 text-sm mt-1">{s.tests.length} test{s.tests.length !== 1 ? 's' : ''} available</p>
              </div>
              <div className="bg-white p-4 flex items-center justify-between">
                <div className="flex gap-4 text-sm text-gray-500">
                  <span>❓ {s.total_questions} questions</span>
                  <span>⏱️ {s.total_duration} min total</span>
                </div>
                <span className="text-primary-600 text-sm font-semibold group-hover:translate-x-1 transition-transform">View →</span>
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Tests within selected series */
        <div>
          <button onClick={() => setSelected(null)} className="flex items-center gap-2 text-primary-600 hover:text-primary-700 font-medium text-sm mb-6">
            ← Back to Series
          </button>

          <div className={`bg-gradient-to-br ${getColor(selected)} rounded-2xl p-6 text-white mb-6`}>
            <div className="text-4xl mb-2">{CATEGORY_ICONS[selected] || '📚'}</div>
            <h2 className="text-2xl font-bold">{selected}</h2>
            <p className="text-white/70 mt-1">{selectedSeries.tests.length} tests • {selectedSeries.total_questions} total questions</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {selectedSeries.tests.map((test: any) => (
              <div key={test.id} className="card hover:shadow-md transition-shadow flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900">{test.title}</h3>
                    {test.subject_name && <p className="text-xs text-gray-400 mt-0.5">{test.subject_name}</p>}
                  </div>
                  {test.attempt_count > 0 && (
                    <span className="badge-blue ml-2 shrink-0">{test.attempt_count} attempts</span>
                  )}
                </div>

                {test.description && <p className="text-sm text-gray-500 mb-4 line-clamp-2">{test.description}</p>}

                <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-400">Questions</p>
                    <p className="font-semibold text-sm">{test.question_count}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-400">Duration</p>
                    <p className="font-semibold text-sm">{test.duration}m</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-400">Marks</p>
                    <p className="font-semibold text-sm">{test.total_marks}</p>
                  </div>
                </div>

                {test.negative_marks > 0 && (
                  <p className="text-xs text-danger-600 mb-3">⚠ Negative marking: -{test.negative_marks} per wrong</p>
                )}

                <div className="mt-auto">
                  <Link to={`/tests/${test.id}/info`} className="btn-primary w-full text-center">
                    View & Start Test
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
