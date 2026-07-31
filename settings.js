/* ============================================================
   settings.js
   يدير نافذة الإعدادات ويطبّقها فعلياً على شارت lightweight-charts.

   *** مهم *** لازم تستدعي هذا السطر بملف backtest.js
   مباشرة بعد ما تسوي الشارت والسيريز:

       window.registerChartSettings(chart, candleSeries);

   إذا اسم المتغيرات عندك مختلف (مثلاً myChart / mySeries)
   استخدم نفس الأسماء بس بنفس الترتيب: (الشارت, سيريز الشموع)
   ============================================================ */

(function () {
  "use strict";

  const STORAGE_KEY = "chartSettings_v1";

  const defaults = {
    upColor: "#26a69a",
    downColor: "#ef5350",
    borderVisible: true,
    borderUpColor: "#26a69a",
    borderDownColor: "#ef5350",
    wickVisible: true,
    wickUpColor: "#26a69a",
    wickDownColor: "#ef5350",
    precision: 2,
    bgColor: "#180F24",
    gridColor: "#2b2138",
    gridVisible: true,
    textColor: "#d1d4dc",
    timezoneOffset: 0
  };

  let state = loadState();
  let chartRef = null;
  let seriesRef = null;

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? Object.assign({}, defaults, JSON.parse(raw)) : Object.assign({}, defaults);
    } catch (e) {
      return Object.assign({}, defaults);
    }
  }
  function saveState() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  /* ============ الربط الحقيقي بالشارت ============ */
  // استدعِ هذي الدالة من backtest.js بعد إنشاء الشارت والسيريز
  window.registerChartSettings = function (chart, candleSeries) {
    chartRef = chart;
    seriesRef = candleSeries;
    applyAllToChart();
  };

  function applyAllToChart() {
    if (seriesRef) {
      seriesRef.applyOptions({
        upColor: state.upColor,
        downColor: state.downColor,
        borderVisible: state.borderVisible,
        borderUpColor: state.borderUpColor,
        borderDownColor: state.borderDownColor,
        wickVisible: state.wickVisible,
        wickUpColor: state.wickUpColor,
        wickDownColor: state.wickDownColor,
        priceFormat: {
          type: "price",
          precision: state.precision,
          minMove: 1 / Math.pow(10, state.precision)
        }
      });
    }
    if (chartRef) {
      chartRef.applyOptions({
        layout: {
          background: { color: state.bgColor },
          textColor: state.textColor
        },
        grid: {
          vertLines: { color: state.gridColor, visible: state.gridVisible },
          horzLines: { color: state.gridColor, visible: state.gridVisible }
        }
      });
    }
    
    // خلفية الصفحة أيضاً، حتى قبل ربط السيريز
document.body.style.background = state.bgColor;

// إشعار multichart.js (إن وُجد) بتغيّر الإعدادات حتى يطبّقها على كل
// الشاشات الإضافية أيضاً — مزامنة الإعدادات بين كل الشارتات.
try {
  window.dispatchEvent(new CustomEvent('tvCloneChartSettingsChanged', { detail: Object.assign({}, state) }));
} catch (e) {}
}

  /* ============ عناصر الواجهة ============ */
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    const settingsBtn = document.getElementById("settingsBtn");
    const overlay = document.getElementById("settingsOverlay");
    const closeBtn = document.getElementById("settingsCloseBtn");
    const cancelBtn = document.getElementById("settingsCancelBtn");
    const okBtn = document.getElementById("settingsOkBtn");
    const resetBtn = document.getElementById("settingsResetBtn");

    if (!settingsBtn || !overlay) return; // لو ما ضيف الـ HTML بعد

    let stateBackup = null;

    settingsBtn.addEventListener("click", () => {
      stateBackup = JSON.parse(JSON.stringify(state));
      overlay.classList.remove("hidden");
      refreshUI();
    });
    function close() { overlay.classList.add("hidden"); hidePicker(); }
    closeBtn.addEventListener("click", close);
    cancelBtn.addEventListener("click", () => {
      state = stateBackup ? JSON.parse(JSON.stringify(stateBackup)) : state;
      applyAllToChart();
      refreshUI();
      close();
    });
    okBtn.addEventListener("click", () => { saveState(); applyAllToChart(); close(); });
    resetBtn.addEventListener("click", () => {
      state = Object.assign({}, defaults);
      applyAllToChart();
      refreshUI();
    });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });

    /* ===== التبويبات ===== */
    document.querySelectorAll(".sm-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".sm-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".sm-tabpanel").forEach(p => p.classList.add("hidden"));
        tab.classList.add("active");
        document.querySelector(`.sm-tabpanel[data-panel="${tab.dataset.tab}"]`).classList.remove("hidden");
      });
    });

    /* ===== الخانات (checkboxes) ===== */
    bindCheckbox("ckBorder", "borderVisible");
    bindCheckbox("ckWick", "wickVisible");
    bindCheckbox("ckGrid", "gridVisible");
    // ckShowIndicators / ckAutoStop غير مرتبطة بالشارت مباشرة — تقدر تقرأها بكودك:
    // state.showIndicators / state.autoStop إذا تحتاجها بمنطق الباكتيست

    function bindCheckbox(id, key) {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("click", () => {
        state[key] = !el.classList.contains("checked");
        el.classList.toggle("checked");
        applyAllToChart();
      });
    }

    /* ===== منتقي الألوان ===== */
    const swatchMap = {
      swUpColor: "upColor",
      swDownColor: "downColor",
      swBorderUp: "borderUpColor",
      swBorderDown: "borderDownColor",
      swWickUp: "wickUpColor",
      swWickDown: "wickDownColor",
      swBg: "bgColor",
      swGrid: "gridColor",
      swText: "textColor"
    };
    Object.keys(swatchMap).forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener("click", (e) => { e.stopPropagation(); openPicker(el, swatchMap[id]); });
    });

    /* ===== الدقة ===== */
    const precisionDropdown = document.getElementById("precisionDropdown");
    const precisionOptions = [0, 1, 2, 3, 4, 5];
    if (precisionDropdown) {
      precisionDropdown.addEventListener("click", () => {
        const idx = precisionOptions.indexOf(state.precision);
        const next = precisionOptions[(idx + 1) % precisionOptions.length];
        state.precision = next;
        document.getElementById("precisionLabel").textContent = next + " أرقام عشرية";
        applyAllToChart();
      });
    }

    /* ===== التوقيت =====
       ملاحظة: تغيير التوقيت الفعلي يحتاج تحويل الطوابع الزمنية (timestamps)
       قبل ما تدخل بـ setData بملف backtest.js. هنا بس نخزن رقم الإزاحة
       بـ state.timezoneOffset حتى تربطه بدالة تحميل البيانات عندك. */
    const timezoneDropdown = document.getElementById("timezoneDropdown");
    const tzOptions = [-8, -5, -4, 0, 1, 2, 3, 4];
    if (timezoneDropdown) {
      timezoneDropdown.addEventListener("click", () => {
        const idx = tzOptions.indexOf(state.timezoneOffset);
        const next = tzOptions[(idx + 1) % tzOptions.length];
        state.timezoneOffset = next;
        document.getElementById("timezoneLabel").textContent = "UTC" + (next >= 0 ? "+" + next : next);
      });
    }

    refreshUI();
  }

  function refreshUI() {
    const setSwatch = (id, val) => { const el = document.getElementById(id); if (el) { el.style.background = val; el.dataset.color = val; } };
    setSwatch("swUpColor", state.upColor);
    setSwatch("swDownColor", state.downColor);
    setSwatch("swBorderUp", state.borderUpColor);
    setSwatch("swBorderDown", state.borderDownColor);
    setSwatch("swWickUp", state.wickUpColor);
    setSwatch("swWickDown", state.wickDownColor);
    setSwatch("swBg", state.bgColor);
    setSwatch("swGrid", state.gridColor);
    setSwatch("swText", state.textColor);

    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.classList.toggle("checked", !!val); };
    setCheck("ckBorder", state.borderVisible);
    setCheck("ckWick", state.wickVisible);
    setCheck("ckGrid", state.gridVisible);

    const pLabel = document.getElementById("precisionLabel");
    if (pLabel) pLabel.textContent = state.precision + " أرقام عشرية";
    const tLabel = document.getElementById("timezoneLabel");
    if (tLabel) tLabel.textContent = "UTC" + (state.timezoneOffset >= 0 ? "+" + state.timezoneOffset : state.timezoneOffset);
  }

  /* ============ منتقي الألوان ============ */
  const mainPalette = [
    ["#000000","#1a1a1a","#363a45","#4a4e5a","#5c5f66","#787b86","#9598a1","#b2b5be","#d1d4dc","#ffffff"],
    ["#ec1561","#9c27b0","#673ab7","#2962ff","#00bcd4","#009688","#4caf50","#cddc39","#ffc107","#ff5252"],
    ["#f8bbd0","#e1bee7","#d1c4e9","#bbdefb","#b2ebf2","#b2dfdb","#c8e6c9","#f0f4c3","#ffe0b2","#ffcdd2"],
    ["#f48fb1","#ce93d8","#b39ddb","#90caf9","#80deea","#80cbc4","#a5d6a7","#e6ee9c","#ffcc80","#ef9a9a"],
    ["#f06292","#ba68c8","#9575cd","#64b5f6","#4dd0e1","#4db6ac","#81c784","#dce775","#ffb74d","#e57373"],
    ["#ec407a","#ab47bc","#7e57c2","#42a5f5","#26c6da","#26a69a","#66bb6a","#d4e157","#ffa726","#ef5350"],
    ["#c2185b","#7b1fa2","#512da8","#1565c0","#00838f","#00695c","#2e7d32","#9e9d24","#ef6c00","#c62828"],
    ["#880e4f","#4a148c","#311b92","#0d47a1","#006064","#004d40","#1b5e20","#827717","#e65100","#b71c1c"]
  ];
  const materialPalette = [
    ["#4db6ac","#00897b","#5d4037","#9e9e9e","#f5deb3","#f5f5f5","#5c7a99","#dde3ef","#ffffff","#a5d6d0"],
    ["#8d8b3f","#8f9aa3","#cfd3d9","#00a884","#5c6bc0","#e0b98e","#f0a898","#7e57c2","#ff8a3d","#f2c9a5"]
  ];

  let cpTargetSwatch = null;
  let cpTargetKey = null;
  let cpBuilt = false;
  let customColors = loadCustomColors();

  function loadCustomColors() {
    try { return JSON.parse(localStorage.getItem("chartCustomColors_v1")) || []; }
    catch (e) { return []; }
  }
  function saveCustomColors() {
    try { localStorage.setItem("chartCustomColors_v1", JSON.stringify(customColors)); } catch (e) {}
  }

