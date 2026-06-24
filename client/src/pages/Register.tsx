import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api';

const EXAM_CATEGORIES = ['Engineering', 'Medical', 'Law', 'Civil Services', 'Banking', 'Defense', 'Teaching', 'Other'];

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', mobile: '', password: '', confirm_password: '', exam_category: '', target_exam: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function setField(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) { setError('Passwords do not match'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await authApi.register(form);
      const { token, user } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create your account</h1>
          <p className="text-gray-500 mt-2">Join TestPro and start practising</p>
        </div>
        <div className="card shadow-md">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="bg-danger-50 border border-red-200 text-danger-600 rounded-lg p-3 text-sm">{error}</div>}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="label">Full Name *</label>
                <input className="input" placeholder="John Doe" value={form.name} onChange={e => setField('name', e.target.value)} required />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Email *</label>
                <input type="email" className="input" placeholder="john@example.com" value={form.email} onChange={e => setField('email', e.target.value)} required />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Mobile</label>
                <input className="input" placeholder="9876543210" value={form.mobile} onChange={e => setField('mobile', e.target.value)} />
              </div>
              <div>
                <label className="label">Password *</label>
                <input type="password" className="input" placeholder="Min 6 chars" value={form.password} onChange={e => setField('password', e.target.value)} required />
              </div>
              <div>
                <label className="label">Confirm Password *</label>
                <input type="password" className="input" placeholder="Repeat password" value={form.confirm_password} onChange={e => setField('confirm_password', e.target.value)} required />
              </div>
              <div>
                <label className="label">Exam Category</label>
                <select className="input" value={form.exam_category} onChange={e => setField('exam_category', e.target.value)}>
                  <option value="">Select category</option>
                  {EXAM_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Target Exam</label>
                <input className="input" placeholder="e.g. JEE, NEET, UPSC" value={form.target_exam} onChange={e => setField('target_exam', e.target.value)} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full btn-lg mt-2">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
          <div className="mt-5 pt-5 border-t border-gray-100 text-center text-sm text-gray-500">
            Already have an account? <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
