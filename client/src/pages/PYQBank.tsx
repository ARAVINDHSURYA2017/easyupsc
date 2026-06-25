import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { testsApi } from '../api';

const EXAMS = ['UPSC', 'TNPSC'];

interface YearGroup {
  year: number | null;
  tests: any[];
  total_questions: number;
}

export default function PYQBank() {
  const [groups, setGroups] = useState<YearGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [exam, setExam] = useState<string>('UPSC');
  const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => { load(); }, [exam]);

  async function load() {
    setLoading(true);
    try {
      const res = await testsApi.pyq(exam);
      setGroups(res.data);
      setSelectedYears(new Set());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  function toggleYear(y: number) {
    setSelectedYears(prev => {
      const n = new Set(prev);
      n.has(y) ? n.delete(y) : n.add(y);
      return n;
    });
  }

  // Apply year + search filters
  const visibleGroups = useMemo(() => {
    return groups
      .filter(g => selectedYears.size === 0 || (g.year !== null && selectedYears.has(g.year)))
      .map(g => ({
        ...g,
        tests: g.tests.filter(t => !search || t.title.toLowerCase().includes(search.toLowerCase())),
      }))
      .filter(g => g.tests.length > 0);
  }, [groups, selectedYears, search]);

  const totalPapers = groups.reduce((s, g) => s + g.tests.length, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Previous Year Questions</h1>
        <p className="text-gray-500 mt-1">Browse actual exam papers organised year-wise</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── Sidebar filters ── */}
        <aside className="lg:w-64 shrink-0 space-y-6">
          {/* Exam */}
          <div className="card">
            <h2 className="font-semibold text-gray-800 text-sm mb-3">Exam</h2>
            <div className="space-y-2">
              {EXAMS.map(ex => (
                <label key={ex} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="radio" name="exam" checked={exam === ex}
                    onChange={() => setExam(ex)}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className={`text-sm ${exam === ex ? 'text-primary-700 font-semibold' : 'text-gray-600 group-hover:text-gray-900'}`}>{ex}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Year */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 text-sm">Year</h2>
              {selectedYears.size > 0 && (
                <button onClick={() => setSelectedYears(new Set())} className="text-xs text-primary-600 hover:underline">Clear</button>
              )}
            </div>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {groups.filter(g => g.year !== null).length === 0 ? (
                <p className="text-xs text-gray-400">No years available</p>
              ) : groups.filter(g => g.year !== null).map(g => (
                <label key={g.year} className="flex items-center gap-2.5 cursor-pointer group">
                  <input
                    type="checkbox" checked={selectedYears.has(g.year!)}
                    onChange={() => toggleYear(g.year!)}
                    className="w-4 h-4 rounded text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-600 group-hover:text-gray-900 flex-1">{g.year}</span>
                  <span className="text-xs text-gray-400">({g.tests.length})</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0">
          {/* Search */}
          <div className="mb-6">
            <input
              className="input" placeholder="Search papers by title…"
              value={search} onChange={e => setSearch(e.target.value)}
            />
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>
          ) : totalPapers === 0 ? (
            <div className="card text-center py-20 text-gray-400">
              <p className="text-5xl mb-4">📅</p>
              <p className="text-lg">No {exam} previous year papers available yet.</p>
            </div>
          ) : visibleGroups.length === 0 ? (
            <div className="card text-center py-16 text-gray-400">
              <p className="text-4xl mb-3">🔍</p>
              <p>No papers match your filters.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {visibleGroups.map(g => (
                <section key={g.year ?? 'undated'}>
                  {/* Year header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="bg-primary-600 text-white font-bold text-lg px-4 py-1.5 rounded-lg">
                      {g.year ?? 'Undated'}
                    </div>
                    <div className="h-px bg-gray-200 flex-1" />
                    <span className="text-xs text-gray-400">{g.tests.length} paper{g.tests.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Papers grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {g.tests.map((test: any) => (
                      <div key={test.id} className="card hover:shadow-md transition-shadow flex flex-col">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-semibold text-gray-900">{test.title}</h3>
                          <span className="badge-blue shrink-0">{test.exam} {test.exam_year}</span>
                        </div>
                        {test.subject_name && <p className="text-xs text-gray-400 mb-3">{test.subject_name}</p>}
                        {test.description && <p className="text-sm text-gray-500 mb-3 line-clamp-2">{test.description}</p>}

                        <div className="flex gap-4 text-xs text-gray-500 mb-4">
                          <span>❓ {test.question_count} questions</span>
                          <span>⏱️ {test.duration} min</span>
                          <span>🏅 {test.total_marks} marks</span>
                        </div>

                        <div className="mt-auto flex items-center justify-between gap-2">
                          {test.last_attempt ? (
                            <span className="text-xs text-gray-500">
                              Last: <span className={`font-semibold ${test.last_attempt.percentage >= 60 ? 'text-success-600' : 'text-danger-600'}`}>{test.last_attempt.percentage?.toFixed(1)}%</span>
                            </span>
                          ) : <span className="text-xs text-gray-400">{test.attempt_count > 0 ? `${test.attempt_count} attempts` : 'Not attempted'}</span>}
                          <Link to={`/tests/${test.id}/info`} className="btn-primary btn-sm">Attempt →</Link>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
