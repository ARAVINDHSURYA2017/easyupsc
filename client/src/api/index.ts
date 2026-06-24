import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api' });

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      const msg = err.response?.data?.error || '';
      if (msg.includes('token') || msg.includes('Token')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

// Auth
export const authApi = {
  register: (data: any) => api.post('/auth/register', data),
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  profile: () => api.get('/auth/profile'),
  updateProfile: (data: any) => api.put('/auth/profile', data),
};

// Admin
export const adminApi = {
  stats: () => api.get('/admin/stats'),
  subjects: () => api.get('/admin/subjects'),
  createSubject: (name: string) => api.post('/admin/subjects', { name }),
  topics: (subject_id?: number) => api.get('/admin/topics', { params: { subject_id } }),
  createTopic: (data: any) => api.post('/admin/topics', data),
  questions: (params?: any) => api.get('/admin/questions', { params }),
  createQuestion: (data: any) => api.post('/admin/questions', data),
  updateQuestion: (id: number, data: any) => api.put(`/admin/questions/${id}`, data),
  deleteQuestion: (id: number) => api.delete(`/admin/questions/${id}`),
  bulkImportQuestions: (data: any) => api.post('/admin/questions/bulk', data),
  uploadPdf: (file: File) => {
    const form = new FormData();
    form.append('pdf', file);
    return api.post('/admin/upload-pdf', form, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  tests: () => api.get('/admin/tests'),
  createTest: (data: any) => api.post('/admin/tests', data),
  getTest: (id: number) => api.get(`/admin/tests/${id}`),
  updateTest: (id: number, data: any) => api.put(`/admin/tests/${id}`, data),
  deleteTest: (id: number) => api.delete(`/admin/tests/${id}`),
  publishTest: (id: number) => api.put(`/admin/tests/${id}/publish`),
  unpublishTest: (id: number) => api.put(`/admin/tests/${id}/unpublish`),
  addQuestionsToTest: (testId: number, question_ids: number[], marks?: number) =>
    api.post(`/admin/tests/${testId}/questions`, { question_ids, marks }),
  removeQuestionFromTest: (testId: number, qid: number) =>
    api.delete(`/admin/tests/${testId}/questions/${qid}`),
  users: () => api.get('/admin/users'),
};

// AI Upload (admin)
export const aiUploadApi = {
  process: (formData: FormData) =>
    fetch('/api/admin/ai-upload/process', {
      method: 'POST',
      headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      body: formData,
    }).then(r => r.json()),
  approve: (questions: any[], metadata: any) =>
    api.post('/admin/ai-upload/approve', { questions, metadata }),
};

// Tests (student)
export const testsApi = {
  list: (params?: any) => api.get('/tests', { params }),
  get: (id: number) => api.get(`/tests/${id}`),
  series: (exam?: string) => api.get('/tests/series/all', { params: { exam } }),
  pyq: (exam?: string) => api.get('/tests/pyq/all', { params: { exam } }),
  examFacets: () => api.get('/tests/exams/facets'),
};

// Attempts
export const attemptsApi = {
  start: (test_id: number) => api.post('/attempts/start', { test_id }),
  saveResponse: (attemptId: number, data: any) => api.put(`/attempts/${attemptId}/response`, data),
  autosave: (attemptId: number, responses: any[]) => api.post(`/attempts/${attemptId}/autosave`, { responses }),
  submit: (attemptId: number, responses?: any[]) => api.post(`/attempts/${attemptId}/submit`, { responses }),
  results: (attemptId: number) => api.get(`/attempts/${attemptId}/results`),
  history: () => api.get('/attempts'),
  stats: () => api.get('/attempts/stats/summary'),
};

export default api;
