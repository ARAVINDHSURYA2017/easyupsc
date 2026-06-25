import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api';
import { Test } from '../../types';

export default function ManageTests() {
  const [tests, setTests] = useState<Test[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    adminApi.tests().then(r => setTests(r.data)).finally(() => setLoading(false));
  }

  async function toggleStatus(test: Test) {
    try {
      if (test.status === 'published') await adminApi.unpublishTest(test.id);
      else await adminApi.publishTest(test.id);
      load();
    } catch (e: any) {
      const msg = e.response?.data?.error || e.message || 'Request failed';
      alert('Error: ' + msg);
    }
  }

  async function deleteTest(id: number) {
    if (!confirm('Delete this test? All attempts will also be removed.')) return;
    await adminApi.deleteTest(id);
    load();
  }

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Tests</h1>
          <p className="text-gray-500 mt-1">{tests.length} tests total</p>
        </div>
        <Link to="/admin/tests/create" className="btn-primary">+ Create Test</Link>
      </div>

      {tests.length === 0 ? (
        <div className="card text-center py-16 text-gray-400">
          <p className="text-5xl mb-4">📋</p>
          <p>No tests yet. Create your first test!</p>
          <Link to="/admin/tests/create" className="btn-primary btn-sm mt-4 inline-flex">Create Test</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {tests.map(test => (
            <div key={test.id} className="card flex flex-col hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 flex-1 pr-2 truncate">{test.title}</h3>
                <span className={test.status === 'published' ? 'badge-green' : 'badge-gray'}>{test.status}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {test.exam && <span className="badge-blue text-xs">{test.exam}</span>}
                <span className={`badge text-xs ${test.test_type === 'pyq' ? 'badge-yellow' : 'badge-gray'}`}>
                  {test.test_type === 'pyq' ? `PYQ ${test.exam_year || ''}`.trim() : 'Test Series'}
                </span>
                {test.subject_name && <span className="badge-gray text-xs">{test.subject_name}</span>}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center mb-4">
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">Questions</p>
                  <p className="font-semibold text-sm">{test.question_count ?? 0}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">Duration</p>
                  <p className="font-semibold text-sm">{test.duration}m</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2">
                  <p className="text-xs text-gray-400">Attempts</p>
                  <p className="font-semibold text-sm">{test.attempt_count ?? 0}</p>
                </div>
              </div>
              <div className="mt-auto flex items-center gap-2 flex-wrap">
                <Link to={`/admin/tests/${test.id}/edit`} className="btn-secondary btn-sm flex-1 text-center">Edit</Link>
                <button onClick={() => toggleStatus(test)}
                  className={`btn-sm flex-1 btn ${test.status === 'published' ? 'bg-warning-50 text-warning-700 border border-warning-200 hover:bg-warning-100' : 'btn-success'}`}>
                  {test.status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
                <button onClick={() => deleteTest(test.id)} className="btn-danger btn-sm">🗑</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
