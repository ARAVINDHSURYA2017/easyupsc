export interface User {
  id: number;
  name: string;
  email: string;
  mobile?: string;
  role: 'admin' | 'student';
  exam_category?: string;
  target_exam?: string;
  created_at: string;
}

export interface Subject { id: number; name: string; }
export interface Topic { id: number; name: string; subject_id: number; subject_name?: string; }

export interface Question {
  id: number;
  question_text: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  correct_answer: string;
  explanation?: string;
  topic_id?: number;
  subject_id?: number;
  difficulty_level: 'easy' | 'medium' | 'hard';
  question_type: 'single' | 'multiple' | 'truefalse';
  subject_name?: string;
  topic_name?: string;
  created_at?: string;
  marks?: number;
  order_num?: number;
  selected_answer?: string;
  is_correct?: number;
  time_spent?: number;
  marked_for_review?: number;
}

export interface Test {
  id: number;
  title: string;
  description?: string;
  category?: string;
  exam?: string;
  test_type?: 'pyq' | 'test_series';
  exam_year?: number;
  subject_id?: number;
  topic_id?: number;
  duration: number;
  total_marks: number;
  negative_marks: number;
  num_questions: number;
  status: 'draft' | 'published';
  created_by?: number;
  created_at: string;
  subject_name?: string;
  topic_name?: string;
  created_by_name?: string;
  question_count?: number;
  attempt_count?: number;
  questions?: Question[];
  last_attempt?: Attempt | null;
}

export interface Attempt {
  id: number;
  user_id: number;
  test_id: number;
  start_time: string;
  end_time?: string;
  score: number;
  percentage: number;
  total_questions: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  status: 'in_progress' | 'completed';
  test_title?: string;
  subject_name?: string;
  category?: string;
}

export interface LocalResponse {
  question_id: number;
  selected_answer: string | null;
  time_spent: number;
  marked_for_review: boolean;
}
