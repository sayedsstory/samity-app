require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const db      = require('./database');

const app  = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'samity_secret_change_this';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── Auth middleware ────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers['authorization'];
  if (!header) return res.status(401).json({ error: 'No token' });
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// ── Auth routes ────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  const adminUser = process.env.ADMIN_USERNAME || 'admin';
  const adminPass = process.env.ADMIN_PASSWORD || 'samity2022';
  if (username === adminUser && password === adminPass) {
    const token = jwt.sign({ username, role: 'admin' }, JWT_SECRET, { expiresIn: '30d' });
    return res.json({ token, role: 'admin' });
  }
  // Guest login
  if (username === 'guest' || password === 'guest') {
    const token = jwt.sign({ username: 'guest', role: 'guest' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token, role: 'guest' });
  }
  res.status(401).json({ error: 'Incorrect username or password' });
});

app.post('/api/change-password', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) return res.status(400).json({ error: 'Password too short' });
  // In production store hashed — for simplicity update .env equivalent in memory
  process.env.ADMIN_PASSWORD = newPassword;
  res.json({ ok: true });
});

// ── Summary ────────────────────────────────────────────────────────────────
app.get('/api/summary', (req, res) => {
  const row = db.prepare('SELECT * FROM summary WHERE id=1').get();
  res.json(row);
});

app.put('/api/summary', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { total_deposit, invested_amount, total_profit, total_expenses, cash_in_hand, grand_total } = req.body;
  db.prepare(`UPDATE summary SET
    total_deposit=?, invested_amount=?, total_profit=?,
    total_expenses=?, cash_in_hand=?, grand_total=?,
    updated_at=datetime('now') WHERE id=1`
  ).run(total_deposit, invested_amount, total_profit, total_expenses, cash_in_hand, grand_total);
  res.json({ ok: true });
});

// ── Members ────────────────────────────────────────────────────────────────
app.get('/api/members', (req, res) => {
  const rows = db.prepare('SELECT * FROM members ORDER BY sort_order').all();
  res.json(rows);
});

// ── Deposits ───────────────────────────────────────────────────────────────
app.get('/api/deposits/:year/:month', (req, res) => {
  const { year, month } = req.params;
  const members = db.prepare('SELECT * FROM members ORDER BY sort_order').all();
  const deposits = db.prepare('SELECT * FROM deposits WHERE year=? AND month=?').all(+year, +month);
  // Map deposits by member_id for quick lookup
  const depMap = {};
  deposits.forEach(d => depMap[d.member_id] = d);
  const result = members.map(m => ({
    member_id: m.id,
    name: m.name,
    amount: depMap[m.id]?.amount ?? 0,
    status: depMap[m.id]?.status ?? 'unpaid',
    fine:   depMap[m.id]?.fine   ?? 0,
    note:   depMap[m.id]?.note   ?? '',
  }));
  res.json(result);
});

app.put('/api/deposits/:year/:month/:memberId', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { year, month, memberId } = req.params;
  const { amount, status, fine, note } = req.body;
  db.prepare(`INSERT INTO deposits (member_id,month,year,amount,status,fine,note,updated_at)
    VALUES (?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(member_id,month,year) DO UPDATE SET
      amount=excluded.amount, status=excluded.status,
      fine=excluded.fine, note=excluded.note,
      updated_at=datetime('now')`
  ).run(+memberId, +month, +year, amount ?? 0, status ?? 'unpaid', fine ?? 0, note ?? '');
  res.json({ ok: true });
});

// Bulk mark all paid for a month
app.put('/api/deposits/:year/:month/mark-all-paid', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { year, month } = req.params;
  const members = db.prepare('SELECT * FROM members ORDER BY sort_order').all();
  const upsert = db.prepare(`INSERT INTO deposits (member_id,month,year,amount,status,fine,note,updated_at)
    VALUES (?,?,?,500,'paid',0,'',datetime('now'))
    ON CONFLICT(member_id,month,year) DO UPDATE SET status='paid', updated_at=datetime('now')`);
  const markAll = db.transaction(() => members.forEach(m => upsert.run(m.id, +month, +year)));
  markAll();
  res.json({ ok: true });
});

// All months summary (for the overview table)
app.get('/api/deposits/all', (req, res) => {
  const members = db.prepare('SELECT * FROM members ORDER BY sort_order').all();
  const deposits = db.prepare('SELECT * FROM deposits ORDER BY year, month').all();
  const depMap = {};
  deposits.forEach(d => {
    const k = `${d.year}-${d.month}`;
    if (!depMap[k]) depMap[k] = {};
    depMap[k][d.member_id] = d;
  });
  res.json({ members, depMap });
});

// ── Investments ────────────────────────────────────────────────────────────
app.get('/api/investments', (req, res) => {
  res.json(db.prepare('SELECT * FROM investments ORDER BY sl, id').all());
});

app.post('/api/investments', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { name, amount, type, date, purpose } = req.body;
  const maxSl = db.prepare('SELECT MAX(sl) as m FROM investments').get().m || 0;
  const r = db.prepare('INSERT INTO investments (sl,name,amount,type,date,purpose) VALUES (?,?,?,?,?,?)')
    .run(maxSl + 1, name, amount, type || '', date || '', purpose || 'From land');
  res.json({ id: r.lastInsertRowid, sl: maxSl + 1 });
});

app.delete('/api/investments/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM investments WHERE id=?').run(+req.params.id);
  res.json({ ok: true });
});

// ── Profits ────────────────────────────────────────────────────────────────
app.get('/api/profits', (req, res) => {
  res.json(db.prepare('SELECT * FROM profits ORDER BY id').all());
});

app.post('/api/profits', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { note, amount, period } = req.body;
  const r = db.prepare('INSERT INTO profits (note,amount,period) VALUES (?,?,?)').run(note, amount, period || '');
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/profits/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM profits WHERE id=?').run(+req.params.id);
  res.json({ ok: true });
});

// ── Expenses ───────────────────────────────────────────────────────────────
app.get('/api/expenses', (req, res) => {
  res.json(db.prepare('SELECT * FROM expenses ORDER BY id').all());
});

app.post('/api/expenses', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { description, amount } = req.body;
  const r = db.prepare('INSERT INTO expenses (description,amount) VALUES (?,?)').run(description, amount);
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/expenses/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM expenses WHERE id=?').run(+req.params.id);
  res.json({ ok: true });
});

// ── Fines ──────────────────────────────────────────────────────────────────
app.get('/api/fines', (req, res) => {
  res.json(db.prepare('SELECT * FROM fines ORDER BY id').all());
});

app.post('/api/fines', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  const { member_name, period, amount } = req.body;
  const r = db.prepare('INSERT INTO fines (member_name,period,amount) VALUES (?,?,?)').run(member_name, period, amount);
  res.json({ id: r.lastInsertRowid });
});

app.delete('/api/fines/:id', requireAuth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  db.prepare('DELETE FROM fines WHERE id=?').run(+req.params.id);
  res.json({ ok: true });
});

// ── Serve frontend ─────────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`✅ Samity server running on http://localhost:${PORT}`);
});
