const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static('public'));

// Database setup
const db = new sqlite3.Database('database.sqlite');

// Create tables
db.serialize(() => {
  // Students table
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);

  // Questions table
  db.run(`CREATE TABLE IF NOT EXISTS questions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    week_id INTEGER NOT NULL,
    q_num INTEGER NOT NULL,
    text TEXT NOT NULL,
    opt_a TEXT NOT NULL,
    opt_b TEXT NOT NULL,
    opt_c TEXT NOT NULL,
    opt_d TEXT NOT NULL,
    correct TEXT NOT NULL
  )`);

  // Answers table
  db.run(`CREATE TABLE IF NOT EXISTS answers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    question_id INTEGER NOT NULL,
    selected TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Messages table
  db.run(`CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    question_id INTEGER,
    subject TEXT NOT NULL,
    content TEXT NOT NULL,
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_read INTEGER DEFAULT 0
  )`);

  // Config table
  db.run(`CREATE TABLE IF NOT EXISTS config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    due_date TEXT,
    current_week_id INTEGER DEFAULT 1
  )`);

  // Insert default config if not exists
  db.get(`SELECT * FROM config WHERE id = 1`, (err, row) => {
    if (!row) {
      db.run(`INSERT INTO config (id, due_date, current_week_id) VALUES (1, NULL, 1)`);
    }
  });
});

// ============ API ROUTES ============

// Student login
app.post('/api/student/login', (req, res) => {
  const { username, password } = req.body;
  db.get(`SELECT * FROM students WHERE username = ? AND password = ?`, [username, password], (err, student) => {
    if (student) {
      res.json({ success: true, studentId: student.id, username: student.username });
    } else {
      res.json({ success: false, message: 'Invalid username or password' });
    }
  });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password === 'physics1598') {
    res.json({ success: true });
  } else {
    res.json({ success: false, message: 'Invalid admin password' });
  }
});

// Get all students (admin)
app.get('/api/admin/students', (req, res) => {
  db.all(`SELECT * FROM students ORDER BY id`, (err, rows) => {
    res.json(rows);
  });
});

// Add student (admin)
app.post('/api/admin/student', (req, res) => {
  const { username, password } = req.body;
  db.run(`INSERT INTO students (username, password) VALUES (?, ?)`, [username, password], function(err) {
    if (err) {
      res.json({ success: false, message: 'Username already exists' });
    } else {
      res.json({ success: true, studentId: this.lastID });
    }
  });
});

// Delete student (admin)
app.delete('/api/admin/student/:id', (req, res) => {
  const { id } = req.params;
  db.run(`DELETE FROM students WHERE id = ?`, [id], (err) => {
    db.run(`DELETE FROM answers WHERE student_id = ?`, [id]);
    db.run(`DELETE FROM messages WHERE student_id = ?`, [id]);
    res.json({ success: true });
  });
});

// Get current week config
app.get('/api/config', (req, res) => {
  db.get(`SELECT * FROM config WHERE id = 1`, (err, row) => {
    res.json(row);
  });
});

// Set due date (admin)
app.post('/api/admin/due-date', (req, res) => {
  const { due_date } = req.body;
  db.run(`UPDATE config SET due_date = ? WHERE id = 1`, [due_date], (err) => {
    res.json({ success: true });
  });
});

// Upload questions (admin)
app.post('/api/admin/questions', (req, res) => {
  const { questions, week_id } = req.body;
  
  db.run(`DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE week_id = ?)`, [week_id], () => {
    db.run(`DELETE FROM questions WHERE week_id = ?`, [week_id], () => {
      const stmt = db.prepare(`INSERT INTO questions (category, week_id, q_num, text, opt_a, opt_b, opt_c, opt_d, correct) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`);
      
      questions.forEach(q => {
        stmt.run(q.category, week_id, q.q_num, q.text, q.opt_a, q.opt_b, q.opt_c, q.opt_d, q.correct);
      });
      
      stmt.finalize(() => {
        res.json({ success: true });
      });
    });
  });
});

// Get questions for student
app.get('/api/student/:studentId/questions', (req, res) => {
  const { studentId } = req.params;
  
  db.get(`SELECT current_week_id, due_date FROM config WHERE id = 1`, (err, config) => {
    const week_id = config.current_week_id;
    const due_date = config.due_date;
    
    if (due_date && new Date() > new Date(due_date)) {
      return res.json({ expired: true, message: 'Quiz has expired. New quiz coming Sunday.' });
    }
    
    db.all(`SELECT * FROM questions WHERE week_id = ? ORDER BY category, q_num`, [week_id], (err, questions) => {
      db.all(`SELECT question_id, selected, is_correct FROM answers WHERE student_id = ?`, [studentId], (err, answers) => {
        const answerMap = {};
        answers.forEach(a => { answerMap[a.question_id] = { selected: a.selected, is_correct: a.is_correct }; });
        
        const questionsWithStatus = questions.map(q => ({
          ...q,
          answered: !!answerMap[q.id],
          selected: answerMap[q.id]?.selected,
          is_correct: answerMap[q.id]?.is_correct
        }));
        
        res.json({ questions: questionsWithStatus, week_id, due_date });
      });
    });
  });
});

// Submit answer
app.post('/api/student/submit', (req, res) => {
  const { student_id, question_id, selected } = req.body;
  
  db.get(`SELECT correct FROM questions WHERE id = ?`, [question_id], (err, q) => {
    const is_correct = (selected === q.correct) ? 1 : 0;
    
    db.run(`INSERT OR REPLACE INTO answers (student_id, question_id, selected, is_correct, submitted_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [student_id, question_id, selected, is_correct], (err) => {
        res.json({ success: true, is_correct: is_correct === 1, correct_answer: q.correct });
      });
  });
});

