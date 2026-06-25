import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { attemptsApi } from '../api';
import { Attempt } from '../types';

export default function History() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attemptsApi.history().then(r => setAttempts(r.data)).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Attempt History</h1>
      {attempts.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">📋</p>
          <p>You haven't attempted any tests yet.</p>
          <Link to="/tests" className="btn-primary btn-sm mt-4 inline-flex">Browse Tests</Link>
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Test', 'Date', 'Score', 'Correct', 'Wrong', 'Unattempted', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {attempts.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-sm text-gray-900">{a.test_title}</p>
                    <p className="text-xs text-gray-400">{a.category}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{new Date(a.start_time).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <span className={`font-semibold text-sm ${a.percentage >= 60 ? 'text-success-600' : 'text-danger-600'}`}>
                      {a.score} ({a.percentage.toFixed(1)}%)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-success-600 font-medium">{a.correct}</td>
                  <td className="px-4 py-3 text-sm text-danger-600 font-medium">{a.wrong}</td>
                  <td className="px-4 py-3 text-sm text-gray-400">{a.unattempted}</td>
                  <td className="px-4 py-3">
                    <span className={a.status === 'completed' ? 'badge-green' : 'badge-yellow'}>
                      {a.status === 'completed' ? 'Completed' : 'In Progress'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {a.status === 'completed'
                      ? <Link to={`/results/${a.id}`} className="btn-secondary btn-sm text-xs">Review</Link>
                      : <Link to={`/test/${a.test_id}`} className="btn-primary btn-sm text-xs">Resume</Link>
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
