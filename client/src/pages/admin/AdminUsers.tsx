import { useEffect, useState } from 'react';
import { adminApi } from '../../api';

export default function AdminUsers() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { adminApi.users().then(r => setUsers(r.data)).finally(() => setLoading(false)); }, []);

  const filtered = users.filter(u => u.name.toLowerCase().includes(search.toLowerCase()) || u.email.toLowerCase().includes(search.toLowerCase()));

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-gray-500 mt-1">{users.length} registered students</p>
        </div>
      </div>
      <div className="mb-4">
        <input className="input max-w-sm" placeholder="Search by name or email…" value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <div className="card p-0 overflow-hidden">
        <table className="min-w-full divide-y divide-gray-100 text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left text-xs text-gray-500 uppercase tracking-wider">
              {['#', 'Name', 'Email', 'Mobile', 'Target Exam', 'Attempts', 'Avg Score', 'Joined'].map(h => (
                <th key={h} className="px-4 py-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((u, i) => (
              <tr key={u.id} className="hover:bg-gray-50 transition">
                <td className="px-4 py-3 text-gray-400">{i + 1}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{u.name}</td>
                <td className="px-4 py-3 text-gray-600">{u.email}</td>
                <td className="px-4 py-3 text-gray-500">{u.mobile || '—'}</td>
                <td className="px-4 py-3 text-gray-500">{u.target_exam || '—'}</td>
                <td className="px-4 py-3 text-center font-medium">{u.attempt_count ?? 0}</td>
                <td className="px-4 py-3">
                  {u.attempt_count > 0
                    ? <span className={`font-semibold ${Number(u.avg_score) >= 60 ? 'text-success-600' : 'text-danger-600'}`}>{Number(u.avg_score).toFixed(1)}%</span>
                    : <span className="text-gray-400">—</span>
                  }
                </td>
                <td className="px-4 py-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-12 text-gray-400">No users found.</div>}
      </div>
    </div>
  );
}
