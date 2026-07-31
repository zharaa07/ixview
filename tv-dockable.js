/* =========================================================================
   tv-dockable.js — نظام مواضع حرة لكل أزرار الشريط (Docking System)

   ثلاث مناطق إرساء: أعلى (الشريط الحالي) / أسفل / يسار.
   وضع "تخصيص" يُفعَّل بزر عائم — أثناء تفعيله كل زر قابل للسحب لأي منطقة،
   والموضع يُحفظ بـ localStorage ويُستعاد تلقائياً عند إعادة فتح الصفحة.

   Load this LAST, after tv-topbar.js.
   ========================================================================= */

(function (global) {
  'use strict';

  const STORAGE_KEY = 'tv_dock_assignments_v1';
const DOCKABLE_IDS = [
  'pairSelect', 'timeframeSelect',
  'mcSyncBtn', 'backtestBtn', 'settingsBtn'
];
  const EXCLUDE_IDS = ['pairSelect']; // مخفي أصلاً (استُبدل بزر tvSymbolBtn)

  let customizeMode = false;
  let assignments = {};
  let dockTop, dockBottom, dockLeft, zonesEl;

  function loadAssignments() {
    try { assignments = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { assignments = {}; }
  }
  function saveAssignments() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(assignments)); } catch (e) {}
  }

  function buildDocks() {
    dockTop = document.getElementById('tvTopBar');
    dockBottom = document.createElement('div');
    dockBottom.id = 'tvDockBottom';
    document.body.appendChild(dockBottom);
    dockLeft = document.createElement('div');
    dockLeft.id = 'tvDockLeft';
    document.body.appendChild(dockLeft);
  }

  function buildZones() {
    zonesEl = document.createElement('div');
    zonesEl.id = 'tvDockZones';
    zonesEl.className = 'hidden';
    zonesEl.innerHTML =
      '<div class="tv-dock-zone tv-dock-zone-top" data-zone="top"><span>أعلى</span></div>' +
      '<div class="tv-dock-zone tv-dock-zone-left" data-zone="left"><span>يسار</span></div>' +
      '<div class="tv-dock-zone tv-dock-zone-bottom" data-zone="bottom"><span>أسفل</span></div>';
    document.body.appendChild(zonesEl);
  }

  function buildCustomizeToggle() {
    const btn = document.createElement('button');
    btn.id = 'tvDockCustomizeBtn';
    btn.title = 'تخصيص مواضع الأزرار';
    btn.textContent = '\u2699';
    btn.addEventListener('click', () => setCustomizeMode(!customizeMode));
    document.body.appendChild(btn);
  }

  function setCustomizeMode(on) {
    customizeMode = on;
    document.body.classList.toggle('tv-dock-customizing', on);
    document.getElementById('tvDockCustomizeBtn').classList.toggle('active', on);
  }

  function dockElFor(name) {
    if (name === 'bottom') return dockBottom;
    if (name === 'left') return dockLeft;
    return dockTop;
  }

  function applyAssignment(el, dockName) {
    const target = dockElFor(dockName);
    if (target && el.parentNode !== target) target.appendChild(el);
  }

  function makeDockable(el) {
    if (!el || !el.id || el.dataset.dockBound) return;
    el.dataset.dockBound = '1';

    const saved = assignments[el.id];
    if (saved) applyAssignment(el, saved);

    let dragging = false, moved = false, startX = 0, startY = 0, ghost = null;

    function onDown(e) {
      if (!customizeMode) return;
      const p = e.touches ? e.touches[0] : e;
      dragging = true; moved = false;
      startX = p.clientX; startY = p.clientY;
      zonesEl.classList.remove('hidden');
      e.preventDefault();
      e.stopPropagation();
    }
    function onMove(e) {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      const dx = p.clientX - startX, dy = p.clientY - startY;
      if (!moved && Math.hypot(dx, dy) > 6) moved = true;
      if (!moved) return;

      if (!ghost) {
        ghost = el.cloneNode(true);
        ghost.removeAttribute('id');
        ghost.className = (ghost.className || '') + ' tv-dock-ghost';
        document.body.appendChild(ghost);
      }
      ghost.style.left = (p.clientX - ghost.offsetWidth / 2) + 'px';
      ghost.style.top = (p.clientY - ghost.offsetHeight / 2) + 'px';

      zonesEl.querySelectorAll('.tv-dock-zone').forEach(z => z.classList.remove('hover'));
      const under = document.elementFromPoint(p.clientX, p.clientY);
      const zone = under && under.closest ? under.closest('.tv-dock-zone') : null;
      if (zone) zone.classList.add('hover');
    }
    function onUp(e) {
      if (!dragging) return;
      dragging = false;
      if (moved) {
        const p = e.changedTouches ? e.changedTouches[0] : e;
        const under = document.elementFromPoint(p.clientX, p.clientY);
        const zone = under && under.closest ? under.closest('.tv-dock-zone') : null;
        if (zone) {
          const dockName = zone.dataset.zone;
          applyAssignment(el, dockName);
          assignments[el.id] = dockName;
          saveAssignments();
        }
      }
      if (ghost) { ghost.remove(); ghost = null; }
      zonesEl.querySelectorAll('.tv-dock-zone').forEach(z => z.classList.remove('hover'));
      zonesEl.classList.add('hidden');
    }

    el.addEventListener('mousedown', onDown);
    el.addEventListener('touchstart', onDown, { passive: false });
    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchend', onUp);

    // أثناء وضع التخصيص، نمنع النقرة العادية من تنفيذ فعل الزر (فتح قائمة...)
    // حتى لا يتعارض السحب مع الوظيفة الأصلية للزر.
    el.addEventListener('click', (e) => {
      if (customizeMode) { e.stopPropagation(); e.preventDefault(); }
    }, true);
  }

  function scanAndBindAll() {
    DOCKABLE_IDS.filter(id => EXCLUDE_IDS.indexOf(id) === -1).forEach(id => {
      const el = document.getElementById(id);
      if (el) makeDockable(el);
    });
  }

  function init() {
    loadAssignments();
    buildDocks();
    buildZones();
    buildCustomizeToggle();
    scanAndBindAll();
    // فحص دوري خفيف يلتقط أزرار قد تُضاف لاحقاً ديناميكياً (مثل drawBtn
    // بشاشات المقارنة الإضافية).
   let dockScanCount = 0;
const dockScanTimer = setInterval(() => {
  scanAndBindAll();
  dockScanCount++;
  // يكفي 5 محاولات (10 ثواني) لالتقاط أي زر يُضاف ديناميكياً متأخراً
  // (مثل drawBtn لشاشات المقارنة) — بعدها لا داعي للاستمرار للأبد.
  if (dockScanCount >= 5) clearInterval(dockScanTimer);
}, 2000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})(window);