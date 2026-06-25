import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';

const EXAM_CATEGORIES = [
  { icon: '🏛️', name: 'UPSC', desc: 'Civil Services, IFS, CDS & more' },
  { icon: '📝', name: 'SSC', desc: 'CGL, CHSL, MTS, GD & more' },
  { icon: '🏦', name: 'Banking', desc: 'IBPS, SBI PO/Clerk, RRB' },
  { icon: '🚂', name: 'Railways', desc: 'RRB NTPC, Group D, ALP' },
  { icon: '⚙️', name: 'Engineering', desc: 'JEE, GATE, ESE & more' },
  { icon: '🏥', name: 'Medical', desc: 'NEET, AIIMS, JIPMER' },
];

const HOW_IT_WORKS = [
  { step: '01', icon: '📝', title: 'Register Free', desc: 'Create your account in under a minute — no credit card required.' },
  { step: '02', icon: '🎯', title: 'Pick a Test Series', desc: 'Browse tests organised by exam category and subject.' },
  { step: '03', icon: '⏱️', title: 'Attempt the Test', desc: 'Take timed MCQ tests with live countdown and auto-save.' },
  { step: '04', icon: '📊', title: 'Review & Improve', desc: 'Get instant results with detailed explanation for every question.' },
];

const FEATURES = [
  { icon: '⏱️', title: 'Timed Tests', desc: 'Real-time countdown with auto-submit when time expires.' },
  { icon: '💾', title: 'Auto-Save', desc: 'Responses saved every 30 seconds — never lose your progress.' },
  { icon: '🔖', title: 'Mark for Review', desc: 'Flag uncertain questions and revisit them before submitting.' },
  { icon: '📊', title: 'Instant Results', desc: 'Score, rank, and full explanation immediately after submission.' },
  { icon: '📈', title: 'Progress Tracking', desc: 'Track your improvement across subjects over time.' },
  { icon: '📋', title: 'PDF Extraction', desc: 'Admin can upload past papers and auto-generate question banks.' },
];

export default function Landing() {
  const { user } = useAuth();
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Public Navbar */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl font-bold text-primary-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
            TestPro
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm text-gray-600 hover:text-primary-600 font-medium px-3 py-1.5">Sign In</Link>
            <Link to="/register" className="btn-primary btn-sm">Get Started Free</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-900 text-white py-24 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(circle at 30% 50%, white 1px, transparent 1px), radial-gradient(circle at 70% 80%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }} />
        <div className="max-w-3xl mx-auto relative">
          <span className="inline-block bg-white/20 text-white text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            🎯 India's Smart Exam Preparation Platform
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-5 leading-tight tracking-tight">
            Crack Your Dream Exam<br />
            <span className="text-primary-200">with Confidence</span>
          </h1>
          <p className="text-lg text-primary-100 max-w-xl mx-auto mb-10">
            Practice with real exam-pattern MCQ tests, get instant results and detailed explanations — all in one place.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/register" className="btn bg-white text-primary-700 hover:bg-primary-50 btn-lg font-bold shadow-xl">
              Start Practising Free →
            </Link>
            <Link to="/login" className="btn border-2 border-white/40 text-white hover:bg-white/10 btn-lg">
              Sign In
            </Link>
          </div>
          <div className="mt-12 flex justify-center gap-8 flex-wrap text-primary-200 text-sm">
            {[['✅', 'Free Registration'], ['⚡', 'Instant Results'], ['📱', 'Works on any device'], ['🔒', 'Secure Platform']].map(([icon, label]) => (
              <span key={label as string} className="flex items-center gap-1.5">{icon} {label}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Exam Categories */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Test Series by Exam Category</h2>
            <p className="text-gray-500">Find curated test series for your target exam</p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {EXAM_CATEGORIES.map(cat => (
              <Link key={cat.name} to="/register"
                className="bg-white rounded-xl p-4 text-center shadow-sm hover:shadow-md transition hover:-translate-y-0.5 border border-gray-100 group">
                <div className="text-3xl mb-2">{cat.icon}</div>
                <h3 className="font-bold text-gray-800 text-sm group-hover:text-primary-600 transition">{cat.name}</h3>
                <p className="text-gray-400 text-xs mt-1 leading-snug">{cat.desc}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">How It Works</h2>
            <p className="text-gray-500">Get started in minutes — no complex setup</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {HOW_IT_WORKS.map((s, i) => (
              <div key={s.step} className="text-center relative">
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-1/2 w-full h-0.5 bg-gray-200" />
                )}
                <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 relative z-10 border-2 border-primary-100">
                  {s.icon}
                </div>
                <span className="text-xs font-bold text-primary-400 tracking-widest">STEP {s.step}</span>
                <h3 className="font-bold text-gray-900 mt-1 mb-2">{s.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 px-4 bg-gray-50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Everything You Need to Succeed</h2>
            <p className="text-gray-500">Built for serious exam aspirants</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(f => (
              <div key={f.title} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                <div className="text-3xl mb-3">{f.icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{f.title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 px-4 bg-gradient-to-br from-primary-600 to-primary-800 text-white text-center">
        <div className="max-w-xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to Start Practising?</h2>
          <p className="text-primary-200 mb-8">Join thousands of aspirants already using TestPro to crack their target exams.</p>
          <Link to="/register" className="btn bg-white text-primary-700 hover:bg-primary-50 btn-lg font-bold shadow-xl">
            Create Free Account →
          </Link>
        </div>
      </section>

      <footer className="bg-gray-900 text-gray-400 text-sm py-8 px-4 text-center">
        <div className="flex items-center justify-center gap-2 text-white font-bold text-lg mb-3">
          <svg className="w-5 h-5 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
          </svg>
          TestPro
        </div>
        <p>© {new Date().getFullYear()} TestPro. All rights reserved.</p>
      </footer>
    </div>
  );
}
