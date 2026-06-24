import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { testsApi } from '../api';
import { Test } from '../types';

export default function AvailableTests() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => { load(); }, [search, category]);

  async function load() {
    setLoading(true);
    try {
      const res = await testsApi.list({ search: search || undefined, category: category || undefined });
      setTests(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  const categories = [...new Set(tests.map(t => t.category).filter(Boolean))];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Available Tests</h1>
        <p className="text-gray-500 mt-1">Choose a test and start practising</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <input
          className="input flex-1" placeholder="Search tests…"
          value={search} onChange={e => setSearch(e.target.value)}
        />
        <select className="input sm:w-48" value={category} onChange={e => setCategory(e.target.value)}>
          <option value="">All categories</option>
          {categories.map(c => <option key={c!} value={c!}>{c}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>
      ) : tests.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <p className="text-5xl mb-4">📭</p>
          <p className="text-lg">No tests available right now.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tests.map(test => (
            <div key={test.id} className="card hover:shadow-md transition-shadow flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{test.title}</h3>
                  {test.subject_name && <p className="text-xs text-gray-400 mt-0.5">{test.subject_name}</p>}
                </div>
                {test.category && <span className="badge-blue ml-2 shrink-0">{test.category}</span>}
              </div>
              {test.description && <p className="text-sm text-gray-500 mb-4 line-clamp-2">{test.description}</p>}
              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">Questions</p>
                  <p className="font-semibold text-sm">{test.question_count ?? test.num_questions}</p>
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
              <div className="mt-auto flex items-center justify-between">
                {test.last_attempt ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">Last: <span className={`font-semibold ${test.last_attempt.percentage >= 60 ? 'text-success-600' : 'text-danger-600'}`}>{test.last_attempt.percentage.toFixed(1)}%</span></span>
                    <Link to={`/results/${test.last_attempt.id}`} className="text-xs text-primary-600 hover:underline">View</Link>
                  </div>
                ) : <span />}
                <Link to={`/tests/${test.id}/info`} className="btn-primary btn-sm">
                  {test.last_attempt ? 'Retake' : 'Start Test'}
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
