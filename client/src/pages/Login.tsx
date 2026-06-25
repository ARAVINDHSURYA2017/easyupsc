import { useState, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const navigate = useNavigate();

  if (user) { navigate(user.role === 'admin' ? '/admin' : '/dashboard', { replace: true }); return null; }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      navigate(stored.role === 'admin' ? '/admin' : '/dashboard', { replace: true });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Welcome back</h1>
          <p className="text-gray-500 mt-2">Sign in to your TestPro account</p>
        </div>
        <div className="card shadow-md">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && <div className="bg-danger-50 border border-red-200 text-danger-600 rounded-lg p-3 text-sm">{error}</div>}
            <div>
              <label className="label">Email address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" placeholder="you@example.com" required />
            </div>
            <div>
              <label className="label">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="input" placeholder="••••••••" required />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full btn-lg">
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>
          <div className="mt-5 pt-5 border-t border-gray-100 text-center text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">Create one</Link>
          </div>
          <div className="mt-3 text-center text-xs text-gray-400">
            Admin demo: <code className="bg-gray-100 px-1 rounded">admin@otp.com</code> / <code className="bg-gray-100 px-1 rounded">Admin@123</code>
          </div>
        </div>
      </div>
    </div>
  );
}
