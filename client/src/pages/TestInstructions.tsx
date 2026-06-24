import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { testsApi } from '../api';

export default function TestInstructions() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    testsApi.get(Number(testId))
      .then(r => setTest(r.data))
      .catch(() => navigate('/tests'))
      .finally(() => setLoading(false));
  }, [testId]);

  if (loading) return <div className="flex justify-center items-center min-h-[60vh]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;
  if (!test) return null;

  const rules = [
    'Read each question carefully before selecting your answer.',
    'You can navigate between questions using the question palette or Prev/Next buttons.',
    'Use "Mark for Review" to flag questions you want to revisit before submitting.',
    'Your answers are auto-saved every 30 seconds.',
    'The test will auto-submit when the timer reaches zero.',
    'Once submitted, you cannot change your answers.',
    test.negative_marks > 0 ? `Wrong answers carry a penalty of ${test.negative_marks} mark(s). Unattempted questions carry no penalty.` : 'There is no negative marking for wrong answers.',
  ];

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="card mb-6 bg-gradient-to-br from-primary-600 to-primary-800 text-white border-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-primary-200 text-sm font-medium mb-1">{test.category || 'General'} {test.subject_name ? `• ${test.subject_name}` : ''}</p>
            <h1 className="text-2xl font-bold mb-2">{test.title}</h1>
            {test.description && <p className="text-primary-100 text-sm leading-relaxed">{test.description}</p>}
          </div>
          <div className="text-5xl shrink-0">📋</div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { icon: '❓', label: 'Questions', value: test.question_count ?? test.num_questions },
          { icon: '⏱️', label: 'Duration', value: `${test.duration} min` },
          { icon: '🏅', label: 'Total Marks', value: test.total_marks },
          { icon: '⚠️', label: 'Negative', value: test.negative_marks > 0 ? `-${test.negative_marks}/wrong` : 'None' },
        ].map(s => (
          <div key={s.label} className="card text-center py-4">
            <div className="text-2xl mb-1">{s.icon}</div>
            <p className="text-xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Instructions */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold">i</span>
          Instructions
        </h2>
        <ul className="space-y-3">
          {rules.map((rule, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-gray-700">
              <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
              {rule}
            </li>
          ))}
        </ul>
      </div>

      {/* Legend */}
      <div className="card mb-8">
        <h2 className="font-semibold text-gray-800 mb-3">Question Status Legend</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          {[
            { color: 'bg-gray-200', label: 'Not Visited' },
            { color: 'bg-success-500', label: 'Answered' },
            { color: 'bg-danger-500', label: 'Not Answered' },
            { color: 'bg-warning-500', label: 'Marked for Review' },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`w-7 h-7 rounded-lg ${s.color} shrink-0`} />
              <span className="text-gray-600">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Previous attempt notice */}
      {test.last_attempt && (
        <div className="card mb-6 bg-amber-50 border-amber-200">
          <p className="text-sm text-amber-800">
            <strong>Previous attempt:</strong> You scored <strong>{test.last_attempt.percentage?.toFixed(1)}%</strong> on this test.
            {' '}<Link to={`/results/${test.last_attempt.id}`} className="text-primary-600 hover:underline font-medium">Review last attempt →</Link>
          </p>
        </div>
      )}

      <div className="flex gap-3">
        <Link to="/tests" className="btn-secondary flex-1 text-center">← Back to Tests</Link>
        <button
          onClick={() => navigate(`/test/${testId}`)}
          className="btn-primary flex-1 text-center font-semibold"
        >
          {test.last_attempt ? 'Retake Test →' : 'Start Test →'}
        </button>
      </div>
    </div>
  );
}