// Get student progress - FIXED: counts only correct answers
app.get('/api/student/:studentId/progress', (req, res) => {
  const { studentId } = req.params;
  
  db.get(`SELECT current_week_id FROM config WHERE id = 1`, (err, config) => {
    const week_id = config.current_week_id;
    
    // Current week progress - ONLY correct answers
    db.all(`SELECT COUNT(*) as count FROM answers a 
            JOIN questions q ON a.question_id = q.id 
            WHERE a.student_id = ? AND q.week_id = ? AND a.is_correct = 1`, [studentId, week_id], (err, currentCorrect) => {
      
      // Overall progress - ONLY correct answers across all weeks
      db.all(`SELECT COUNT(*) as count FROM answers a 
              WHERE a.student_id = ? AND a.is_correct = 1`, [studentId], (err, overallCorrect) => {
        
        res.json({
          current_week: { correct: currentCorrect[0]?.count || 0, total: 40 },
          overall: { correct: overallCorrect[0]?.count || 0, total: 0 }
        });
      });
    });
  });
});

// Get leaderboard - FIXED: counts only correct answers
app.get('/api/leaderboard', (req, res) => {
  db.get(`SELECT current_week_id FROM config WHERE id = 1`, (err, config) => {
    const week_id = config.current_week_id;
    
    // Current week leaderboard (correct answers only)
    db.all(`SELECT s.id, s.username, COUNT(a.id) as total_correct
            FROM students s
            LEFT JOIN answers a ON s.id = a.student_id AND a.is_correct = 1
            LEFT JOIN questions q ON a.question_id = q.id AND q.week_id = ?
            GROUP BY s.id
            ORDER BY total_correct DESC`, [week_id], (err, currentWeek) => {
      
      // Overall leaderboard (correct answers only)
      db.all(`SELECT s.id, s.username, COUNT(a.id) as total_correct
              FROM students s
              LEFT JOIN answers a ON s.id = a.student_id AND a.is_correct = 1
              GROUP BY s.id
              ORDER BY total_correct DESC`, [], (err, overall) => {
        
        res.json({ currentWeek, overall });
      });
    });
  });
});

// Get messages for student
app.get('/api/student/:studentId/messages', (req, res) => {
  const { studentId } = req.params;
  db.all(`SELECT * FROM messages WHERE student_id = ? ORDER BY sent_at DESC`, [studentId], (err, rows) => {
    res.json(rows);
  });
});

// Send message (admin)
app.post('/api/admin/message', (req, res) => {
  const { student_id, question_id, subject, content } = req.body;
  db.run(`INSERT INTO messages (student_id, question_id, subject, content) VALUES (?, ?, ?, ?)`,
    [student_id, question_id || null, subject, content], (err) => {
      res.json({ success: true });
    });
});

// Get all wrong answers (admin)
app.get('/api/admin/wrong-answers', (req, res) => {
  db.get(`SELECT current_week_id FROM config WHERE id = 1`, (err, config) => {
    const week_id = config.current_week_id;
    
    db.all(`SELECT s.username, s.id as student_id, q.id as question_id, q.text as question_text, 
                   q.category, a.selected, q.correct, q.opt_a, q.opt_b, q.opt_c, q.opt_d
            FROM answers a
            JOIN students s ON a.student_id = s.id
            JOIN questions q ON a.question_id = q.id
            WHERE a.is_correct = 0 AND q.week_id = ?
            ORDER BY s.username, q.category, q.q_num`, [week_id], (err, rows) => {
      res.json(rows);
    });
  });
});

// Announce results
app.post('/api/admin/announce', (req, res) => {
  db.all(`SELECT s.username, COUNT(a.id) as total_correct
          FROM students s
          LEFT JOIN answers a ON s.id = a.student_id AND a.is_correct = 1
          GROUP BY s.id
          ORDER BY total_correct DESC
          LIMIT 3`, [], (err, winners) => {
    
    db.get(`SELECT current_week_id FROM config WHERE id = 1`, (err, config) => {
      db.run(`DELETE FROM answers WHERE question_id IN (SELECT id FROM questions WHERE week_id = ?)`, [config.current_week_id], () => {
        db.run(`UPDATE config SET current_week_id = current_week_id + 1, due_date = NULL WHERE id = 1`, () => {
          res.json({ success: true, winners });
        });
      });
    });
  });
});

// Reset overall progress
app.post('/api/admin/reset-overall', (req, res) => {
  db.run(`DELETE FROM answers`, () => {
    db.run(`DELETE FROM messages`, () => {
      res.json({ success: true });
    });
  });
});

// Get all questions for admin
app.get('/api/admin/questions', (req, res) => {
  db.get(`SELECT current_week_id FROM config WHERE id = 1`, (err, config) => {
    db.all(`SELECT * FROM questions WHERE week_id = ? ORDER BY category, q_num`, [config.current_week_id], (err, rows) => {
      res.json(rows);
    });
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});