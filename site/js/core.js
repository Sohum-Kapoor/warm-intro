/* Warm Intro site — shared data access and helpers. Classic script (works from file://). */
(function () {
  'use strict';
  var WI = (window.WI = window.WI || {});
  var D = window.WARM_INTRO || window.WARM_INTRO_FALLBACK || {};
  var FB = window.WARM_INTRO_FALLBACK || {};

  // Full profiles: run data first, then fill missing fields (deal-breakers, budget, permissions) from profiles.json.
  var byId = {};
  (FB.members || []).forEach(function (m) { byId[m.id] = Object.assign({}, m); });
  (D.members || []).forEach(function (m) { byId[m.id] = Object.assign({}, byId[m.id] || {}, m); });
  [D.demo_run, D.network_run].forEach(function (r) {
    ((r && r.members) || []).forEach(function (m) { if (!byId[m.id]) byId[m.id] = Object.assign({}, m); });
  });

  WI.data = D;
  WI.isFallback = !!window.WARM_INTRO_IS_FALLBACK;
  WI.members = Object.keys(byId).sort().map(function (k) { return byId[k]; });
  WI.network = D.network_run || D.demo_run || { stats: {}, candidates: [], meetings: [], introductions: [] };
  WI.demo = D.demo_run || WI.network;
  WI.asks = Array.isArray(D.asks) ? D.asks : [];
  WI.learning = D.learning || {};

  WI.member = function (id) { return byId[id] || { id: id, name: id, type: '', hub: '' }; };
  WI.name = function (id) { return WI.member(id).name || id; };
  WI.HUBS = { detroit: 'Detroit', grand_rapids: 'Grand Rapids', ann_arbor: 'Ann Arbor' };
  WI.TYPES = { individual: 'Individual', startup: 'Startup', small_business: 'Small business', corporation: 'Corporation' };
  WI.hub = function (h) { return WI.HUBS[h] || h || ''; };
  WI.type = function (t) { return WI.TYPES[t] || t || ''; };
  WI.initials = function (name) {
    return String(name || '?').replace(/[^A-Za-z .&]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
  };
  WI.kindLabel = function (key) {
    var parts = String(key).split('|');
    var kinds = parts[0].split('-').map(function (t) { return WI.type(t).toLowerCase(); });
    return { pair: kinds.join(' × '), label: parts[1] || '' };
  };
  WI.fmt = function (n, d) { return (typeof n === 'number') ? n.toFixed(d == null ? 2 : d) : '–'; };

  WI.esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  WI.h = function (html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; };

  // Motion and screenshot mode.
  var qs = new URLSearchParams(location.search);
  WI.shot = qs.has('shot');
  WI.reduced = WI.shot || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (WI.reduced) document.documentElement.classList.add('no-motion');
  WI.wait = function (ms) { return new Promise(function (r) { setTimeout(r, WI.reduced ? 0 : ms); }); };

  // Run `fn` once when `el` first scrolls into view (immediately in reduced/shot mode).
  WI.onView = function (el, fn, threshold) {
    if (!el) return;
    if (WI.reduced || !('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.disconnect(); fn(); } });
    }, { threshold: threshold == null ? 0.25 : threshold });
    io.observe(el);
  };

  WI.revealAll = function () {
    var els = document.querySelectorAll('.reveal:not(.in)');
    if (WI.reduced || !('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (e) { io.observe(e); });
  };

  WI.countUp = function (el, to, ms) {
    if (WI.reduced) { el.textContent = to.toLocaleString(); return; }
    var t0 = performance.now();
    (function tick(t) {
      var p = Math.min(1, (t - t0) / (ms || 1400));
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e).toLocaleString();
      if (p < 1) requestAnimationFrame(tick);
    })(t0);
  };

  // A meeting rendered as chat bubbles. `rightId` decides which agent sits on the right.
  WI.bubble = function (turn, rightId) {
    var m = WI.member(turn.speaker);
    var right = turn.speaker === rightId;
    return WI.h(
      '<div class="bubble-row' + (right ? ' right' : '') + '">' +
        '<span class="avatar sm' + (right ? '' : ' alt') + '" aria-hidden="true">' + WI.esc(WI.initials(m.name)) + '</span>' +
        '<div class="bubble"><div class="by">Agent for ' + WI.esc(m.name) + ' <span class="ai-tag">AI agent</span></div>' + WI.esc(turn.text) + '</div>' +
      '</div>');
  };

  WI.playChat = function (container, transcript, rightId, gap) {
    container.innerHTML = '';
    var token = {};
    container._token = token;
    var i = 0;
    function next() {
      if (container._token !== token) return Promise.resolve(false);
      if (i >= transcript.length) return Promise.resolve(true);
      var t = transcript[i++];
      if (WI.reduced) { container.appendChild(WI.bubble(t, rightId)); return next(); }
      var typing = WI.h('<div class="bubble-row' + (t.speaker === rightId ? ' right' : '') + '"><span class="avatar sm' + (t.speaker === rightId ? '' : ' alt') + '" aria-hidden="true">' + WI.esc(WI.initials(WI.name(t.speaker))) + '</span><span class="typing" aria-label="agent is typing"><i></i><i></i><i></i></span></div>');
      container.appendChild(typing);
      return WI.wait(gap || 1100).then(function () {
        if (container._token !== token) return false;
        typing.replaceWith(WI.bubble(t, rightId));
        return WI.wait(500).then(next);
      });
    }
    return next();
  };

  WI.voteCard = function (id, v) {
    var yes = v && v.vote === 'yes';
    return '<div class="vote ' + (yes ? 'yes' : 'no') + '"><div class="vhead"><span class="vwho">Agent for ' + WI.esc(WI.name(id)) + '</span><span class="v">' + (yes ? 'YES' : 'NO') + '</span></div>' +
      '<p>' + WI.esc(v ? v.reason : '') + '</p><span class="ai-tag">AI-generated vote</span></div>';
  };

  var inits = [];
  WI.register = function (fn) { inits.push(fn); };
  var errors = 0;
  window.addEventListener('error', function () { document.documentElement.dataset.wiErrors = ++errors; });
  WI.start = function () {
    inits.forEach(function (fn) {
      try { fn(); } catch (e) {
        document.documentElement.dataset.wiErrors = ++errors;
        if (window.console) console.error('[warm-intro]', fn.name, e);
      }
    });
    document.documentElement.dataset.wiReady = '1';
    WI.revealAll();
  };
})();
