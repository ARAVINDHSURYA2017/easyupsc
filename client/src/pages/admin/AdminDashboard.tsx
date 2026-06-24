import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { adminApi.stats().then(r => setStats(r.data)).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;

  const statCards = [
    { label: 'Total Students', value: stats.totalUsers, icon: '👥', color: 'bg-primary-100 text-primary-600' },
    { label: 'Total Tests', value: stats.totalTests, icon: '📋', color: 'bg-success-50 text-success-600' },
    { label: 'Attempts', value: stats.totalAttempts, icon: '✍️', color: 'bg-warning-50 text-warning-600' },
    { label: 'Avg Score', value: `${stats.avgScore}%`, icon: '📊', color: 'bg-purple-50 text-purple-600' },
    { label: 'Questions', value: stats.totalQuestions, icon: '❓', color: 'bg-pink-50 text-pink-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">Platform overview and analytics</p>
        </div>
        <div className="flex gap-3">
          <Link to="/admin/tests/create" className="btn-primary btn-sm">+ Create Test</Link>
          <Link to="/admin/upload" className="btn-secondary btn-sm">📄 Upload PDF</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
        {statCards.map(s => (
          <div key={s.label} className="card flex flex-col items-center text-center py-4">
            <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center text-2xl mb-2`}>{s.icon}</div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {stats.hardQuestions?.length > 0 && (
          <div className="card">
            <h2 className="font-semibold text-gray-800 mb-4">Most Difficult Questions</h2>
            <div className="space-y-3">
              {stats.hardQuestions.map((q: any) => {
                const wrongPct = q.attempts > 0 ? Math.round((q.wrong_count / q.attempts) * 100) : 0;
                return (
                  <div key={q.id} className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700 truncate">{q.question_text}</p>
                      <div className="h-1.5 rounded-full bg-gray-100 mt-1 overflow-hidden">
                        <div className="h-full bg-danger-500 rounded-full" style={{ width: `${wrongPct}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-medium text-danger-600 shrink-0">{wrongPct}% wrong</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {stats.userRankings?.length > 0 && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Top Students</h2>
              <Link to="/admin/users" className="text-xs text-primary-600 hover:underline">View all</Link>
            </div>
            <div className="space-y-2">
              {stats.userRankings.slice(0, 7).map((u: any, i: number) => (
                <div key={u.id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-warning-100 text-warning-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{u.name}</p>
                    <p className="text-xs text-gray-400">{u.attempts} attempts</p>
                  </div>
                  <span className={`text-sm font-semibold ${u.avg_score >= 60 ? 'text-success-600' : 'text-danger-600'}`}>{Number(u.avg_score).toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {stats.recentAttempts?.length > 0 && (
        <div className="card">
          <h2 className="font-semibold text-gray-800 mb-4">Recent Attempts</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-400 uppercase tracking-wider">
                  <th className="pb-3 pr-4">Student</th>
                  <th className="pb-3 pr-4">Test</th>
                  <th className="pb-3 pr-4">Score</th>
                  <th className="pb-3">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {stats.recentAttempts.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="py-2 pr-4 font-medium text-gray-800">{a.user_name}</td>
                    <td className="py-2 pr-4 text-gray-600 max-w-xs truncate">{a.test_title}</td>
                    <td className="py-2 pr-4">
                      <span className={`font-semibold ${a.percentage >= 60 ? 'text-success-600' : 'text-danger-600'}`}>{a.percentage?.toFixed(1)}%</span>
                    </td>
                    <td className="py-2 text-gray-400 text-xs">{new Date(a.end_time || a.start_time).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
