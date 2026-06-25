import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../api';
import { Link } from 'react-router-dom';

export default function Profile() {
  const { user } = useAuth();
  const [tab, setTab] = useState<'info' | 'password'>('info');
  const [form, setForm] = useState({ name: user?.name || '', mobile: user?.mobile || '', exam_category: user?.exam_category || '', target_exam: user?.target_exam || '' });
  const [pwd, setPwd] = useState({ current: '', new_password: '', confirm: '' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setMsg(null);
    try {
      await authApi.updateProfile(form);
      setMsg({ type: 'success', text: 'Profile updated successfully!' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Update failed' });
    } finally { setSaving(false); }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.new_password !== pwd.confirm) { setMsg({ type: 'error', text: 'New passwords do not match' }); return; }
    if (pwd.new_password.length < 6) { setMsg({ type: 'error', text: 'Password must be at least 6 characters' }); return; }
    setSaving(true); setMsg(null);
    try {
      await authApi.updateProfile({ password: pwd.current, new_password: pwd.new_password });
      setMsg({ type: 'success', text: 'Password changed successfully!' });
      setPwd({ current: '', new_password: '', confirm: '' });
    } catch (err: any) {
      setMsg({ type: 'error', text: err.response?.data?.error || 'Password change failed' });
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="card mb-6 flex items-center gap-5">
        <div className="w-16 h-16 rounded-full bg-primary-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
          {user?.name.charAt(0).toUpperCase()}
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">{user?.name}</h1>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <span className={`mt-1 inline-block badge ${user?.role === 'admin' ? 'badge-blue' : 'badge-green'}`}>{user?.role}</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        {(['info', 'password'] as const).map(t => (
          <button key={t} onClick={() => { setTab(t); setMsg(null); }}
            className={`pb-3 px-1 text-sm font-medium capitalize border-b-2 transition ${tab === t ? 'border-primary-600 text-primary-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t === 'info' ? 'Profile Info' : 'Change Password'}
          </button>
        ))}
      </div>

      {msg && (
        <div className={`mb-5 px-4 py-3 rounded-lg text-sm ${msg.type === 'success' ? 'bg-success-50 text-success-700 border border-success-200' : 'bg-danger-50 text-danger-700 border border-red-200'}`}>
          {msg.text}
        </div>
      )}

      {tab === 'info' ? (
        <form onSubmit={saveProfile} className="card space-y-5">
          <div>
            <label className="label">Full Name</label>
            <input className="input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="label">Email Address</label>
            <input className="input bg-gray-50 cursor-not-allowed" value={user?.email} disabled />
            <p className="text-xs text-gray-400 mt-1">Email cannot be changed.</p>
          </div>
          <div>
            <label className="label">Mobile Number</label>
            <input className="input" value={form.mobile} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} placeholder="Enter mobile number" />
          </div>
          <div>
            <label className="label">Exam Category</label>
            <select className="input" value={form.exam_category} onChange={e => setForm(f => ({ ...f, exam_category: e.target.value }))}>
              <option value="">Select category</option>
              {['UPSC', 'SSC', 'Banking', 'Railways', 'State PSC', 'Engineering', 'Medical', 'Other'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Target Exam</label>
            <input className="input" value={form.target_exam} onChange={e => setForm(f => ({ ...f, target_exam: e.target.value }))} placeholder="e.g. UPSC CSE 2025" />
          </div>
          <div className="flex gap-3 pt-2">
            <Link to="/dashboard" className="btn-secondary flex-1 text-center">Cancel</Link>
            <button type="submit" disabled={saving} className="btn-primary flex-1">{saving ? 'Saving…' : 'Save Changes'}</button>
          </div>
        </form>
      ) : (
        <form onSubmit={changePassword} className="card space-y-5">
          <div>
            <label className="label">Current Password</label>
            <input type="password" className="input" value={pwd.current} onChange={e => setPwd(p => ({ ...p, current: e.target.value }))} required />
          </div>
          <div>
            <label className="label">New Password</label>
            <input type="password" className="input" value={pwd.new_password} onChange={e => setPwd(p => ({ ...p, new_password: e.target.value }))} required minLength={6} />
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input type="password" className="input" value={pwd.confirm} onChange={e => setPwd(p => ({ ...p, confirm: e.target.value }))} required minLength={6} />
          </div>
          <button type="submit" disabled={saving} className="btn-primary w-full">{saving ? 'Changing…' : 'Change Password'}</button>
        </form>
      )}
    </div>
  );
}
