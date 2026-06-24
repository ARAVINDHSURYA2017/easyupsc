import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Navbar } from './components/Navbar';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentDashboard from './pages/StudentDashboard';
import AvailableTests from './pages/AvailableTests';
import TestSeries from './pages/TestSeries';
import PYQBank from './pages/PYQBank';
import TestInstructions from './pages/TestInstructions';
import TakeTest from './pages/TakeTest';
import TestResults from './pages/TestResults';
import History from './pages/History';
import Profile from './pages/Profile';
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageTests from './pages/admin/ManageTests';
import CreateTest from './pages/admin/CreateTest';
import UploadPDF from './pages/admin/UploadPDF';
import QuestionBank from './pages/admin/QuestionBank';
import AdminUsers from './pages/admin/AdminUsers';
import AIUpload from './pages/admin/AIUpload';

export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Student */}
          <Route path="/dashboard" element={<ProtectedRoute><StudentDashboard /></ProtectedRoute>} />
          <Route path="/series" element={<ProtectedRoute><TestSeries /></ProtectedRoute>} />
          <Route path="/pyq" element={<ProtectedRoute><PYQBank /></ProtectedRoute>} />
          <Route path="/tests" element={<ProtectedRoute><AvailableTests /></ProtectedRoute>} />
          <Route path="/tests/:testId/info" element={<ProtectedRoute><TestInstructions /></ProtectedRoute>} />
          <Route path="/test/:testId" element={<ProtectedRoute><TakeTest /></ProtectedRoute>} />
          <Route path="/results/:attemptId" element={<ProtectedRoute><TestResults /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><History /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Admin */}
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/tests" element={<ProtectedRoute adminOnly><ManageTests /></ProtectedRoute>} />
          <Route path="/admin/tests/create" element={<ProtectedRoute adminOnly><CreateTest /></ProtectedRoute>} />
          <Route path="/admin/tests/:id/edit" element={<ProtectedRoute adminOnly><CreateTest /></ProtectedRoute>} />
          <Route path="/admin/questions" element={<ProtectedRoute adminOnly><QuestionBank /></ProtectedRoute>} />
          <Route path="/admin/upload" element={<ProtectedRoute adminOnly><UploadPDF /></ProtectedRoute>} />
          <Route path="/admin/ai-upload" element={<ProtectedRoute adminOnly><AIUpload /></ProtectedRoute>} />
          <Route path="/admin/users" element={<ProtectedRoute adminOnly><AdminUsers /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </AuthProvider>
  );
}
