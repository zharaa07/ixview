/* =========================================================================
   tv-right-sidebar.js — الشريط الجانبي الأيمن بنفس ترتيب TradingView

   يربط الأزرار الوظيفية بالأنظمة الموجودة (Alerts/Watchlist/Correlation/
   Layout/Object Tree)، والباقي أزرار معطّلة بنفس المكان.

   Load this AFTER alerts.js, multichart.js, drawing.js.
   ========================================================================= */

(function(global) {
  'use strict';
  
  const TOP_GROUP = [
    ['tvrsObjTree', '\u{1F4D6}', 'شجرة الكائنات', 'objtree'],
    ['tvrsAlerts', '\u23F0', 'التنبيهات', 'alerts'],
    ['tvrsWatch', '\u25C6', 'قائمة المراقبة', 'watchlist'],
    ['tvrsChat', '\u{1F4AC}', 'تعليقات', 'disabled']
  ];
  
  const MID_GROUP = [
    ['tvrsCompass', '\u{1F9ED}', 'استكشاف', 'disabled'],
    ['tvrsCorr', '\u25B2', 'الارتباط', 'correlation'],
    ['tvrsCal', '\u{1F4C5}', 'التقويم الاقتصادي', 'disabled'],
    ['tvrsBroad', '\u{1F4E1}', 'بث', 'disabled'],
    ['tvrsBell', '\u{1F514}', 'تنبيه سريع', 'alerts'],
    ['tvrsGrid', '\u25A6', 'تخطيط الشاشات', 'layout']
  ];
  
  const BOTTOM_GROUP = [
    ['tvrsHelp', '?', 'مساعدة', 'disabled']
  ];
  
  function makeBtn(id, icon, title, type) {
    const btn = document.createElement('button');
    btn.id = id;
    btn.className = 'tvrs-btn' + (type === 'disabled' ? ' tvrs-disabled' : '');
    btn.title = type === 'disabled' ? title + ' (قريباً)' : title;
    btn.innerHTML = '<span>' + icon + '</span>';
    
    if (type === 'disabled') { return btn; }
    
    btn.addEventListener('click', () => {
      if (type === 'objtree') {
        const m = (global.DrawingTools && global.DrawingTools.activeManager) || (global.DrawingTools && global.DrawingTools.manager);
        if (m) m._openObjectTree();
      } else if (type === 'alerts') {
        const b = document.getElementById('alAlertsBtn');
        if (b) b.click();
      } else if (type === 'watchlist') {
        const b = document.getElementById('mcWatchlistBtn');
        if (b) b.click();
      } else if (type === 'correlation') {
        const b = document.getElementById('mcCorrBtn');
        if (b) b.click();
      } else if (type === 'layout') {
        const b = document.getElementById('mcLayoutBtn');
        if (b) b.click();
      }
    });
    return btn;
  }
  
  function hideOldButtonsFromTopBar() {
    // الأزرار القديمة بالشريط العلوي أصبحت مكررة الآن — نخفيها بدل حذفها
    // (تبقى تعمل لو استُدعيت برمجياً، فقط غير ظاهرة بمكانين بنفس الوقت)
    ['alAlertsBtn', 'mcWatchlistBtn', 'mcCorrBtn', 'mcLayoutBtn'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('tvrs-hidden-old');
    });
  }
  
  function build() {
    if (document.getElementById('tvRightSidebar')) return;
    const bar = document.createElement('div');
    bar.id = 'tvRightSidebar';
    
    const topWrap = document.createElement('div');
    topWrap.className = 'tvrs-group';
    TOP_GROUP.forEach(([id, icon, title, type]) => topWrap.appendChild(makeBtn(id, icon, title, type)));
    bar.appendChild(topWrap);
    
    const midWrap = document.createElement('div');
    midWrap.className = 'tvrs-group';
    MID_GROUP.forEach(([id, icon, title, type]) => midWrap.appendChild(makeBtn(id, icon, title, type)));
    bar.appendChild(midWrap);
    
    const spacer = document.createElement('div');
    spacer.className = 'tvrs-spacer';
    bar.appendChild(spacer);
    
    const bottomWrap = document.createElement('div');
    bottomWrap.className = 'tvrs-group';
    BOTTOM_GROUP.forEach(([id, icon, title, type]) => bottomWrap.appendChild(makeBtn(id, icon, title, type)));
    bar.appendChild(bottomWrap);
    
    document.body.appendChild(bar);
    hideOldButtonsFromTopBar();
  }
  
  function init() {
    build();
    setTimeout(build, 400);
  }
  
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  
})(window);