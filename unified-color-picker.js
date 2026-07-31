/* =========================================================================
   unified-color-picker.js — Color Picker موحّد بأسلوب TradingView
   يُستخدم من كل مكان بالمشروع (drawing.js, tv-settings.js) عبر:

   UnifiedColorPicker.open({
     anchorEl: <HTMLElement>,      // العنصر (الزر) الذي سيُموضَع الـ popup أسفله
     color: '#26a69a',             // اللون الحالي (hex)
     opacity: 100,                 // الشفافية الحالية 0-100
     onChange: (hex, opacity) => {},  // يُستدعى Live مع كل تغيير
     onClose: () => {}             // اختياري — يُستدعى عند إغلاق النافذة
   });
   ========================================================================= */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'tv_unified_custom_colors_v1';
  const MAX_CUSTOM = 20;

  // صف الرمادي (Black -> White)
  const GRAYSCALE = ['#000000', '#1a1a1a', '#363a45', '#4a4e5a', '#5c5f66', '#787b86', '#9598a1', '#b2b5be', '#d1d4dc', '#ffffff'];

  // شبكة الألوان الرئيسية — كل عمود درجة أساسية، كل صف تدرّج فاتح->غامق (7 درجات)
  const HUE_BASE = ['#ec1561', '#9c27b0', '#673ab7', '#2962ff', '#00bcd4', '#009688', '#4caf50', '#cddc39', '#ffc107', '#ff5252'];
  function buildShadeGrid() {
    const rows = [];
    const factors = [0.85, 0.65, 0.45, 0, -0.15, -0.30, -0.45]; // >0 = تفتيح نحو الأبيض، <0 = تغميق نحو الأسود
    factors.forEach(f => {
      rows.push(HUE_BASE.map(hex => shade(hex, f)));
    });
    return rows;
  }
  function shade(hex, factor) {
    const h = hex.replace('#', '');
    let r = parseInt(h.substr(0, 2), 16), g = parseInt(h.substr(2, 2), 16), b = parseInt(h.substr(4, 2), 16);
    if (factor > 0) { r += (255 - r) * factor; g += (255 - g) * factor; b += (255 - b) * factor; }
    else { r *= (1 + factor); g *= (1 + factor); b *= (1 + factor); }
    const toHex = n => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  function loadCustomColors() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch (e) { return []; }
  }
  function saveCustomColor(hex) {
    let arr = loadCustomColors();
    arr = arr.filter(c => c.toLowerCase() !== hex.toLowerCase());
    arr.unshift(hex);
    arr = arr.slice(0, MAX_CUSTOM);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
    return arr;
  }

  function hexToHsv(hex) {
    hex = hex.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255, g = parseInt(hex.substr(2, 2), 16) / 255, b = parseInt(hex.substr(4, 2), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return { h, s: max === 0 ? 0 : (d / max) * 100, v: max * 100 };
  }
  function hsvToHex(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const toHex = n => Math.round((n + m) * 255).toString(16).padStart(2, '0');
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  let popupEl = null;
  let state = null; // { color, opacity, onChange, onClose, hsv:{h,s,v} }

  function close() {
    if (!popupEl) return;
    popupEl.remove();
    popupEl = null;
    document.removeEventListener('mousedown', onOutsideClick, true);
    if (state && state.onClose) state.onClose();
    state = null;
  }
  function onOutsideClick(e) {
    if (popupEl && !popupEl.contains(e.target) && !(state && state.anchorEl && state.anchorEl.contains(e.target))) close();
  }

  function emit() {
    if (state && state.onChange) state.onChange(state.color, state.opacity);
  }

  function swatchBtn(hex, selected) {
    const b = document.createElement('button');
    b.className = 'ucp-swatch' + (selected ? ' selected' : '');
    b.style.background = hex;
    b.addEventListener('click', () => { state.color = hex; state.hsv = hexToHsv(hex); refresh(); emit(); });
    return b;
  }

  function refresh() {
    if (!popupEl) return;
    popupEl.querySelectorAll('.ucp-swatch').forEach(el => {
      el.classList.toggle('selected', el.style.background && rgbToHex(el.style.background).toLowerCase() === state.color.toLowerCase());
    });
    const preview = popupEl.querySelector('.ucp-preview');
    if (preview) preview.style.background = state.color;
    const hexInp = popupEl.querySelector('.ucp-hex-input');
    if (hexInp && document.activeElement !== hexInp) hexInp.value = state.color.replace('#', '');
    const opInp = popupEl.querySelector('.ucp-opacity-num');
    if (opInp) opInp.value = state.opacity + '%';
    const wheelCursor = popupEl.querySelector('.ucp-sv-cursor');
    const hueThumb = popupEl.querySelector('.ucp-hue-thumb');
    if (wheelCursor && hueThumb) {
      wheelCursor.style.left = state.hsv.s + '%';
      wheelCursor.style.top = (100 - state.hsv.v) + '%';
      hueThumb.style.left = (state.hsv.h / 360 * 100) + '%';
      const svSquare = popupEl.querySelector('.ucp-sv-square');
      if (svSquare) svSquare.style.backgroundColor = hsvToHex(state.hsv.h, 100, 100);
    }
  }
  function rgbToHex(rgbStr) {
    if (rgbStr.startsWith('#')) return rgbStr;
    const m = rgbStr.match(/\d+/g);
    if (!m) return '#000000';
    return '#' + m.slice(0, 3).map(n => (+n).toString(16).padStart(2, '0')).join('');
  }

  function open(opts) {
    close();
    state = {
      anchorEl: opts.anchorEl,
      color: opts.color || '#2962FF',
      opacity: opts.opacity != null ? opts.opacity : 100,
      onChange: opts.onChange || function () {},
      onClose: opts.onClose || null
    };
    state.hsv = hexToHsv(state.color);

   const pop = document.createElement('div');
pop.className = 'ucp-popup';
const dragHandle = document.createElement('div');
dragHandle.className = 'ucp-drag-handle';
pop.appendChild(dragHandle);

    // ---- الرمادي ----
    const grayRow = document.createElement('div');
    grayRow.className = 'ucp-gray-row';
    GRAYSCALE.forEach(hex => grayRow.appendChild(swatchBtn(hex)));
    pop.appendChild(grayRow);

    // ---- الشبكة الرئيسية ----
    const grid = document.createElement('div');
    grid.className = 'ucp-grid';
    buildShadeGrid().forEach(rowColors => rowColors.forEach(hex => grid.appendChild(swatchBtn(hex))));
    pop.appendChild(grid);

// ---- Custom Colors ----
    const sep1 = document.createElement('div'); sep1.className = 'ucp-sep'; pop.appendChild(sep1);
    const customLabel = document.createElement('div');
    customLabel.className = 'ucp-section-label';
    customLabel.textContent = 'ألوان محفوظة';
    pop.appendChild(customLabel);
    const customRow = document.createElement('div');
    customRow.className = 'ucp-custom-row';
    
    
    loadCustomColors().forEach(hex => customRow.appendChild(swatchBtn(hex)));
    const addBtn = document.createElement('button');
    addBtn.className = 'ucp-add-btn';
    addBtn.textContent = '+';
    addBtn.title = 'لون مخصص';
    addBtn.addEventListener('click', () => { advView.classList.remove('hidden'); mainView.classList.add('hidden'); });
    customRow.appendChild(addBtn);
    pop.appendChild(customRow);

    // ---- Spectrum / Color Wheel (الشاشة المتقدمة) ----
    const mainViewWrap = document.createElement('div');
    mainViewWrap.className = 'ucp-main-view';
    while (pop.firstChild) mainViewWrap.appendChild(pop.firstChild);
    pop.appendChild(mainViewWrap);
    const mainView = mainViewWrap;

    const advView = document.createElement('div');
    advView.className = 'ucp-adv-view hidden';
    advView.innerHTML =
      '<div class="ucp-adv-header">' +
      '  <button class="ucp-back-btn" title="رجوع">\u2192</button>' +
      '  <div class="ucp-hex-wrap"><span>#</span><input type="text" class="ucp-hex-input" maxlength="6"></div>' +
      '  <div class="ucp-preview"></div>' +
      '  <button class="ucp-confirm-btn">إضافة</button>' +
      '</div>' +
      '<div class="ucp-sv-square"><div class="ucp-sv-cursor"></div></div>' +
      '<div class="ucp-hue-slider"><div class="ucp-hue-thumb"></div></div>';
    pop.appendChild(advView);

    advView.querySelector('.ucp-back-btn').addEventListener('click', () => { advView.classList.add('hidden'); mainView.classList.remove('hidden'); });
    advView.querySelector('.ucp-confirm-btn').addEventListener('click', () => {
      saveCustomColor(state.color);
      advView.classList.add('hidden'); mainView.classList.remove('hidden');
      rebuildCustomRow();
    });
    const hexInp = advView.querySelector('.ucp-hex-input');
    hexInp.addEventListener('input', () => {
      const clean = hexInp.value.replace(/[^0-9a-fA-F]/g, '').slice(0, 6);
      if (clean.length === 6) { state.color = '#' + clean; state.hsv = hexToHsv(state.color); refresh(); emit(); }
    });
    const svSquare = advView.querySelector('.ucp-sv-square');
    const hueSlider = advView.querySelector('.ucp-hue-slider');
    function dragSV(e) {
      const r = svSquare.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      const y = Math.max(0, Math.min(1, (e.clientY - r.top) / r.height));
      state.hsv.s = x * 100; state.hsv.v = (1 - y) * 100;
      state.color = hsvToHex(state.hsv.h, state.hsv.s, state.hsv.v);
      refresh(); emit();
    }
    function dragHue(e) {
      const r = hueSlider.getBoundingClientRect();
      const x = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
      state.hsv.h = x * 360;
      state.color = hsvToHex(state.hsv.h, state.hsv.s, state.hsv.v);
      refresh(); emit();
    }
    bindDrag(svSquare, dragSV);
    bindDrag(hueSlider, dragHue);
    function bindDrag(el, handler) {
      el.addEventListener('mousedown', (e) => {
        handler(e);
        const move = ev => handler(ev);
        const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
        window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
      });
    }

    function rebuildCustomRow() {
      customRow.querySelectorAll('.ucp-swatch').forEach(el => el.remove());
      loadCustomColors().forEach(hex => customRow.insertBefore(swatchBtn(hex), addBtn));
    }

    // ---- الشفافية ----
    const sep2 = document.createElement('div'); sep2.className = 'ucp-sep'; pop.appendChild(sep2);
    const opWrap = document.createElement('div');
    opWrap.className = 'ucp-opacity-row';
    opWrap.innerHTML =
      '<div class="ucp-opacity-label">الشفافية</div>' +
      '<div class="ucp-opacity-controls">' +
      '  <input type="text" class="ucp-opacity-num" value="' + state.opacity + '%">' +
      '  <input type="range" class="ucp-opacity-slider" min="0" max="100" value="' + state.opacity + '">' +
      '</div>';
    pop.appendChild(opWrap);
    const opSlider = opWrap.querySelector('.ucp-opacity-slider');
    const opNum = opWrap.querySelector('.ucp-opacity-num');
    opSlider.addEventListener('input', () => { state.opacity = parseInt(opSlider.value, 10); opNum.value = state.opacity + '%'; emit(); });
    opNum.addEventListener('change', () => {
      const v = Math.max(0, Math.min(100, parseInt(opNum.value, 10) || 0));
      state.opacity = v; opSlider.value = v; opNum.value = v + '%'; emit();
    });

  document.body.appendChild(pop);
popupEl = pop;
bindPopupDrag(dragHandle, pop);

    // تموضع + منع الخروج عن الشاشة (نفس منطق clamp المستخدم بباقي المشروع)
const r = opts.anchorEl.getBoundingClientRect();
pop.style.position = 'fixed';
// نستخدم الأبعاد الفعلية للنافذة بعد إضافتها للـ DOM (وليس ثابتاً
// تقريبياً) — يضمن دقة كاملة على أي حجم شاشة (موبايل/تابلت/لابتوب).
const w = pop.offsetWidth || 316;
const h = pop.offsetHeight || 380;
let left = r.left;
let top = r.bottom + 8;
// إعادة تموضع تلقائي عند الاقتراب من أي حافة
if (left + w > window.innerWidth - 8) left = window.innerWidth - w - 8;
if (left < 8) left = 8;
if (top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 8); // افتح للأعلى بدل الأسفل لو لا مساحة كافية
if (top < 8) top = 8;
pop.style.left = left + 'px';
pop.style.top = top + 'px';

    refresh();
    setTimeout(() => document.addEventListener('mousedown', onOutsideClick, true), 0);
  }

  global.UnifiedColorPicker = { open, close };

})(window);