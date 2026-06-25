# TestPro — Online Test Platform

A full-stack web application for creating and taking online tests.

## Tech Stack
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite
- **Backend**: Node.js + Express
- **Database**: SQLite (via better-sqlite3)
- **Auth**: JWT tokens

## Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) v18+ (LTS recommended)

### Option A: Use the start script (Windows)
Double-click `start.bat` — it installs dependencies and starts both servers.

### Option B: Manual setup

**1. Install & start the backend**
```bash
cd server
npm install
node index.js
# Server runs on http://localhost:3001
```

**2. Install & start the frontend** (in a new terminal)
```bash
cd client
npm install
npm run dev
# App opens on http://localhost:5173
```

**3. Open http://localhost:5173 in your browser**

## Default Credentials
| Role  | Email            | Password  |
|-------|------------------|-----------|
| Admin | admin@otp.com    | Admin@123 |

Register new student accounts from the Sign Up page.

## Features

### Admin
- **Dashboard** — stats, top students, difficult questions, recent attempts
- **Create Tests** — set title, duration, marks, negative marking
- **Question Bank** — add/edit/delete MCQ, True/False questions
- **Upload PDF** — extract questions from PDF papers automatically
- **Publish/Unpublish** — control test visibility
- **Users** — view all registered students and their performance

### Student
- **Dashboard** — score overview, subject-wise chart, recent attempts
- **Available Tests** — browse and filter published tests
- **Take Test** — real-time timer, question navigation, mark for review, auto-save every 30s
- **Auto-submit** — when timer expires
- **Results** — detailed review with correct answers and explanations
- **History** — all attempt records

## Database
SQLite database stored at `server/data/otp.db`. Auto-created on first run.

## PDF Format for Upload
```
1. What is the capital of France?
A) London
B) Berlin
C) Paris
D) Madrid
Answer: C
Explanation: Paris is the capital of France.
```
