const http = require('http');
const path = require('path');
require('dotenv').config();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = 5000;
if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is missing from .env file');
}


const db = require('better-sqlite3')(
  path.join(__dirname, 'neurosync.db')
);

db.prepare(`
  CREATE TABLE IF NOT EXISTS sessions (
    id INTEGER PRIMARY KEY,
    completedAt TEXT,
    durationMinutes INTEGER,
    completedDate TEXT,
    pauseCount INTEGER,
    pauseDuration INTEGER,
    cognitiveLoad INTEGER,
    cognitiveLoadLevel TEXT
  )
`).run();
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    createdAt TEXT DEFAULT CURRENT_TIMESTAMP
  )
`).run();
const columns = db.prepare(`PRAGMA table_info(sessions)`).all();

if (!columns.some((column) => column.name === 'cognitiveLoad')) {
  db.prepare(`
    ALTER TABLE sessions
    ADD COLUMN cognitiveLoad INTEGER DEFAULT 0
  `).run();
}
if (!columns.some((column) => column.name === 'cognitiveLoadLevel')) {
  db.prepare(`
    ALTER TABLE sessions
    ADD COLUMN cognitiveLoadLevel TEXT DEFAULT ''
  `).run();
}

if (!columns.some((column) => column.name === 'userId')) {
  db.prepare(`
    ALTER TABLE sessions
    ADD COLUMN userId INTEGER
  `).run();
}

// Verify JWT token for protected API routes
const authenticateToken = (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Access denied. Token is required.'
    }));
    return null;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Invalid or expired token.'
    }));
    return null;
  }
};

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization'
  );

  // Handle preflight request
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // User Signup
if (req.method === 'POST' && req.url === '/api/auth/signup') {
  let body = '';

  let bodyTooLarge = false;

req.on('data', (chunk) => {
  if (bodyTooLarge) return;

  if (Buffer.byteLength(body) + chunk.length > 1024 * 1024) {
    bodyTooLarge = true;
    body = '';
    return;
  }

  body += chunk.toString();
});

  req.on('end', async () => {
    if (bodyTooLarge) {
      res.writeHead(413, {
        'Content-Type': 'application/json',
      });
    
      res.end(JSON.stringify({
        success: false,
        message: 'Request body is too large. Maximum size is 1 MB.',
      }));
    
      return;
    }
    try {
      const { name, email, password } = JSON.parse(body);

      if (!name || !email || !password || password.length < 8) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: 'Name, email and password (minimum 8 characters) are required'
        }));
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      const existingUser = db.prepare(
        'SELECT id FROM users WHERE email = ?'
      ).get(normalizedEmail);

      if (existingUser) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: 'Email already registered'
        }));
        return;
      }

      const hashedPassword = await bcrypt.hash(password, 12);

      const result = db.prepare(`
        INSERT INTO users (name, email, password)
        VALUES (?, ?, ?)
      `).run(name.trim(), normalizedEmail, hashedPassword);

      const token = jwt.sign(
        { userId: result.lastInsertRowid, email: normalizedEmail },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Account created successfully',
        token,
        user: {
          id: result.lastInsertRowid,
          name: name.trim(),
          email: normalizedEmail
        }
      }));
    } catch (error) {
      console.error('Signup error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Signup failed'
      }));
    }
  });

  return;
}

// User Login
if (req.method === 'POST' && req.url === '/api/auth/login') {
  let body = '';
let bodyTooLarge = false;

req.on('data', (chunk) => {
  if (bodyTooLarge) return;

  if (Buffer.byteLength(body) + chunk.length > 1024 * 1024) {
    bodyTooLarge = true;
    body = '';
    return;
  }

  body += chunk.toString();
});

  req.on('end', async () => {
    if (bodyTooLarge) {
      res.writeHead(413, {
        'Content-Type': 'application/json',
      });
    
      res.end(JSON.stringify({
        success: false,
        message: 'Request body is too large. Maximum size is 1 MB.',
      }));
    
      return;
    }
    try {
      const { email, password } = JSON.parse(body);

      if (!email || !password) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: 'Email and password are required'
        }));
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();

      const user = db.prepare(
        'SELECT * FROM users WHERE email = ?'
      ).get(normalizedEmail);

      if (!user || !(await bcrypt.compare(password, user.password))) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          success: false,
          message: 'Invalid email or password'
        }));
        return;
      }

      const token = jwt.sign(
        { userId: user.id, email: user.email },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: true,
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email
        }
      }));
    } catch (error) {
      console.error('Login error:', error);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'Login failed'
      }));
    }
  });

  return;
}

  // Health check
  if (req.method === 'GET' && req.url === '/api/health') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
    });

    res.end(
      JSON.stringify({
        success: true,
        message: 'NeuroSync backend is running',
      })
    );

    return;
  }

  // Get sessions
if (req.method === 'GET' && req.url === '/api/sessions') {
  const authUser = authenticateToken(req, res);
  if (!authUser) return;

  const sessions = db
    .prepare('SELECT * FROM sessions WHERE userId = ? ORDER BY id DESC')
    .all(authUser.userId);

  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  res.end(JSON.stringify({
    success: true,
    sessions,
  }));

  return;
}


  // Clear user's sessions
if (req.method === 'DELETE' && req.url === '/api/sessions') {
  const authUser = authenticateToken(req, res);
  if (!authUser) return;

  db.prepare('DELETE FROM sessions WHERE userId = ?')
    .run(authUser.userId);

  res.writeHead(200, {
    'Content-Type': 'application/json',
  });

  res.end(JSON.stringify({
    success: true,
    message: 'Your sessions cleared successfully',
  }));

  return;
}

// Verify JWT Token
if (req.method === 'GET' && req.url === '/api/auth/me') {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Authorization token is required'
    }));
    return;
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = db.prepare(
      'SELECT id, name, email FROM users WHERE id = ?'
    ).get(decoded.userId);

    if (!user) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        success: false,
        message: 'User not found'
      }));
      return;
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Token verified successfully',
      user
    }));

  } catch (error) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: false,
      message: 'Invalid or expired token'
    }));
  }

  return;
}

  // Save session
if (req.method === 'POST' && req.url === '/api/sessions') {
  const authUser = authenticateToken(req, res);
  if (!authUser) return;

  let body = '';
let bodyTooLarge = false;

req.on('data', (chunk) => {
  if (bodyTooLarge) return;

  if (Buffer.byteLength(body) + chunk.length > 1024 * 1024) {
    bodyTooLarge = true;
    body = '';
    return;
  }

  body += chunk.toString();
});

  req.on('end', () => {
    if (bodyTooLarge) {
      res.writeHead(413, {
        'Content-Type': 'application/json',
      });
    
      res.end(JSON.stringify({
        success: false,
        message: 'Request body is too large. Maximum size is 1 MB.',
      }));
    
      return;
    }
    try {
      const session = JSON.parse(body);

      // Session validation
      if (
        !session ||
        !session.id ||
        !session.completedAt ||
        !session.completedDate ||
        !Number.isFinite(Number(session.durationMinutes)) ||
        Number(session.durationMinutes) <= 0
      ) {
        res.writeHead(400, {
          'Content-Type': 'application/json',
        });

        res.end(JSON.stringify({
          success: false,
          message: 'Invalid session data',
        }));

        return;
      }

      const existingSession = db
        .prepare('SELECT id FROM sessions WHERE id = ? AND userId = ?')
        .get(session.id, authUser.userId);

      const alreadyExists = Boolean(existingSession);

      if (!alreadyExists) {
        db.prepare(`
          INSERT INTO sessions (
            id,
            completedAt,
            durationMinutes,
            completedDate,
            pauseCount,
            pauseDuration,
            cognitiveLoad,
            cognitiveLoadLevel,
            userId
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          session.id,
          session.completedAt,
          Number(session.durationMinutes),
          session.completedDate,
          Number(session.pauseCount || 0),
          Number(session.pauseDuration || 0),
          Number(session.cognitiveLoad || 0),
          session.cognitiveLoadLevel || '',
          authUser.userId
        );
      }

      res.writeHead(201, {
        'Content-Type': 'application/json',
      });

      res.end(JSON.stringify({
        success: true,
        message: alreadyExists
          ? 'Session already exists'
          : 'Session saved successfully',
        session,
      }));

    } catch (error) {
      console.error('Session save error:', error);
    
      const isJsonError = error instanceof SyntaxError;
    
      res.writeHead(isJsonError ? 400 : 500, {
        'Content-Type': 'application/json',
      });
    
      res.end(JSON.stringify({
        success: false,
        message: isJsonError
          ? 'Invalid JSON format'
          : 'Internal server error',
      }));
    }
  });

  return;
}

  // Unknown route
  res.writeHead(404, {
    'Content-Type': 'application/json',
  });

  res.end(
    JSON.stringify({
      success: false,
      message: 'Route not found',
    })
  );
});

server.listen(PORT, () => {
  console.log(
    `NeuroSync backend running on http://localhost:${PORT}`
  );
});