(function (global) {
  'use strict';

  const GROUPS = [
    { key: 'ticks', label: 'تيكات', items: [['tick1000','1000T'],['tick100','100T'],['tick10','10T'],['tick1','1T']] },
    { key: 'seconds', label: 'ثواني', items: [['sec1','1 ث'],['sec5','5 ث'],['sec10','10 ث'],['sec15','15 ث'],['sec30','30 ث'],['sec45','45 ث']] },
    { key: 'minutes', label: 'دقائق', items: [[1,'1 دق'],[3,'3 دق'],[5,'5 دق'],[10,'10 دق'],[15,'15 دق'],[30,'30 دق'],[45,'45 دق']] },
    { key: 'hours', label: 'ساعات', items: [[60,'1 س'],[120,'2 س'],[180,'3 س'],[240,'4 س'],[360,'6 س'],[480,'8 س'],[720,'12 س']] },
    { key: 'days', label: 'أيام', items: [[1440,'يوم'],[7200,'5 أيام']] },
    { key: 'weeks', label: 'أسابيع', items: [[10080,'1 أسبوع']] },
    { key: 'months', label: 'أشهر', items: [[43200,'1 شهر'],[129600,'3 أشهر'],[259200,'6 أشهر'],[518400,'12 شهر']] }
  ];

  const FAV_KEY = 'tv_tf_favorites_v1';
  function getFavs() { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '["1","5","15","60","240","1440"]'); } catch (e) { return []; } }
  function toggleFav(val) {
    let f = getFavs();
    f = f.includes(String(val)) ? f.filter(x => x !== String(val)) : f.concat([String(val)]);
    localStorage.setItem(FAV_KEY, JSON.stringify(f));
    return f;
  }
  function labelFor(val) {
    for (const g of GROUPS) { const it = g.items.find(i => String(i[0]) === String(val)); if (it) return it[1]; }
    return val + '';
  }

  let menuEl = null;
  function close() { if (menuEl) { menuEl.remove(); menuEl = null; document.removeEventListener('mousedown', onOutside, true); } }
  function onOutside(e) { if (menuEl && !menuEl.contains(e.target) && e.target.id !== 'tvIntervalBadge') close(); }

  function open(anchorEl, currentValue, onPick) {
    close();
    const menu = document.createElement('div');
    menu.className = 'tvtf-menu';

    const searchWrap = document.createElement('div');
    searchWrap.className = 'tvtf-search-wrap';
    searchWrap.innerHTML = '<input type="text" class="tvtf-search" placeholder="بحث...">';
    menu.appendChild(searchWrap);

    const body = document.createElement('div');
    body.className = 'tvtf-body';
    menu.appendChild(body);

    function renderFavorites() {
      const favs = getFavs();
      if (!favs.length) return;
      const sec = document.createElement('div');
      sec.className = 'tvtf-section';
      sec.innerHTML = '<div class="tvtf-section-title">المفضلة</div>';
      const grid = document.createElement('div');
      grid.className = 'tvtf-grid';
      favs.forEach(v => grid.appendChild(makeChip(v, labelFor(v), true)));
      sec.appendChild(grid);
      body.appendChild(sec);
    }

    function makeChip(val, label, isFav) {
      const chip = document.createElement('button');
      chip.className = 'tvtf-chip' + (String(val) === String(currentValue) ? ' active' : '');
      chip.innerHTML = (isFav ? '<span class="tvtf-star active">\u2605</span>' : '<span class="tvtf-star">\u2606</span>') + '<span>' + label + '</span>';
      chip.querySelector('.tvtf-star').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFav(val);
        renderAll();
      });
      chip.addEventListener('click', () => { onPick(val); close(); });
      return chip;
    }

    function renderAll() {
      body.innerHTML = '';
      renderFavorites();
      GROUPS.forEach(g => {
        const sec = document.createElement('div');
        sec.className = 'tvtf-section';
        sec.innerHTML = '<div class="tvtf-section-title">' + g.label + '</div>';
        const grid = document.createElement('div');
        grid.className = 'tvtf-grid';
        g.items.forEach(([v, l]) => grid.appendChild(makeChip(v, l, getFavs().includes(String(v)))));
        sec.appendChild(grid);
        body.appendChild(sec);
      });
      const customBtn = document.createElement('button');
      customBtn.className = 'tvtf-custom-btn';
      customBtn.textContent = 'إضافة فاصل زمني مخصص';
      customBtn.addEventListener('click', () => {
        const mins = prompt('أدخل الفريم بالدقائق:', '');
        const n = parseInt(mins, 10);
        if (n > 0) { onPick(n); close(); }
      });
      body.appendChild(customBtn);
    }
    renderAll();

    searchWrap.querySelector('.tvtf-search').addEventListener('input', (e) => {
      const q = e.target.value.trim();
      body.querySelectorAll('.tvtf-section').forEach(sec => {
        let any = false;
        sec.querySelectorAll('.tvtf-chip').forEach(chip => {
          const match = !q || chip.textContent.includes(q);
          chip.style.display = match ? '' : 'none';
          if (match) any = true;
        });
        sec.style.display = any ? '' : 'none';
      });
    });

    document.body.appendChild(menu);
    menuEl = menu;
    const r = anchorEl.getBoundingClientRect();
    menu.style.position = 'fixed';
    const w = menu.offsetWidth || 320;
    let left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8));
    let top = r.bottom + 6;
    if (top + 420 > window.innerHeight) top = Math.max(8, window.innerHeight - 428);
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
    setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);
  }

  global.TVTimeframeMenu = { open, close, labelFor };
})(window);