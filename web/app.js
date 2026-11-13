(function () {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var API = 'http://localhost:8000';
  var HUBS = {
    grand_rapids: {label: 'Grand Rapids', x: 190, y: 210},
    detroit: {label: 'Detroit', x: 810, y: 210},
    ann_arbor: {label: 'Ann Arbor', x: 500, y: 480}
  };
  var TYPES = {
    individual: {label: 'Individual', color: '#79c0ff', shape: 'circle'},
    startup: {label: 'Startup', color: '#d2a8ff', shape: 'diamond'},
    small_business: {label: 'Small business', color: '#ffa657', shape: 'square'},
    corporation: {label: 'Corporation', color: '#7ee787', shape: 'hex'}
  };
  var RESULT = {
    introduced: {color: '#3fb950', label: 'introduced'},
    declined: {color: '#f0883e', label: 'declined'},
    blocked_by_permissions: {color: '#6e7681', label: 'blocked'}
  };
  var live = /[?&]live=1/.test(location.search);
  var run = null, shown = 0, selected = -1, timer = null, playing = false, busy = false;
  var speed = 1, userPaused = false, pollTimer = null, pollBusy = false, roundBase = null, lastFeedback = null;
  var STEP_MS = 1800, DRAW_MS = 1400, SPEEDS = [0.5, 1, 2];
  var pos = {}, byId = {};
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, attrs, text, ns) {
    var e = ns ? document.createElementNS(NS, tag) : document.createElement(tag);
    for (var k in (attrs || {})) e.setAttribute(k, attrs[k]);
    if (text != null) e.textContent = text;
    return e;
  }
  function add(p, c) { p.appendChild(c); return c; }
  function arr(x) { return Array.isArray(x) ? x : []; }
  function nameOf(id) { return (byId[id] && byId[id].name) || id || '?'; }
  function banner(msg) { var b = $('banner'); b.textContent = msg; b.hidden = !msg; }

  // ---- loading ----
  function loadSample() {
    if (location.protocol === 'file:') return Promise.resolve(window.SAMPLE_RUN);
    return fetch('fixtures/sample_run.json').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    }).catch(function () { return window.SAMPLE_RUN; });
  }
  function loadLive() {
    return fetch(API + '/runs/latest').then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function init() {
    $('modeBadge').textContent = live ? 'live' : 'sample';
    $('btnRound').disabled = !live;
    if (!live) $('btnRound').title = 'Open with ?live=1 and start the API to run a round';
    var p = live ? loadLive().catch(function (e) {
      banner('Live API unavailable (' + e.message + '). Showing the sample run instead. Start it with: make serve');
      $('modeBadge').textContent = 'sample (fallback)';
      $('btnRound').disabled = true;
      return loadSample();
    }) : loadSample();
    p.then(function (r) {
      setRun(r); play();
      if (live && run.status === 'running') startPolling();
    });
  }

  function normalize(r) {
    r = r && typeof r === 'object' ? r : {};
    r.members = arr(r.members); r.meetings = arr(r.meetings); r.introductions = arr(r.introductions);
    return r;
  }
  function index() {
    byId = {};
    run.members.forEach(function (m) { byId[m.id] = m; });
  }
  function isRunning() { return busy || run.status === 'running'; }
  function setRun(r) {
    run = normalize(r);
    lastFeedback = null; userPaused = false;
    index(); layout(); shown = 0; selected = -1;
    if (!run.members.length) banner('This run has no members to show.');
    render();
  }

  // ---- layout ----
  function layout() {
    pos = {};
    var groups = {};
    run.members.forEach(function (m) { (groups[m.hub] = groups[m.hub] || []).push(m); });
    Object.keys(groups).forEach(function (h) {
      var c = HUBS[h] || {x: 500, y: 320}, g = groups[h], n = g.length;
      var r = n === 1 ? 0 : Math.min(125, 50 + n * 12);
      g.forEach(function (m, i) {
        var a = -Math.PI / 2 + (2 * Math.PI * i) / n;
        pos[m.id] = {x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a) * 0.8};
      });
    });
  }

  // ---- drawing ----
  function shape(t, x, y, extra) {
    var s = 11, c = TYPES[t] || {color: '#8b98a7', shape: 'circle'}, e;
    if (c.shape === 'circle') e = el('circle', {cx: x, cy: y, r: s}, null, 1);
    else if (c.shape === 'square') e = el('rect', {x: x - s, y: y - s, width: 2 * s, height: 2 * s, rx: 3}, null, 1);
    else if (c.shape === 'diamond') e = el('polygon', {points: [x, y - s - 3, x + s + 3, y, x, y + s + 3, x - s - 3, y].join(',')}, null, 1);
    else {
      var pts = [];
      for (var i = 0; i < 6; i++) { var a = Math.PI / 3 * i; pts.push((x + (s + 2) * Math.cos(a)).toFixed(1) + ',' + (y + (s + 2) * Math.sin(a)).toFixed(1)); }
      e = el('polygon', {points: pts.join(' ')}, null, 1);
    }
    e.setAttribute('fill', c.color);
    e.setAttribute('stroke', '#0d1117'); e.setAttribute('stroke-width', '2');
    return e;
  }
  function renderMap(animateIdx) {
    var svg = $('map'); svg.textContent = '';
    var active = {};
    for (var i = 0; i < shown; i++) { var m = run.meetings[i]; if (m) { active[m.a] = 1; active[m.b] = 1; } }
    Object.keys(HUBS).forEach(function (h) {
      var c = HUBS[h];
      add(svg, el('circle', {cx: c.x, cy: c.y, r: 160, fill: '#ffffff05', stroke: '#2a323d', 'stroke-dasharray': '4 6'}, null, 1));
      add(svg, el('text', {x: c.x, y: c.y - 172, 'text-anchor': 'middle', class: 'hubname'}, c.label, 1));
    });
    var lines = add(svg, el('g', {}, null, 1));
    run.meetings.slice(0, shown).forEach(function (m, i) {
      var a = pos[m.a], b = pos[m.b]; if (!a || !b) return;
      var col = (RESULT[m.result] || RESULT.blocked_by_permissions).color;
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - 40;
      var d = 'M' + a.x + ',' + a.y + ' Q' + mx + ',' + my + ' ' + b.x + ',' + b.y;
      var len = Math.hypot(b.x - a.x, b.y - a.y) * 1.2;
      var g = add(lines, el('g', {}, null, 1));
      var p = add(g, el('path', {d: d, stroke: col, 'stroke-width': i === selected ? 5 : 3, class: 'mline' + (i === animateIdx ? ' draw' : ''), opacity: selected >= 0 && i !== selected ? 0.55 : 1}, null, 1));
      if (i === animateIdx) { p.style.setProperty('--len', len); p.style.setProperty('--dur', (DRAW_MS / speed / 1000) + 's'); }
      var hit = add(g, el('path', {d: d, class: 'hit'}, null, 1));
      hit.addEventListener('click', function () { select(i); });
      var t = el('title', {}, nameOf(m.a) + ' + ' + nameOf(m.b) + ': ' + m.result, 1); hit.appendChild(t);
    });
    run.members.forEach(function (m) {
      var p = pos[m.id]; if (!p) return;
      var g = add(svg, el('g', {opacity: active[m.id] ? 1 : 0.6}, null, 1));
      add(g, shape(m.type, p.x, p.y));
      add(g, el('text', {x: p.x, y: p.y + 28, class: 'mname'}, m.name || m.id, 1));
      add(g, el('title', {}, (m.name || m.id) + ' - ' + (m.sector || '') + ' (' + (TYPES[m.type] ? TYPES[m.type].label : m.type) + ')', 1));
    });
  }
  function renderStats() {
    var s = run.stats || {}, box = $('stats'); box.textContent = '';
    [['pairs_scored', 'pairs scored'], ['passed_filter', 'passed filter'], ['meetings', 'meetings'], ['introductions', 'introductions']].forEach(function (k) {
      var sp = add(box, el('span')); add(sp, el('b', {}, s[k[0]] != null ? s[k[0]] : '-')); sp.appendChild(document.createTextNode(k[1]));
    });
  }
  function renderLegend() {
    var lg = $('legend'); lg.textContent = '';
    Object.keys(TYPES).forEach(function (t) {
      var sp = add(lg, el('span')), sv = add(sp, el('svg', {viewBox: '0 0 28 28'}, null, 1));
      add(sv, shape(t, 14, 14)); sp.appendChild(document.createTextNode(TYPES[t].label));
    });
    Object.keys(RESULT).forEach(function (k) {
      var sp = add(lg, el('span')), d = add(sp, el('i', {class: 'dot'}));
      d.style.background = RESULT[k].color; sp.appendChild(document.createTextNode('meeting ' + RESULT[k].label));
    });
  }
  function renderList() {
    var ol = $('meetingList'); ol.textContent = '';
    if (!run.meetings.length) { add(ol, el('li', {class: 'empty'}, 'No meetings in this run.')); return; }
    run.meetings.forEach(function (m, i) {
      var r = RESULT[m.result] || RESULT.blocked_by_permissions;
      var li = add(ol, el('li', {class: (i === selected ? 'sel ' : '') + (i >= shown ? 'future' : '')}));
      var d = add(li, el('i', {class: 'dot'})); d.style.background = i < shown ? r.color : '#444c56';
      add(li, el('span', {}, nameOf(m.a) + '  +  ' + nameOf(m.b)));
      var res = add(li, el('span', {class: 'res'}, i < shown ? r.label : 'pending')); if (i < shown) res.style.color = r.color;
      li.addEventListener('click', function () { select(i); });
    });
  }
  function renderDetail() {
    var box = $('detail'); box.textContent = '';
    var h = add(box, el('h2', {}, 'Selected meeting ')); add(h, el('span', {class: 'ai-tag'}, 'AI-generated transcript'));
    var m = run.meetings[selected];
    if (!m || selected >= shown) { add(box, el('div', {class: 'empty'}, run.meetings.length ? 'Press Play, or click a meeting, to read the conversation.' : 'Nothing to show.')); return; }
    var r = RESULT[m.result] || RESULT.blocked_by_permissions;
    var t = add(box, el('div', {}, nameOf(m.a) + ' + ' + nameOf(m.b) + '  '));
    t.style.fontWeight = '700';
    var rs = add(t, el('span', {class: 'res'}, r.label)); rs.style.color = r.color;
    if (arr(m.blocked).length) add(box, el('div', {class: 'evidence'}, 'Blocked by permissions: ' + m.blocked.map(nameOf).join(', ') + ' (no introduction sent).'));
    var cand = m.candidate || (run.candidates || []).filter(function (c) { return c.a === m.a && c.b === m.b; })[0];
    if (cand) {
      var ev = (cand.evidence || [])[0];
      add(box, el('div', {class: 'evidence'}, 'Why scouted: fit ' + cand.fit + ', novelty ' + cand.novelty + (cand.label ? ' (' + cand.label + ')' : '') + (ev ? ' - ' + nameOf(ev.need_of) + ' needs "' + ev.need + '"; ' + nameOf(ev.offer_of) + ' offers "' + ev.offer + '"' : '')));
    }
    if (!arr(m.transcript).length) add(box, el('div', {class: 'empty'}, 'No transcript recorded.'));
    arr(m.transcript).forEach(function (tn) {
      var d = add(box, el('div', {class: 'turn' + (tn.speaker === m.b ? ' b' : '')}));
      add(d, el('div', {class: 'who'}, nameOf(tn.speaker) + ' agent, turn ' + tn.turn + ' (AI-generated)'));
      add(d, el('div', {}, tn.text || ''));
    });
    var vs = add(box, el('div', {class: 'votes'}));
    var oc = null;
    [m.a, m.b].forEach(function (id) {
      var v = (m.votes || {})[id];
      var d = add(vs, el('div', {class: 'vote ' + (v ? v.vote : '')}));
      add(d, el('div', {}, nameOf(id)));
      add(d, el('div', {class: 'v'}, v ? 'Vote: ' + v.vote : 'No vote'));
      if (v) add(d, el('div', {}, v.reason || ''));
    });
    if (live && m.result === 'introduced') {
      oc = add(box, el('div', {class: 'outcomes'}));
      add(oc, el('div', {class: 'evidence'}, 'Record an outcome (updates the weights):'));
      ['pilot', 'hire', 'partnership', 'no_follow_up'].forEach(function (o) {
        var b = add(oc, el('button', {class: 'oc'}, o.replace('_', ' ')));
        b.addEventListener('click', function () { sendFeedback(m, o, b); });
      });
    }
  }
  function sendFeedback(m, outcome, btn) {
    btn.disabled = true;
    fetch(API + '/feedback', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({meeting_id: m.id, outcome: outcome})})
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (f) { lastFeedback = {meeting: m, outcome: outcome, before: f.weights_before, after: f.weights_after}; renderWeights(); banner(''); })
      .catch(function (e) { btn.disabled = false; banner('Could not record the outcome (' + e.message + ').'); });
  }
  // J6: before/after weights (CONTRACTS: key "kind|label", multiplier clamped 0.5-1.5, missing = 1.0)
  function renderWeights() {
    var card = $('weightsCard'), box = $('weights'); box.textContent = '';
    var before = lastFeedback ? lastFeedback.before : run.weights_before;
    var after = lastFeedback ? lastFeedback.after : run.weights_after;
    before = before && typeof before === 'object' ? before : {};
    after = after && typeof after === 'object' ? after : {};
    var keys = Object.keys(before).concat(Object.keys(after).filter(function (k) { return !(k in before); }));
    card.hidden = !keys.length;
    if (!keys.length) return;
    add(box, el('div', {class: 'evidence'}, lastFeedback
      ? 'After outcome "' + lastFeedback.outcome.replace('_', ' ') + '" for ' + nameOf(lastFeedback.meeting.a) + ' + ' + nameOf(lastFeedback.meeting.b).replace(/\.$/, '') + '. Higher weight means the scout favors that kind of pairing.'
      : 'Scout weights before and after this round\'s recorded outcomes. Higher weight means the scout favors that kind of pairing.'));
    keys.sort(function (a, b) {
      var da = Math.abs(w(after, a) - w(before, a)), db = Math.abs(w(after, b) - w(before, b));
      return db - da || (a < b ? -1 : 1);
    });
    keys.forEach(function (k) {
      var b = w(before, k), a = w(after, k), d = a - b;
      var row = add(box, el('div', {class: 'wrow' + (Math.abs(d) > 0.0005 ? ' changed' : '')}));
      add(row, el('div', {class: 'wkey'}, k.replace('|', ' / ')));
      var bars = add(row, el('div', {class: 'wbars'}));
      [['before', b], ['after', a]].forEach(function (p) {
        var t = add(bars, el('div', {class: 'wbar ' + p[0]})), f = add(t, el('i'));
        f.style.width = Math.max(2, Math.min(100, (p[1] - 0.5) * 100)) + '%';
        if (p[0] === 'after' && d) f.style.background = d > 0 ? 'var(--ok)' : 'var(--bad)';
      });
      var num = add(row, el('div', {class: 'wnum'}, b.toFixed(2) + ' \u2192 ' + a.toFixed(2) + (d ? '  (' + (d > 0 ? '+' : '') + d.toFixed(2) + ')' : '  (unchanged)')));
      if (d) num.style.color = d > 0 ? 'var(--ok)' : 'var(--bad)';
    });
  }
  function w(o, k) { return typeof o[k] === 'number' ? o[k] : 1; }
  function renderOutbox() {
    var box = $('outbox'); box.textContent = '';
    var visible = {};
    run.meetings.slice(0, shown).forEach(function (m) { visible[m.id] = 1; });
    var msgs = run.introductions.filter(function (x) { return visible[x.meeting_id]; });
    if (!msgs.length) { add(box, el('div', {class: 'empty'}, 'No introductions sent yet.')); return; }
    msgs.forEach(function (x) {
      var d = add(box, el('div', {class: 'msg'}));
      add(d, el('div', {class: 'to'}, 'To ' + nameOf(x.to) + ' from ' + (x.from_agent || 'agent') + ' (AI-generated)'));
      add(d, el('div', {}, x.message || ''));
    });
  }
  function renderProgress() {
    $('progress').textContent = 'Meeting ' + shown + ' of ' + run.meetings.length + (isRunning() ? '+' : '');
    $('runInd').hidden = !(pollTimer || busy);
    $('btnSpeed').textContent = speed + '\u00d7';
    $('btnPlay').innerHTML = playing ? '&#10074;&#10074; Pause' : (shown >= run.meetings.length && shown > 0 && !isRunning() ? '&#8634; Replay' : '&#9654; Play');
    $('btnBack').disabled = shown === 0;
    $('btnFwd').disabled = shown >= run.meetings.length;
    $('btnRestart').disabled = shown === 0 && !playing;
    $('btnRound').textContent = busy ? 'Running...' : 'Run a round';
    if (busy) $('btnRound').disabled = true; else if (live && !/unavailable/.test($('banner').textContent)) $('btnRound').disabled = false;
  }
  function render(animateIdx) {
    renderStats(); renderLegend(); renderMap(animateIdx); renderList(); renderDetail(); renderOutbox(); renderWeights(); renderProgress();
  }

  // ---- replay ----
  function select(i) { if (i >= shown) shown = i + 1; selected = i; render(); }
  function stop() { playing = false; clearInterval(timer); timer = null; }
  function forward() {
    if (shown >= run.meetings.length) { if (!isRunning()) stop(); render(); return; }
    shown++; selected = shown - 1; render(shown - 1);
    if (shown >= run.meetings.length && !isRunning()) stop(), renderProgress();
  }
  function back() { if (shown > 0) { shown--; selected = shown - 1; render(); } }
  function play() {
    stop();
    if (!run.meetings.length) { render(); return; }
    if (shown >= run.meetings.length) { shown = 0; selected = -1; }
    playing = true; render();
    userPaused = false;
    timer = setInterval(forward, STEP_MS / speed);
    if (shown === 0) forward();
  }
  function setSpeed() {
    speed = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    if (playing) { clearInterval(timer); timer = setInterval(forward, STEP_MS / speed); }
    renderProgress();
  }
  function restart() { stop(); userPaused = true; shown = 0; selected = -1; render(); }

  // ---- live polling (backend rewrites runs/latest after each meeting; status running|complete) ----
  function startPolling() { if (!pollTimer) { pollTimer = setInterval(pollOnce, 1500); renderProgress(); } }
  function stopPolling() { clearInterval(pollTimer); pollTimer = null; renderProgress(); }
  function pollOnce() {
    if (pollBusy) return;
    pollBusy = true;
    loadLive().then(function (r) { pollBusy = false; applyUpdate(r, false); }, function () { pollBusy = false; });
  }
  function applyUpdate(r, final) {
    r = normalize(r);
    // While a round is starting, latest still holds the previous run: ignore it.
    if (busy && !final && roundBase !== null && r.run_id === roundBase) return;
    if (r.run_id && run.run_id && r.run_id !== run.run_id) { setRun(r); play(); }
    else {
      var grew = r.members.length !== run.members.length;
      run = r;
      if (grew) { index(); layout(); }
      if (!playing && !userPaused && shown < run.meetings.length) {
        playing = true; timer = setInterval(forward, STEP_MS / speed);
      }
      render();
    }
    if (!busy && run.status !== 'running') stopPolling();
  }

  function runRound() {
    if (!live || busy) return;
    busy = true; stop(); roundBase = run.run_id || null; renderProgress(); banner(''); startPolling();
    fetch(API + '/round', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: '{}'})
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function () { return loadLive(); })
      .then(function (r) { busy = false; applyUpdate(r, true); })
      .catch(function (e) { busy = false; stopPolling(); banner('Could not run a round (' + e.message + '). Is the API running on ' + API + '?'); render(); });
  }

  $('btnPlay').addEventListener('click', function () { playing ? (userPaused = true, stop(), render()) : play(); });
  $('btnSpeed').addEventListener('click', setSpeed);
  $('btnPitch').addEventListener('click', togglePitch);
  // Pitch mode hides the chrome; real fullscreen where the browser allows it, else just the layout.
  function togglePitch() {
    var on = !document.body.classList.contains('pitch');
    document.body.classList.toggle('pitch', on);
    var d = document.documentElement;
    try {
      if (on && d.requestFullscreen) d.requestFullscreen().catch(function () {});
      else if (!on && document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
    } catch (e) { /* layout-only fallback */ }
  }
  document.addEventListener('fullscreenchange', function () {
    if (!document.fullscreenElement) document.body.classList.remove('pitch');
  });
  $('btnFwd').addEventListener('click', function () { userPaused = true; stop(); forward(); render(); });
  $('btnBack').addEventListener('click', function () { userPaused = true; stop(); back(); });
  $('btnRestart').addEventListener('click', restart);
  $('btnRound').addEventListener('click', runRound);
  document.addEventListener('keydown', function (e) {
    if (e.key === ' ') { e.preventDefault(); $('btnPlay').click(); }
    else if (e.key === 'ArrowRight') $('btnFwd').click();
    else if (e.key === 'ArrowLeft') $('btnBack').click();
    else if (e.key === 'f' || e.key === 'F') togglePitch();
    else if (e.key === 'Escape' && document.body.classList.contains('pitch')) togglePitch();
  });
  init();
})();