function buildPickerGrid() {
  if (cpBuilt) return;
  const grid = document.getElementById("cpGridSettings");
  const gridMaterial = document.getElementById("cpGridMaterialSettings");
  
  mainPalette.forEach(row => row.forEach(color => grid.appendChild(makeCell(color))));
  materialPalette.forEach(row => row.forEach(color => gridMaterial.appendChild(makeCell(color))));
  
  document.getElementById("cpAddBtnSettings").addEventListener("click", () => openAdvanced());
  
  renderCustomSwatches();

    // ===== الشاشة المتقدمة =====
const hueSlider = document.getElementById("cpHueSliderSettings");
const hueThumb = document.getElementById("cpHueThumbSettings");
const svSquare = document.getElementById("cpSvSquareSettings");
const svCursor = document.getElementById("cpSvCursorSettings");
const hexInput = document.getElementById("cpHexInputSettings");
const confirmBtn = document.getElementById("cpConfirmBtnSettings");

    let hue = 180, sat = 60, val = 40; // افتراضي

    function updateFromHSV() {
      const hex = hsvToHex(hue, sat, val);
      svSquare.style.backgroundColor = hsvToHex(hue, 100, 100);
      hueThumb.style.top = (hue / 360 * 100) + "%";
      svCursor.style.left = sat + "%";
      svCursor.style.top = (100 - val) + "%";
      hexInput.value = hex.replace("#", "");
      document.getElementById("cpPreviewSwatchSettings").style.background = hex;
    }

    function dragHue(e) {
      const rect = hueSlider.getBoundingClientRect();
      let y = (e.clientY - rect.top) / rect.height;
      y = Math.max(0, Math.min(1, y));
      hue = y * 360;
      updateFromHSV();
    }
    function dragSV(e) {
      const rect = svSquare.getBoundingClientRect();
      let x = (e.clientX - rect.left) / rect.width;
      let y = (e.clientY - rect.top) / rect.height;
      x = Math.max(0, Math.min(1, x));
      y = Math.max(0, Math.min(1, y));
      sat = x * 100;
      val = (1 - y) * 100;
      updateFromHSV();
    }

    function makeDraggable(el, handler) {
      el.addEventListener("mousedown", (e) => {
        handler(e);
        const move = (ev) => handler(ev);
        const up = () => { document.removeEventListener("mousemove", move); document.removeEventListener("mouseup", up); };
        document.addEventListener("mousemove", move);
        document.addEventListener("mouseup", up);
      });
      el.addEventListener("touchstart", (e) => {
        handler(e.touches[0]);
        const move = (ev) => handler(ev.touches[0]);
        const up = () => { document.removeEventListener("touchmove", move); document.removeEventListener("touchend", up); };
        document.addEventListener("touchmove", move);
        document.addEventListener("touchend", up);
      });
    }
    makeDraggable(hueSlider, dragHue);
    makeDraggable(svSquare, dragSV);

    hexInput.addEventListener("input", () => {
      const clean = hexInput.value.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
      if (clean.length === 6) {
        const hsv = hexToHsv("#" + clean);
        hue = hsv.h; sat = hsv.s; val = hsv.v;
        updateFromHSV();
      }
    });

    confirmBtn.addEventListener("click", () => {
      const hex = "#" + hexInput.value.padEnd(6, "0");
      if (!customColors.includes(hex)) {
        customColors.unshift(hex);
        customColors = customColors.slice(0, 10);
        saveCustomColors();
        renderCustomSwatches();
      }
      applyPickedColor(hex);
      closeAdvanced();
    });

    window.__cpSetHSVFromHex = (hex) => {
      const hsv = hexToHsv(hex);
      hue = hsv.h; sat = hsv.s; val = hsv.v;
      updateFromHSV();
    };

    cpBuilt = true;
  }

  function makeCell(color) {
    const cell = document.createElement("button");
    cell.className = "cp-cell";
    cell.style.background = color;
    cell.dataset.color = color;
    cell.addEventListener("click", () => applyPickedColor(color));
    return cell;
  }

  function renderCustomSwatches() {
    const row = document.getElementById("cpCustomRow");
    row.querySelectorAll(".cp-custom-swatch").forEach(el => el.remove());
    customColors.forEach(color => {
      const sw = document.createElement("button");
      sw.className = "cp-custom-swatch";
      sw.style.background = color;
      sw.dataset.color = color;
      sw.addEventListener("click", () => applyPickedColor(color));
      row.appendChild(sw);
    });
  }

