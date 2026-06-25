import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { attemptsApi } from '../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function StudentDashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    attemptsApi.stats().then(r => setStats(r.data)).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Welcome, {user?.name}! 👋</h1>
        <p className="text-gray-500 mt-1">Here's your performance overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
        <div className="stat-card">
          <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center text-primary-600 text-2xl">📝</div>
          <div>
            <p className="text-sm text-gray-500">Tests Attempted</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.totalAttempts ?? 0}</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="w-12 h-12 bg-success-50 rounded-xl flex items-center justify-center text-success-600 text-2xl">📊</div>
          <div>
            <p className="text-sm text-gray-500">Average Score</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.avgScore ?? 0}%</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="w-12 h-12 bg-warning-50 rounded-xl flex items-center justify-center text-warning-600 text-2xl">🏆</div>
          <div>
            <p className="text-sm text-gray-500">Best Score</p>
            <p className="text-2xl font-bold text-gray-900">{stats?.bestScore ?? 0}%</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {stats?.subjectPerf?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Subject-wise Performance</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.subjectPerf} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="subject" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(v: any) => `${Number(v).toFixed(1)}%`} />
                <Bar dataKey="avg_score" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Avg Score" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Recent Attempts</h2>
            <Link to="/history" className="text-sm text-primary-600 hover:underline">View all</Link>
          </div>
          {stats?.recentAttempts?.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <p className="text-4xl mb-2">📋</p>
              <p>No tests attempted yet.</p>
              <Link to="/tests" className="btn-primary btn-sm mt-3 inline-flex">Browse Tests</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {stats.recentAttempts.map((a: any) => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 hover:bg-gray-100 transition">
                  <div>
                    <p className="font-medium text-sm text-gray-800">{a.test_title}</p>
                    <p className="text-xs text-gray-400">{a.category} • {new Date(a.end_time || a.start_time).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-bold ${a.percentage >= 60 ? 'text-success-600' : 'text-danger-600'}`}>{a.percentage.toFixed(1)}%</span>
                    <Link to={`/results/${a.id}`} className="btn-secondary btn-sm text-xs">Review</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 card bg-primary-50 border-primary-100">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-primary-900">Ready to practice?</h2>
            <p className="text-primary-600 text-sm mt-1">Explore available tests and start your exam preparation.</p>
          </div>
          <Link to="/tests" className="btn-primary">Browse Tests →</Link>
        </div>
      </div>
    </div>
  );
}
