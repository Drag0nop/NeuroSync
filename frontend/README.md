# NeuroSync — Cognitive Load Aware Productivity Intelligence

NeuroSync is a productivity application designed to help users manage focus sessions, track their productivity, and review focus-related analytics.

This folder contains the **React frontend and Node.js backend** developed for the NeuroSync project.

## 1. Project Overview

NeuroSync provides a dashboard where users can manage focus sessions and review their productivity activity.

The application currently includes:

- User signup and login
- Productivity dashboard
- Focus timer
- Focus session history
- Cognitive analytics
- Weekly productivity statistics
- Rule-based recommendations
- Backend APIs for authentication and session management
- SQLite database for storing user and session data

## 2. Technology Stack

### Frontend
- React
- JavaScript
- Vite
- HTML
- CSS

### Backend
- Node.js
- Built-in Node.js HTTP module
- SQLite
- better-sqlite3
- bcryptjs
- JSON Web Token (JWT)
- dotenv

## 3. Project Structure

```text
advanced-work/
└── frontend/
    ├── backend/
    │   ├── server.js
    │   ├── package.json
    │   └── package-lock.json
    │
    ├── src/
    │   ├── App.jsx
    │   ├── Auth.jsx
    │   ├── main.jsx
    │   └── CSS and other frontend files
    │
    ├── public/
    ├── index.html
    ├── package.json
    ├── package-lock.json
    ├── vite.config.js
    ├── .gitignore
    └── README.md
```

## 4. Prerequisites

Before running the project, install:

- Node.js (version 22 or above recommended)
- npm
- Git

**Windows note:** If `better-sqlite3` fails to install because native compilation tools are missing, install Visual Studio Build Tools with the **Desktop development with C++** workload.

## 5. Clone the Repository

Clone the main NeuroSync repository:

```bash
git clone https://github.com/Drag0nop/NeuroSync.git
```

Navigate to the frontend folder:

```bash
cd NeuroSync/advanced-work/frontend
```

## 6. Frontend Setup

Install frontend dependencies:

```bash
npm install
```

Start the frontend development server:

```bash
npm run dev
```

Vite will display a local URL, usually:

```text
http://localhost:5173/
```

Open this URL in your browser.

## 7. Backend Setup

Open a **second terminal**.

Navigate to the backend directory:

```bash
cd NeuroSync/advanced-work/frontend/backend
```

Install backend dependencies:

```bash
npm install
```

### Environment Configuration

Create a file named `.env` inside the `backend` folder.

Add the following:

```env
JWT_SECRET=your_own_private_secret_key
```

Replace the example value with your own private secret key.

**Important:** Every developer should create their own `.env` file. Do not share or upload your private JWT secret to GitHub.

### Start the Backend

Run:

```bash
npm start
```

The backend runs at:

```text
http://localhost:5000
```

To check whether the backend is running, open:

```text
http://localhost:5000/api/health
```

## 8. Database

NeuroSync uses SQLite through `better-sqlite3`.

- The database is created automatically when the backend starts.
- Database file: `backend/neurosync.db`
- Required tables are created by the backend.
- Each developer has their own local database.

There is no need to manually create the database.

## 9. Backend API Endpoints

The backend currently provides the following API endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend status |
| POST | `/api/auth/signup` | User registration |
| POST | `/api/auth/login` | User login |
| GET | `/api/auth/me` | Get authenticated user |
| GET | `/api/sessions` | Retrieve focus sessions |
| POST | `/api/sessions` | Save a focus session |
| DELETE | `/api/sessions` | Delete session history |

## 10. Running the Complete Application

To run the complete application, use two separate terminals.

**Terminal 1 — Frontend**

```bash
cd NeuroSync/advanced-work/frontend
npm run dev
```

**Terminal 2 — Backend**

```bash
cd NeuroSync/advanced-work/frontend/backend
npm start
```

Keep both terminals running while using the application.

## 11. Important Commands

### Frontend

```bash
npm install
npm run dev
npm run build
npm run preview
```

### Backend

```bash
npm install
npm start
```

## 12. Troubleshooting

**Problem: npm is not recognized or PowerShell blocks npm.ps1**

On Windows PowerShell, try using:

```bash
npm.cmd install
npm.cmd run dev
```

For the backend:

```bash
npm.cmd install
npm.cmd start
```

**Problem: Backend says JWT_SECRET is missing**

- Check that `.env` exists inside the `backend` folder.
- Check that it contains `JWT_SECRET=your_private_secret`.
- Restart the backend.

**Problem: better-sqlite3 installation fails**

- Check your Node.js version.
- On Windows, install Visual Studio Build Tools with the Desktop development with C++ workload.
- Run `npm install` again.

**Problem: Port is already in use**

- Check whether another frontend or backend process is already running.
- Stop the previous process before starting another one.

## 13. Important Notes

- Do not upload `.env` files to GitHub.
- Do not upload `node_modules`.
- Do not upload local database files.
- Each developer should install dependencies independently.
- The backend database is generated locally.
- Keep frontend and backend running in separate terminals.

## 14. Project Scope

NeuroSync is being developed as a final-year major project.

The current development focuses on productivity tracking, focus session management, cognitive analytics, and rule-based recommendations.

Future development and integration may extend the system with additional cognitive-load monitoring and productivity intelligence features.

## 15. Contributors

NeuroSync is developed as a collaborative final-year project.

---

**NeuroSync — Cognitive Load Aware Productivity Intelligence**

*Final-Year Major Project*