function openAdvanced() {
    document.getElementById("cpGridViewSettings").classList.add("hidden");
    document.getElementById("cpAdvancedViewSettings").classList.remove("hidden");
    const current = cpTargetKey ? state[cpTargetKey] : "#2e6365";
    window.__cpSetHSVFromHex(current);
  }
  function closeAdvanced() {
    document.getElementById("cpAdvancedViewSettings").classList.add("hidden");
    document.getElementById("cpGridViewSettings").classList.remove("hidden");
  }

function openPicker(swatchEl, key) {
  buildPickerGrid();
  cpTargetSwatch = swatchEl;
  cpTargetKey = key;
  closeAdvanced();
  const picker = document.getElementById("colorPickerSettings");
   
    const rect = swatchEl.getBoundingClientRect();
    picker.style.top = Math.min(rect.bottom + 8, window.innerHeight - 420) + "px";
    picker.style.left = Math.max(rect.left - 240, 10) + "px";
    picker.classList.remove("hidden");

    document.querySelectorAll("#cpGrid .cp-cell, #cpGridMaterial .cp-cell, .cp-custom-swatch").forEach(c => {
      c.classList.toggle("selected", c.dataset.color === state[key]);
    });
  }
function hidePicker() {
  const picker = document.getElementById("colorPickerSettings");
  if (picker) picker.classList.add("hidden");
    cpTargetSwatch = null;
    cpTargetKey = null;
  }
  function applyPickedColor(color) {
    if (cpTargetKey) state[cpTargetKey] = color;
    if (cpTargetSwatch) { cpTargetSwatch.style.background = color; cpTargetSwatch.dataset.color = color; }
    document.querySelectorAll("#cpGrid .cp-cell, #cpGridMaterial .cp-cell, .cp-custom-swatch").forEach(c => {
      c.classList.toggle("selected", c.dataset.color === color);
    });
    applyAllToChart();
  }

  document.addEventListener("click", (e) => {
  const picker = document.getElementById("colorPickerSettings");
  if (!picker || picker.classList.contains("hidden")) return;
  if (!picker.contains(e.target) && !e.target.classList.contains("sm-swatch")) hidePicker();
});


  /* ===== HSV <-> HEX ===== */
  function hsvToHex(h, s, v) {
    s /= 100; v /= 100;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    const toHex = (n) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
    return "#" + toHex(r) + toHex(g) + toHex(b);
  }
  function hexToHsv(hex) {
    hex = hex.replace("#", "");
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    const s = max === 0 ? 0 : (d / max) * 100;
    const v = max * 100;
    return { h, s, v };
  }

  // نطبّق أي إعدادات محفوظة فوراً على خلفية الصفحة حتى قبل جهوزية الشارت
document.addEventListener("DOMContentLoaded", () => { document.body.style.background = state.bgColor; });

// يسمح لـ multichart.js بقراءة الإعدادات الحالية فوراً عند إنشاء شاشة
// جديدة (بدل انتظار أول تغيير من المستخدم).
window.getChartSettingsState = function() { return Object.assign({}, state); };
})();

window.registerChartSettings(chart, candleSeries);

