/* =========================================================================
   tv-topbar.js — splits the one overcrowded #controls bar into a proper
   TradingView-style layout:

     TOP BAR (#tvTopBar):    symbol, timeframe, drawing tool, layout, sync,
                              correlation, alerts, watchlist, backtest launcher,
                              settings
     BOTTOM BAR (#controls): only the active replay scrubber (prev/play/pause/
                              next/speed) + exit — exactly like TradingView's
                              bottom replay toolbar, which only really matters
                              once you're in replay mode.

   This is pure DOM reparenting (moving existing elements, not recreating
   them), so every event listener already attached by drawing.js / backtest.js
   / multichart.js / alerts.js keeps working untouched.

   Load this LAST, after drawing.js, backtest.js, multichart.js, alerts.js,
   and settings.js — every button it moves must already exist in the DOM.
   ========================================================================= */

(function () {
  'use strict';

  function moveIfExists(topBar, id) {
    const el = document.getElementById(id);
    if (el) topBar.appendChild(el);
  }

  // يستبدل شكل select#pairSelect الأصلي بزر يفتح نفس نافذة البحث الكاملة
// المستخدمة بميزة المقارنة (MultiChartSymbolSearch) — الـ select نفسه
// يبقى بالـ DOM (مخفي بصرياً فقط) حتى يستمر كل كود backtest.js/multichart.js
// اللي يعتمد على value/change event بدون أي تعديل عليه.
// نفس منطق multichart.js لتوليد لون أيقونة ثابت لكل رمز — نسخة محلية
// بدون اعتماد على ترتيب تحميل الملفات.
function symbolIconColorLocal(sym) {
  const palette = ['#2962FF', '#FF6D00', '#26A69A', '#E91E63', '#9C27B0', '#FFC107', '#00BCD4', '#7E57C2', '#43A047', '#EF5350'];
  let hash = 0;
  for (let i = 0; i < sym.length; i++) hash = (hash * 31 + sym.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}

// يبني شارة الرمز (أيقونة دائرية ملونة + اسم الرمز) بأقصى يسار الشريط
// العلوي، بنفس ترتيب TradingView (أيقونة قبل زر "+" مباشرة).
function wrapPairSelectWithSearch(topBar) {
  const pairSelect = document.getElementById('pairSelect');
  if (!pairSelect || pairSelect.dataset.wrapped) return;
  pairSelect.dataset.wrapped = '1';
  pairSelect.classList.add('mc-hidden-select');
  
  const btn = document.createElement('button');
  btn.id = 'tvSymbolBtn';
  btn.className = 'tv-symbol-btn';
  
  const iconEl = document.createElement('span');
  iconEl.className = 'tv-symbol-icon';
  const labelEl = document.createElement('span');
  labelEl.className = 'tv-symbol-label';
  btn.appendChild(iconEl);
  btn.appendChild(labelEl);
  
  function refreshLabel() {
    const sym = pairSelect.value;
    const opt = pairSelect.options[pairSelect.selectedIndex];
    iconEl.textContent = sym.charAt(0);
    iconEl.style.background = symbolIconColorLocal(sym);
    labelEl.textContent = (opt ? opt.textContent : sym);
  }
  refreshLabel();
  pairSelect.addEventListener('change', refreshLabel);
  
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!window.MultiChartSymbolSearch) return;
    window.MultiChartSymbolSearch.open((symbol) => {
      pairSelect.value = symbol;
      pairSelect.dispatchEvent(new Event('change'));
    });
  });
  
  // إدراجه كأول عنصر بأقصى يسار الشريط العلوي (قبل أي شيء آخر بما فيه
  // pairSelect المخفي نفسه)
  if (topBar) topBar.insertBefore(btn, topBar.firstChild);
  else pairSelect.insertAdjacentElement('afterend', btn);
}

