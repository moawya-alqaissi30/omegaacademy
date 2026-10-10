// app.js - وظائف مشتركة بين كل الصفحات
// لا يوجد تسجيل دخول للزوار. الأدمن فقط يدخل من login.html (كوكي من السيرفر).

async function api(pathname, options = {}) {
  const res = await fetch(pathname, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...options
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}

  // انتهت جلسة الأدمن أو غير مسجّل دخول وحاول يعدّل
  if (res.status === 401 && options.method && options.method !== 'GET') {
    window.location.href = './login.html';
    throw new Error('انتهت الجلسة، سجّل دخولك من جديد');
  }
  if (!res.ok) {
    throw new Error(data.message || data.error || 'حدث خطأ');
  }
  return data;
}

// موجودة فقط حتى لا تتعطل صفحات قديمة تناديها
function getCurrentUser() {
  return null;
}

function initNavbarToggle() {
  const toggle = document.querySelector('.navbar-toggle');
  const links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', () => links.classList.toggle('open'));
  }
}

// الضغط على الشعار أو اسم الموقع يرجّع للصفحة الرئيسية
function initBrandLink() {
  const brand = document.querySelector('.brand');
  if (!brand) return;
  brand.style.cursor = 'pointer';
  brand.setAttribute('role', 'link');
  brand.setAttribute('tabindex', '0');
  brand.setAttribute('aria-label', 'الصفحة الرئيسية');
  const goHome = () => { window.location.href = './index.html'; };
  brand.addEventListener('click', goHome);
  brand.addEventListener('keydown', (e) => { if (e.key === 'Enter') goHome(); });
}

// الشريط العلوي: للزوار ما بيظهر شي. للأدمن بيظهر رابط اللوحة وزر الخروج.
async function renderAuthArea() {
  const area = document.getElementById('auth-area');
  if (!area) return;

  let isAdmin = false;
  try {
    const res = await fetch('/api/admin/me', { credentials: 'same-origin' });
    isAdmin = (await res.json()).admin === true;
  } catch (e) {}

  if (!isAdmin) {
    area.innerHTML = '';
    return;
  }

  area.innerHTML = `
    <a href="./admin.html">لوحة التحكم</a>
    <button class="btn btn-outline btn-small" id="logout-btn" style="margin-right: 5px;">تسجيل الخروج</button>
  `;
  document.getElementById('logout-btn').addEventListener('click', async () => {
    try { await fetch('/api/admin/logout', { method: 'POST', credentials: 'same-origin' }); } catch (e) {}
    window.location.href = './index.html';
  });
}

// أزرار الواجهة الرئيسية (Hero Section)
function renderHeroActions() {
  const heroActions = document.getElementById('hero-actions');
  if (!heroActions) return;
  heroActions.innerHTML = `
    <a href="./resources.html" class="btn btn-orange">تصفح المصادر</a>
    <a href="./programs.html" class="btn btn-outline">البرامج الهندسية</a>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showMsg(el, message, type = 'error') {
  if (!el) return;
  el.textContent = message;
  el.className = `form-msg ${type}`;
}

// حماية الصفحات: الصفحات العامة تمر مباشرة، وصفحة الأدمن تتحقق من السيرفر
function requireAuth({ adminOnly = false } = {}) {
  if (!adminOnly) return { guest: true };
  return fetch('/api/admin/me', { credentials: 'same-origin' })
    .then(r => r.json())
    .then(d => {
      if (d.admin) return { admin: true };
      window.location.href = './login.html';
      return null;
    })
    .catch(() => {
      window.location.href = './login.html';
      return null;
    });
}

document.addEventListener('DOMContentLoaded', () => {
  initNavbarToggle();
  initBrandLink();
  renderAuthArea();
  renderHeroActions();
});