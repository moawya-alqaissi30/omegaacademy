const express = require('express');
const path = require('path');
const crypto = require('crypto');
const db = require('./db');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1); // لأن الاستضافة بتحط السيرفر خلف بروكسي
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

db.ensureAdmin();

// ---------- جلسة الأدمن (بالذاكرة، تنتهي بعد 8 ساعات أو عند إعادة تشغيل السيرفر) ----------
const COOKIE = 'omega_admin';
const SESSION_MS = 1000 * 60 * 60 * 8;
const sessions = new Map();

function getToken(req) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}

function isAdmin(req) {
  const token = getToken(req);
  const s = token && sessions.get(token);
  if (!s) return false;
  if (s.expires < Date.now()) { sessions.delete(token); return false; }
  return true;
}

function requireAdmin(req, res, next) {
  if (isAdmin(req)) return next();
  res.status(401).json({ success: false, message: 'غير مصرّح' });
}

// ---------- حماية صفحة الأدمن ----------
app.use((req, res, next) => {
  if (/^\/admin(\.html)?\/?$/i.test(req.path) && !isAdmin(req)) return res.redirect('/login.html');
  next();
});

app.use(express.static(path.join(__dirname, 'public')));

// ---------- تسجيل دخول الأدمن (مع حد للمحاولات الخاطئة) ----------
const fails = new Map(); // ip -> { count, until }

app.post('/api/admin/login', (req, res) => {
  const ip = req.ip;
  const f = fails.get(ip);
  if (f && f.until > Date.now()) {
    return res.status(429).json({ success: false, message: 'محاولات كثيرة، جرّب بعد 15 دقيقة' });
  }

  const { email, password } = req.body || {};
  if (!db.verifyAdmin(email, password)) {
    const count = ((f && f.until > Date.now()) ? 0 : (f ? f.count : 0)) + 1;
    fails.set(ip, { count, until: count >= 5 ? Date.now() + 15 * 60 * 1000 : 0 });
    return res.status(401).json({ success: false, message: 'بيانات الدخول خاطئة' });
  }

  fails.delete(ip);
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { expires: Date.now() + SESSION_MS });
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  res.setHeader('Set-Cookie',
    `${COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_MS / 1000}${secure}`);
  res.json({ success: true, message: 'تم الدخول بنجاح' });
});

app.post('/api/admin/logout', (req, res) => {
  sessions.delete(getToken(req));
  res.setHeader('Set-Cookie', `${COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`);
  res.json({ success: true });
});

app.get('/api/admin/me', (req, res) => res.json({ admin: isAdmin(req) }));

// ---------- قفل شامل: أي عملية تعديل على /api تحتاج أدمن ----------
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  if (req.path === '/admin/login' || req.path === '/admin/logout') return next();
  return requireAdmin(req, res, next);
});

// ---------- المصادر / البرامج / الدورات: القراءة للجميع، التعديل للأدمن فقط ----------
function crud(route, get, save, prefix) {
  app.get(`/api/${route}`, (req, res) => res.json({ [route]: get() }));

  app.post(`/api/${route}`, (req, res) => {
    const item = { ...req.body, id: db.genId(prefix), createdAt: new Date().toISOString() };
    const list = get();
    list.push(item);
    save(list);
    res.json({ success: true, item });
  });

  app.put(`/api/${route}/:id`, (req, res) => {
    const list = get();
    const i = list.findIndex(x => String(x.id) === req.params.id);
    if (i === -1) return res.status(404).json({ success: false, message: 'غير موجود' });
    list[i] = { ...list[i], ...req.body, id: list[i].id };
    save(list);
    res.json({ success: true, item: list[i] });
  });

  app.delete(`/api/${route}/:id`, (req, res) => {
    const list = get();
    const next = list.filter(x => String(x.id) !== req.params.id);
    if (next.length === list.length) return res.status(404).json({ success: false, message: 'غير موجود' });
    save(next);
    res.json({ success: true });
  });
}

crud('resources', db.getResources, db.saveResources, 'r');
crud('programs', db.getPrograms, db.savePrograms, 'p');
crud('courses', db.getCourses, db.saveCourses, 'c');

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const PORT = process.env.PORT || 5500;
app.listen(PORT, () => console.log(`Server runs on port ${PORT}`));