// زر "D" يعرض الفريم الحالي المختصر (D/1H/15M...) ويفتح select#timeframeSelect
  // الحقيقي عند الضغط — بنفس شكل TradingView المضغوط.
  function buildIntervalBadge() {
    const tfSelect = document.getElementById('timeframeSelect');
    if (!tfSelect || tfSelect.dataset.badgeWrapped) return;
    tfSelect.dataset.badgeWrapped = '1';
    tfSelect.classList.add('mc-hidden-select');

    const btn = document.createElement('button');
    btn.id = 'tvIntervalBadge';
    btn.className = 'tv-interval-badge';

    const SHORT = { '1': '1M', '3': '3M', '5': '5M', '15': '15M', '30': '30M', '60': '1H', '240': '4H', '1440': 'D', '10080': 'W', '43200': 'M' };
    function refresh() { btn.textContent = SHORT[tfSelect.value] || tfSelect.value; }
    refresh();
    tfSelect.addEventListener('change', refresh);

   btn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (!window.TVTimeframeMenu) return;
  window.TVTimeframeMenu.open(btn, tfSelect.value, (val) => {
    let opt = tfSelect.querySelector('option[value="' + val + '"]');
    if (!opt) {
      opt = document.createElement('option');
      opt.value = String(val);
      opt.textContent = window.TVTimeframeMenu.labelFor(val);
      tfSelect.appendChild(opt);
    }
    tfSelect.value = String(val);
    tfSelect.dispatchEvent(new Event('change'));
  });
});
    
    

    tfSelect.insertAdjacentElement('afterend', btn);
  }

  function init() {
    const controls = document.getElementById('controls');
    if (!controls) return;

    const topBar = document.createElement('div');
    topBar.id = 'tvTopBar';
    document.body.insertBefore(topBar, controls);
// نفس ترتيب الصورة بالضبط:
// أيقونة الرمز + الاسم → + (مقارنة) → D (الفريم) → مؤشرات → Templates(Layout) → Alert → Replay → Undo/Redo → إعدادات
['pairSelect'].forEach(id => moveIfExists(topBar, id));
wrapPairSelectWithSearch(topBar);

// زر "+" لإضافة/مقارنة رمز — يفتح نفس نافذة البحث الكاملة
const plusBtn = document.createElement('button');
    plusBtn.id = 'tvAddCompareBtn';
    plusBtn.className = 'tv-icon-btn';
    plusBtn.title = 'إضافة رمز / مقارنة';
    plusBtn.textContent = '+';
    plusBtn.addEventListener('click', () => {
      if (!window.MultiChart || !window.MultiChart.panes[0]) return;
      window.MultiChartSymbolSearch.open((symbol) => {
        window.MultiChart.panes[0]._openCompareTypePicker(symbol);
      });
    });
    topBar.appendChild(plusBtn);

    moveIfExists(topBar, 'timeframeSelect');
    buildIntervalBadge();

    // Indicators (placeholder — لا يوجد نظام مؤشرات مبني بعد)
    const indBtn = document.createElement('button');
    indBtn.id = 'tvIndicatorsBtn';
    indBtn.className = 'tv-topbar-btn tv-disabled';
    indBtn.title = 'المؤشرات (قريباً)';
    indBtn.textContent = 'Indicators \u25BE';
    topBar.appendChild(indBtn);

    moveIfExists(topBar, 'mcLayoutBtn');
    moveIfExists(topBar, 'alAlertsBtn');
    moveIfExists(topBar, 'backtestBtn');
    moveIfExists(topBar, 'mcSyncBtn');
    moveIfExists(topBar, 'mcCorrBtn');
    moveIfExists(topBar, 'mcWatchlistBtn');

    // Undo / Redo — مربوطة بنظام Undo/Redo الموجود فعلاً بـ drawing.js
    const undoBtn = document.createElement('button');
    undoBtn.id = 'tvUndoBtn';
    undoBtn.className = 'tv-icon-btn';
    undoBtn.title = 'تراجع';
    undoBtn.textContent = '\u21B6';
    undoBtn.addEventListener('click', () => {
      const m = window.DrawingTools && (window.DrawingTools.activeManager || window.DrawingTools.manager);
      if (m) m.undo();
    });
    topBar.appendChild(undoBtn);

    const redoBtn = document.createElement('button');
    redoBtn.id = 'tvRedoBtn';
    redoBtn.className = 'tv-icon-btn';
    redoBtn.title = 'إعادة';
    redoBtn.textContent = '\u21B7';
    redoBtn.addEventListener('click', () => {
      const m = window.DrawingTools && (window.DrawingTools.activeManager || window.DrawingTools.manager);
      if (m) m.redo();
    });
    
    const resetViewBtn = document.createElement('button');
resetViewBtn.id = 'tvResetViewBtn';
resetViewBtn.className = 'tv-icon-btn';
resetViewBtn.title = 'إعادة ضبط العرض';
resetViewBtn.textContent = '\u21BB';
resetViewBtn.addEventListener('click', () => {
  if (window.resetActiveChartView) window.resetActiveChartView();
});
topBar.appendChild(resetViewBtn);
    
    topBar.appendChild(redoBtn);

moveIfExists(topBar, 'settingsBtn');

// ضمان إضافي: أي زر رمز (tvSymbolBtn) ينتهي به المطاف خارج الشريط
// العلوي لأي سبب (سباق تحميل سكربتات، إلخ) يُعاد فوراً لمكانه
// الصحيح — أقصى يسار الشريط العلوي.
fixupSymbolBtnPosition();
setInterval(fixupSymbolBtnPosition, 1000);

// #controls now only keeps backtestControls + exitBacktestBtn (both
// already conditionally hidden/shown by backtest.js's own logic).
}

function fixupSymbolBtnPosition() {
  const topBar = document.getElementById('tvTopBar');
  const symBtn = document.getElementById('tvSymbolBtn');
  if (!topBar || !symBtn) return;
  if (symBtn.parentNode !== topBar || topBar.firstChild !== symBtn) {
    topBar.insertBefore(symBtn, topBar.firstChild);
  }
}

  // Scripts are loaded at the end of <body>, so the DOM (and every other
  // script's buttons) already exist by the time this runs — no need to wait
  // for DOMContentLoaded, but it's harmless to guard for it anyway.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
