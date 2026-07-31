/* =========================================================================
   alerts.js — Alerts System (item 16)

   Alert types:
     - Price Alert:      fires when price crosses/goes above/below a fixed level.
     - Cross Alert:       generic version of the drawing-based alerts below —
                           lets you pick ANY existing drawing regardless of type.
     - Trendline Alert:   fires when price crosses the (sloped) trendline value
                           at that point in time.
     - Fib Alert:         fires when price crosses a chosen Fibonacci level.
     - Rectangle Alert:   fires when price crosses the rectangle's Top or
                           Bottom edge.
     - Drawing Alert:     same engine, kept as a distinctly-labeled option for
                           any other single-point-anchored drawing.

   Data source: window.getBacktestState() (exposed by the backtest.js patch)
   for the current bar, and window.DrawingTools.manager.drawings for
   trendline/fib/rectangle price levels.

   Load this AFTER drawing.js and backtest.js.
   ========================================================================= */

(function (global) {
  'use strict';

  function currentBar(state) {
    if (!state || !state.allData || !state.allData.length) return null;
    if (state.isBacktest && state.currentIndex < state.allData.length) return state.allData[state.currentIndex];
    return state.allData[state.allData.length - 1];
  }

  // Computes the price a given drawing "represents" at a specific time —
  // interpolated along the slope for trend lines, the chosen level for Fib,
  // the chosen edge for rectangles, otherwise its anchor point's price.
  function drawingTriggerPrice(d, time, opt) {
    if (!d || !d.points || !d.points.length) return null;
    if (d.type === 'trendline' || d.type === 'ray' || d.type === 'extline') {
      const p0 = d.points[0], p1 = d.points[1];
      if (!p1 || p1.time === p0.time) return p0.price;
      const ratio = (time - p0.time) / (p1.time - p0.time);
      return p0.price + (p1.price - p0.price) * ratio;
    }
    if (d.type === 'fib') {
      const p0 = d.points[0], p1 = d.points[1];
      if (!p1) return null;
      const lvl = (d.fibLevels || [])[opt && opt.levelIndex] || (d.fibLevels || []).find(l => l.enabled);
      if (!lvl) return null;
      const ratio = d.reverse ? (1 - lvl.value) : lvl.value;
      return p0.price + (p1.price - p0.price) * ratio;
    }
    if (d.type === 'rect' || d.type === 'erect') {
      const p0 = d.points[0], p1 = d.points[1];
      if (!p1) return p0.price;
      return (opt && opt.edge === 'bottom') ? Math.min(p0.price, p1.price) : Math.max(p0.price, p1.price);
    }
    return d.points[0].price;
  }

  function drawingLabel(d) {
    return d.customName || (d.type + ' \u2022 ' + String(d.id).slice(-4));
  }

  let notifyPermissionAsked = false;
  function ensureNotifyPermission() {
    if (notifyPermissionAsked || typeof Notification === 'undefined') return;
    notifyPermissionAsked = true;
    if (Notification.permission === 'default') Notification.requestPermission();
  }

  const Alerts = {
    list: [],
    fired: [],
    panelEl: null,

    init() {
      this._buildButton();
      this._buildPanel();
      this._startEngine();
    },

    _buildButton() {
      const btn = document.createElement('button');
      btn.id = 'alAlertsBtn';
      btn.textContent = 'Alerts';
      btn.addEventListener('click', (e) => { e.stopPropagation(); this.panelEl.classList.toggle('hidden'); this._renderList(); });
      const controlsBar = document.getElementById('controls');
      if (controlsBar) controlsBar.appendChild(btn); else document.body.appendChild(btn);
      this.btnEl = btn;
    },

    _buildPanel() {
      const panel = document.createElement('div');
      panel.id = 'alPanel';
      panel.className = 'hidden';
      panel.addEventListener('click', (e) => e.stopPropagation());

      const header = document.createElement('div');
      header.className = 'al-header';
      header.textContent = 'Alerts';
      panel.appendChild(header);

      panel.appendChild(this._buildCreateForm());

      const tabsRow = document.createElement('div');
      tabsRow.className = 'al-tabs';
      const activeTab = document.createElement('button');
      activeTab.className = 'al-tab active';
      activeTab.textContent = 'Active';
      const firedTab = document.createElement('button');
      firedTab.className = 'al-tab';
      firedTab.textContent = 'Triggered';
      activeTab.addEventListener('click', () => { this.view = 'active'; activeTab.classList.add('active'); firedTab.classList.remove('active'); this._renderList(); });
      firedTab.addEventListener('click', () => { this.view = 'fired'; firedTab.classList.add('active'); activeTab.classList.remove('active'); this._renderList(); });
      tabsRow.appendChild(activeTab); tabsRow.appendChild(firedTab);
      panel.appendChild(tabsRow);

      const list = document.createElement('div');
      list.className = 'al-list';
      panel.appendChild(list);
      this._listEl = list;
      this.view = 'active';

      document.body.appendChild(panel);
      this.panelEl = panel;
      document.addEventListener('click', () => panel.classList.add('hidden'));
    },

    _buildCreateForm() {
      const form = document.createElement('div');
      form.className = 'al-form';

      const typeSel = document.createElement('select');
      [['price', 'Price Alert'], ['cross', 'Cross Alert'], ['trendline', 'Trendline Alert'],
       ['fib', 'Fib Alert'], ['rect', 'Rectangle Alert'], ['drawing', 'Drawing Alert']]
        .forEach(([val, label]) => {
          const o = document.createElement('option'); o.value = val; o.textContent = label;
          typeSel.appendChild(o);
        });
      form.appendChild(typeSel);

      const priceRow = document.createElement('div');
      priceRow.className = 'al-form-row';
      const priceInp = document.createElement('input');
      priceInp.type = 'number'; priceInp.step = 'any'; priceInp.placeholder = 'Target price';
      priceRow.appendChild(priceInp);
      form.appendChild(priceRow);

      const drawingRow = document.createElement('div');
      drawingRow.className = 'al-form-row hidden';
      const drawingSel = document.createElement('select');
      drawingRow.appendChild(drawingSel);
      const extraSel = document.createElement('select');
      extraSel.className = 'hidden';
      drawingRow.appendChild(extraSel);
      form.appendChild(drawingRow);

      const condSel = document.createElement('select');
      [['crosses', 'Crosses'], ['above', 'Goes Above'], ['below', 'Goes Below']].forEach(([val, label]) => {
        const o = document.createElement('option'); o.value = val; o.textContent = label;
        condSel.appendChild(o);
      });
      form.appendChild(condSel);

      const msgInp = document.createElement('input');
      msgInp.type = 'text'; msgInp.placeholder = 'Message (optional)';
      form.appendChild(msgInp);

      const refreshDrawingOptions = () => {
        const mgr = global.DrawingTools && global.DrawingTools.manager;
        drawingSel.innerHTML = '';
        extraSel.innerHTML = '';
        extraSel.classList.add('hidden');
        if (!mgr) return;
        let filterFn = () => true;
        if (typeSel.value === 'trendline') filterFn = d => ['trendline', 'ray', 'extline'].includes(d.type);
        else if (typeSel.value === 'fib') filterFn = d => d.type === 'fib';
        else if (typeSel.value === 'rect') filterFn = d => ['rect', 'erect'].includes(d.type);
        mgr.drawings.filter(filterFn).forEach(d => {
          const o = document.createElement('option'); o.value = d.id; o.textContent = drawingLabel(d);
          drawingSel.appendChild(o);
        });
        if (typeSel.value === 'fib') {
          extraSel.classList.remove('hidden');
          const d = mgr.drawings.find(x => x.id === drawingSel.value);
          (d && d.fibLevels || []).forEach((lvl, i) => {
            const o = document.createElement('option'); o.value = i; o.textContent = lvl.value.toFixed(3);
            extraSel.appendChild(o);
          });
        } else if (typeSel.value === 'rect') {
          extraSel.classList.remove('hidden');
          [['top', 'Top Price'], ['bottom', 'Bottom Price']].forEach(([val, label]) => {
            const o = document.createElement('option'); o.value = val; o.textContent = label;
            extraSel.appendChild(o);
          });
        }
      };

      typeSel.addEventListener('change', () => {
        const isPrice = typeSel.value === 'price';
        priceRow.classList.toggle('hidden', !isPrice);
        drawingRow.classList.toggle('hidden', isPrice);
        if (!isPrice) refreshDrawingOptions();
      });

      const createBtn = document.createElement('button');
      createBtn.className = 'al-create-btn';
      createBtn.textContent = 'Create Alert';
      createBtn.addEventListener('click', () => {
        ensureNotifyPermission();
        const type = typeSel.value;
        if (type === 'price') {
          const target = parseFloat(priceInp.value);
          if (isNaN(target)) return;
          this.list.push({
            id: 'al' + Date.now(), type: 'price', targetPrice: target,
            condition: condSel.value, message: msgInp.value || ('Price ' + condSel.value + ' ' + target),
            triggered: false, _prevClose: null
          });
        } else {
          const mgr = global.DrawingTools && global.DrawingTools.manager;
          const d = mgr && mgr.drawings.find(x => x.id === drawingSel.value);
          if (!d) return;
          const opt = {};
          if (type === 'fib') opt.levelIndex = Number(extraSel.value || 0);
          if (type === 'rect') opt.edge = extraSel.value || 'top';
          this.list.push({
            id: 'al' + Date.now(), type, drawingId: d.id, opt, condition: condSel.value,
            message: msgInp.value || (type + ' alert on ' + drawingLabel(d)),
            triggered: false, _prevClose: null
          });
        }
        priceInp.value = ''; msgInp.value = '';
        this._renderList();
      });
      form.appendChild(createBtn);

      typeSel.dispatchEvent(new Event('change'));
      return form;
    },

    _startEngine() {
      setInterval(() => {
        if (!global.getBacktestState) return;
        const state = global.getBacktestState();
        const bar = currentBar(state);
        if (!bar) return;
        this.list.forEach(a => { if (!a.triggered) this._checkAlert(a, bar); });
      }, 500);
    },

    _checkAlert(a, bar) {
      let target;
      if (a.type === 'price') {
        target = a.targetPrice;
      } else {
        const mgr = global.DrawingTools && global.DrawingTools.manager;
        const d = mgr && mgr.drawings.find(x => x.id === a.drawingId);
        if (!d) return; // drawing was deleted — leave the alert dormant rather than guessing
        target = drawingTriggerPrice(d, bar.time, a.opt);
      }
      if (target == null) return;
      const prev = a._prevClose;
      a._prevClose = bar.close;
      if (prev == null) return;
      let fired = false;
      if (a.condition === 'above' && bar.close >= target && prev < target) fired = true;
      else if (a.condition === 'below' && bar.close <= target && prev > target) fired = true;
      else if (a.condition === 'crosses' && ((prev < target && bar.close >= target) || (prev > target && bar.close <= target))) fired = true;
      if (fired) this._trigger(a, bar, target);
    },

    _trigger(a, bar, level) {
      a.triggered = true;
      a.firedAt = bar.time;
      a.firedPrice = bar.close;
      a.firedLevel = level;
      this.fired.unshift(a);
      this.list = this.list.filter(x => x !== a);
      this._showToast(a.message + '  (' + bar.close.toFixed(5) + ')');
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        try { new Notification('Alert triggered', { body: a.message }); } catch (e) {}
      }
      this._renderList();
    },

    _showToast(text) {
      const toast = document.createElement('div');
      toast.className = 'al-toast';
      toast.textContent = '\u{1F514} ' + text;
      document.body.appendChild(toast);
      setTimeout(() => toast.classList.add('show'), 10);
      setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 5000);
    },

    _renderList() {
      if (!this._listEl) return;
      this._listEl.innerHTML = '';
      const items = this.view === 'active' ? this.list : this.fired;
      if (!items.length) {
        const empty = document.createElement('div');
        empty.className = 'al-empty';
        empty.textContent = this.view === 'active' ? 'No active alerts' : 'No alerts triggered yet';
        this._listEl.appendChild(empty);
        return;
      }
      items.forEach(a => {
        const row = document.createElement('div');
        row.className = 'al-row';
        const msg = document.createElement('span');
        msg.className = 'al-row-msg';
        msg.textContent = a.message;
        row.appendChild(msg);
        if (this.view === 'active') {
          const delBtn = document.createElement('button');
          delBtn.className = 'al-row-del';
          delBtn.textContent = '\u2715';
          delBtn.addEventListener('click', () => { this.list = this.list.filter(x => x !== a); this._renderList(); });
          row.appendChild(delBtn);
        } else {
          const when = document.createElement('span');
          when.className = 'al-row-when';
          when.textContent = a.firedPrice != null ? ('@ ' + a.firedPrice.toFixed(5)) : '';
          row.appendChild(when);
        }
        this._listEl.appendChild(row);
      });
    }
  };

  global.MultiChartAlerts = Alerts;
  Alerts.init();

})(window);
