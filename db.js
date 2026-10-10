// db.js
// قاعدة بيانات بسيطة مبنية على ملفات JSON + حساب أدمن واحد فقط (لا يوجد مستخدمون عاديون)

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const filePath = (name) => path.join(DATA_DIR, `${name}.json`);

function readJSON(name, fallback) {
  try { return JSON.parse(fs.readFileSync(filePath(name), 'utf8')); }
  catch (err) { return fallback; }
}

function writeJSON(name, data) {
  fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2), 'utf8');
}

function genId(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomBytes(4).toString('hex')}`;
}

// ---------- حساب الأدمن (واحد فقط) ----------
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function checkPassword(password, stored) {
  const [salt, hash] = String(stored).split(':');
  const test = crypto.scryptSync(String(password), salt, 64);
  const real = Buffer.from(hash, 'hex');
  return real.length === test.length && crypto.timingSafeEqual(real, test);
}

// أول تشغيل: يأخذ البريد وكلمة المرور من المتغيرات ADMIN_EMAIL و ADMIN_PASSWORD،
// وإذا ما انحطّت يولّد كلمة مرور عشوائية ويطبعها مرة وحدة في الطرفية.
function ensureAdmin() {
  if (readJSON('admin', null)) return;
  const email = (process.env.ADMIN_EMAIL || 'admin@omega.academy').toLowerCase();
  let password = process.env.ADMIN_PASSWORD;
  let generated = false;
  if (!password) { password = crypto.randomBytes(9).toString('base64url'); generated = true; }
  writeJSON('admin', { email, passwordHash: hashPassword(password) });
  console.log('تم إنشاء حساب الأدمن:');
  console.log('  البريد:', email);
  if (generated) console.log('  كلمة المرور (انسخها الآن، ما رح تظهر مرة ثانية):', password);
}

function verifyAdmin(email, password) {
  const admin = readJSON('admin', null);
  if (!admin) return false;
  const okEmail = String(email || '').toLowerCase() === admin.email;
  const okPass = checkPassword(password || '', admin.passwordHash); // نفحصها دائماً لتجنب كشف الفرق بالوقت
  return okEmail && okPass;
}

// ---------- المصادر / البرامج / الدورات ----------
const getResources = () => readJSON('resources', []);
const saveResources = (l) => writeJSON('resources', l);
const getPrograms = () => readJSON('programs', []);
const savePrograms = (l) => writeJSON('programs', l);
const getCourses = () => readJSON('courses', []);
const saveCourses = (l) => writeJSON('courses', l);

module.exports = {
  genId, ensureAdmin, verifyAdmin,
  getResources, saveResources,
  getPrograms, savePrograms,
  getCourses, saveCourses
};