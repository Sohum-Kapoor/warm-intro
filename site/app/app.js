/* Warm Intro · My agent — UI. Talks only to WI.store (see data.js). All data text goes through textContent. */
(function () {
  'use strict';

  var WI = window.WI, LS = WI.LS;
  var TABS = ['ask', 'activity', 'connections', 'profile'];
  var TYPE = { individual: 'Individual', startup: 'Startup', small_business: 'Small business', corporation: 'Corporation' };
  var TYPE_LONG = { individual: 'Student or professional', startup: 'Startup', small_business: 'Small business or manufacturer', corporation: 'Corporation' };
  var HUB = { detroit: 'Detroit', grand_rapids: 'Grand Rapids', ann_arbor: 'Ann Arbor', statewide: 'Statewide' };
  var OUTCOMES = [['pilot', 'Pilot'], ['hire', 'Hire'], ['partnership', 'Partnership'], ['no_follow_up', 'No follow-up']];
  var PERMS = {
    share_profile: ['Share my profile in meetings', 'Your agent may describe your needs and offers to another member’s agent during a first meeting.'],
    propose_meetings: ['Propose meetings on its own', 'Your agent may start first meetings when it finds a strong fit. Off: it meets only when you ask.'],
    contact_member: ['Bring me introductions', 'After both agents vote yes, your agent may message you with the introduction. Off: it records the result and stays quiet.']
  };
  var EXAMPLE_ABOUT = 'I’m a mechanical engineering student in Ann Arbor, graduating next spring. I’m looking for a paid part-time role at a hardware or robotics startup. I can offer CAD design, Python scripting and about 15 hours a week. I won’t take unpaid roles.';
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var params = new URLSearchParams(location.search);
  var S = {
    info: null, tab: 'ask', memberId: null, member: null, activity: null, askResult: null, askBusy: false, askError: null,
    draft: null, dirty: false, saveMsg: null, saveErr: null, expanded: {}, resources: null, onboard: null, busyFeedback: {}
  };

  // ---------- DOM helpers ----------
  function h(tag, props) {
    var el = document.createElement(tag);
    if (props) for (var k in props) {
      var v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
      else if (k === 'value') el.value = v;
      else if (k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'selected') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) { c.forEach(function (x) { append(el, x); }); return; }
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function $(id) { return document.getElementById(id); }
  function aiTag(text) { return h('span', { class: 'tag tag-ai', title: 'Written by an AI agent' }, text || 'AI-generated'); }
  function synthTag() { return h('span', { class: 'tag tag-synth' }, 'Synthetic'); }
  function realTag() { return h('span', { class: 'tag tag-real' }, 'Real organisation · not a member'); }
  function ownTag() { return h('span', { class: 'tag tag-own' }, 'Your own words'); }
  function memberTag(m) { return m && m.user_created ? ownTag() : synthTag(); }
  function initials(name) {
    return String(name || '?').replace(/[^A-Za-z0-9 ]/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase() || '?';
  }
  function avatar(m, size) {
    return h('span', { class: 'avatar avatar-' + ((m && m.type) || 'x') + (size ? ' avatar-' + size : ''), 'aria-hidden': 'true' }, initials(m && m.name));
  }
  function metaLine(m) {
    if (!m) return '';
    return [TYPE[m.type] || m.type, HUB[m.hub] || m.hub, m.sector].filter(Boolean).join(' · ');
  }
  function fmt(n) { return typeof n === 'number' ? n.toFixed(2) : n; }
  function toast(msg) {
    var t = $('toast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }
  function notice(msg, kind, action) {
    var n = $('notice');
    n.textContent = '';
    if (!msg) { n.hidden = true; return; }
    n.hidden = false; n.className = 'notice notice-' + (kind || 'info');
    append(n, [h('span', { class: 'notice-text' }, msg),
      action ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm notice-action', onclick: function () { n.hidden = true; action.fn(); } }, action.label) : null,
      h('button', { type: 'button', class: 'notice-x', 'aria-label': 'Dismiss notice', onclick: function () { n.hidden = true; } }, '×')]);
  }
  /* Calm handling of the live API's guard rails: 403 (seeded member needs the presenter key) and 429 (agent busy). */
  function apiErrorNotice(err) {
    if (err && err.status === 403) {
      notice(err.message, 'info', { label: 'Create your own agent', fn: function () { openCreate(); } });
      return true;
    }
    if (err && err.status === 429) {
      notice(err.message + (err.retryAfter ? '' : ' Please try again shortly.'), 'info');
      return true;
    }
    return false;
  }
  function apiErrorText(err, prefix) {
    return err && (err.status === 403 || err.status === 429) ? err.message : (prefix || '') + (err && err.message);
  }
  function syncUrl() {
    try {
      var p = new URLSearchParams(location.search);
      p.set('tab', S.tab); if (S.memberId) p.set('member', S.memberId);
      p.delete('ask'); p.delete('step'); p.delete('key');
      history.replaceState(null, '', location.pathname + '?' + p.toString() + location.hash);
    } catch (e) { /* file:// or sandboxed: ignore */ }
  }

  function members() { return WI.store.members(); }
  function byId(id) { return members().filter(function (m) { return m.id === id; })[0] || null; }
  function nameOf(id) { var m = byId(id); return m ? m.name : id; }
  function isLive() { return WI.store.mode === 'live'; }
  function modeKey() { return isLive() ? 'live' : 'demo'; }

  // connection state (local in both modes): status of an introduction, keyed by the pair
  function connKey(other) { return 'wi.conn.' + modeKey() + '.' + S.memberId + '.' + other; }
  function connGet(other) { return LS.get(connKey(other), {}) || {}; }
  function connSet(other, patch) {
    var c = Object.assign(connGet(other), patch); LS.set(connKey(other), c);
    connMem[connKey(other)] = c; return c;
  }
  var connMem = {};
  var _connGet = connGet;
  connGet = function (other) { var v = _connGet(other); return Object.keys(v).length ? v : (connMem[connKey(other)] || {}); };

  // ---------- header ----------
  function renderHeader() {
    var sel = $('persona');
    sel.textContent = '';
    var all = members();
    sel.appendChild(h('option', { value: '__create' }, '+ Create your agent'));
    var own = all.filter(function (m) { return m.user_created; });
    var demo = all.filter(function (m) { return m.demo && !m.user_created; });
    var rest = all.filter(function (m) { return !m.demo && !m.user_created; }).sort(function (a, b) { return a.name.localeCompare(b.name); });
    function group(label, list) {
      if (!list.length) return;
      var g = h('optgroup', { label: label });
      list.forEach(function (m) { g.appendChild(h('option', { value: m.id, selected: m.id === S.memberId }, m.name + ' — ' + (TYPE[m.type] || m.type) + ', ' + (HUB[m.hub] || m.hub))); });
      sel.appendChild(g);
    }
    group('Created by you', own);
    group('Demo members (synthetic)', demo);
    group('All members (synthetic)', rest);
    sel.value = S.memberId || '';

    var paused = !!(S.member && S.member.paused);
    var tg = $('agentToggle');
    tg.setAttribute('aria-checked', String(!paused));
    tg.classList.toggle('is-paused', paused);
    tg.querySelector('.agent-toggle-text').textContent = paused ? 'Agent paused' : 'Agent active';
    tg.title = paused ? 'Your agent takes no new meetings. Click to resume.' : 'Your agent is scouting and taking first meetings. Click to pause.';

    var pill = $('modePill');
    if (isLive()) {
      var p = S.info && S.info.provider;
      pill.textContent = p === 'watsonx' ? 'Live · IBM Granite' : 'Live · ' + (p || 'API') + ' model';
      pill.className = 'mode-pill is-live';
    } else {
      pill.textContent = 'Demo data';
      pill.className = 'mode-pill';
    }
    $('demoNote').hidden = isLive();

    document.querySelectorAll('#tabs [role=tab]').forEach(function (b) {
      var on = b.getAttribute('data-tab') === S.tab;
      b.setAttribute('aria-selected', String(on));
      b.tabIndex = on ? 0 : -1;
    });
    var badge = $('connBadge');
    var fresh = S.activity ? S.activity.introductions.filter(function (i) { var c = connGet(i.counterpart.id); return !c.status && !c.outcome; }).length : 0;
    badge.hidden = !fresh; badge.textContent = fresh ? String(fresh) : '';
    badge.setAttribute('aria-label', fresh + ' new');
  }

  // ---------- shared pieces ----------
  function evidenceLine(c, viewer) {
    var e = (c.evidence || [])[0];
    if (!e) return null;
    function who(id, verb) { return id === viewer ? 'You ' + verb.you : nameOf(id) + ' ' + verb.they; }
    return h('p', { class: 'why' },
      h('span', { class: 'why-k' }, 'Why'),
      h('span', null, who(e.need_of, { you: 'need', they: 'needs' }), ' “', h('em', null, e.need), '”'),
      h('span', { class: 'why-arrow', 'aria-label': 'matches' }, ' ↔ '),
      h('span', null, who(e.offer_of, { you: 'offer', they: 'offers' }), ' “', h('em', null, e.offer), '”'));
  }
  function scoreChips(c) {
    var out = [h('span', { class: 'mini' }, 'Fit ' + fmt(c.fit))];
    if (typeof c.score === 'number' && c.label !== 'keyword overlap') out.push(h('span', { class: 'mini' }, 'Score ' + fmt(c.score)));
    if (c.label) out.push(h('span', { class: 'mini mini-' + c.label.replace(/\s+/g, '-') }, c.label));
    if (c.cross_hub) out.push(h('span', { class: 'mini' }, 'cross-hub'));
    return h('div', { class: 'minis' }, out);
  }
  function candidateCard(c, viewer, rank) {
    var otherId = c.a === viewer ? c.b : c.a;
    var o = byId(otherId) || { id: otherId, name: otherId };
    return h('li', { class: 'cand' },
      h('div', { class: 'cand-head' },
        rank != null ? h('span', { class: 'rank', 'aria-label': 'Rank ' + rank }, String(rank)) : null,
        avatar(o),
        h('div', { class: 'cand-id' }, h('strong', null, o.name), h('span', { class: 'muted small' }, metaLine(o))),
        memberTag(o)),
      evidenceLine(c, viewer),
      scoreChips(c));
  }

  var RESULT = {
    introduced: ['ok', 'Introduced', 'Both agents voted yes, so an introduction was made.'],
    declined: ['no', 'Declined', 'At least one agent voted no. No introduction; the reasons are kept.'],
    blocked_by_permissions: ['warn', 'Blocked by permissions', 'An agent’s permissions didn’t allow it to go further.']
  };
  function resultBadge(r) { var x = RESULT[r] || ['warn', r]; return h('span', { class: 'badge badge-' + x[0] }, x[1]); }

  function transcriptView(m, viewer, animate) {
    var list = h('ol', { class: 'chat', 'aria-label': 'Meeting transcript, AI-generated' });
    var turns = (m.transcript || []).map(function (t) {
      var mine = t.speaker === viewer;
      var who = byId(t.speaker);
      return h('li', { class: 'bubble ' + (mine ? 'bubble-mine' : 'bubble-theirs') },
        h('div', { class: 'bubble-meta' }, avatar(who, 'sm'), h('span', null, 'AI agent for ', h('strong', null, nameOf(t.speaker))), aiTag()),
        h('p', { class: 'bubble-text' }, t.text));
    });
    if (!animate || reduceMotion) { append(list, turns); return list; }
    var i = 0;
    var typing = h('li', { class: 'typing', 'aria-hidden': 'true' }, h('span'), h('span'), h('span'));
    (function next() {
      if (!list.isConnected && i > 0) return;
      if (typing.parentNode) typing.remove();
      if (i >= turns.length) return;
      turns[i].classList.add('enter');
      list.appendChild(turns[i]); i++;
      if (i < turns.length) { list.appendChild(typing); setTimeout(next, 900); }
    })();
    return list;
  }
  function votesView(m, viewer) {
    var ids = [m.a, m.b].sort(function (x) { return x === viewer ? -1 : 1; });
    return h('div', { class: 'votes' }, ids.map(function (id) {
      var v = (m.votes || {})[id];
      if (!v) return null;
      return h('div', { class: 'vote vote-' + v.vote },
        h('div', { class: 'vote-head' },
          h('span', null, (id === viewer ? 'Your agent' : nameOf(id) + '’s agent') + ' voted'),
          h('span', { class: 'badge badge-' + (v.vote === 'yes' ? 'ok' : 'no') }, v.vote === 'yes' ? 'Yes' : 'No')),
        h('p', { class: 'vote-reason' }, '“' + v.reason + '”'),
        aiTag());
    }));
  }
  function introActions(otherId) {
    var c = connGet(otherId);
    var wrap = h('div', { class: 'intro-actions' });
    function setStatus(s) { connSet(otherId, { status: s }); toast(s === 'hello' ? 'Marked as said hello (local only).' : 'Marked as not now (local only).'); rerender(); }
    append(wrap, [
      h('button', { type: 'button', class: 'btn btn-primary btn-sm', 'aria-pressed': String(c.status === 'hello'), onclick: function () { setStatus('hello'); } }, c.status === 'hello' ? '✓ Said hello' : 'Say hello'),
      h('button', { type: 'button', class: 'btn btn-ghost btn-sm', 'aria-pressed': String(c.status === 'notnow'), onclick: function () { setStatus('notnow'); } }, 'Not now'),
      h('span', { class: 'muted small' }, 'Local action: nothing is sent to anyone.')
    ]);
    return wrap;
  }
  function meetingView(m, viewer, opts) {
    opts = opts || {};
    var other = m.a === viewer ? m.b : m.a;
    var r = RESULT[m.result] || ['warn', m.result, ''];
    var intro = (m.introductions || []).filter(function (i) { return i.to === viewer; })[0];
    var box = h('div', { class: 'meeting' },
      h('div', { class: 'meeting-head' },
        h('div', null,
          h('h3', null, (viewer === S.memberId ? 'Your agent' : nameOf(viewer) + '’s agent') + ' met ' + nameOf(other) + '’s agent'),
          h('p', { class: 'muted small' }, 'First meeting · up to three turns each · each agent knows only its own member’s profile')),
        opts.animate && !reduceMotion ? h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: function () {
          var fresh = transcriptView(m, viewer, true); chat.replaceWith(fresh); chat = fresh;
        } }, '↻ Replay') : null));
    var chat = transcriptView(m, viewer, opts.animate);
    append(box, chat);
    append(box, h('h4', { class: 'sub' }, 'The votes'));
    append(box, votesView(m, viewer));
    append(box, h('div', { class: 'outcome outcome-' + r[0] }, resultBadge(m.result), h('span', null, r[2])));
    if (intro) {
      append(box, h('div', { class: 'intro' },
        h('div', { class: 'intro-head' }, h('span', { class: 'intro-icon', 'aria-hidden': 'true' }, '✉'),
          h('strong', null, viewer === S.memberId ? 'Message from your agent' : 'Message to ' + nameOf(viewer) + ' from their agent'), aiTag()),
        h('p', null, intro.message),
        viewer === S.memberId ? introActions(other) : null));
    }
    return box;
  }

  // ---------- 1. Ask ----------
  function exampleChips(onPick) {
    var asks = WI.store.exampleAsks();
    if (!asks.length) return h('p', { class: 'muted small' }, 'No precomputed examples are bundled with this build.');
    asks.sort(function (a, b) { return (b.requester === S.memberId) - (a.requester === S.memberId); });
    return h('div', { class: 'chips', role: 'list' }, asks.map(function (a) {
      return h('button', { type: 'button', class: 'chip chip-suggest', role: 'listitem', title: 'Precomputed on IBM Granite for ' + a.requesterName, onclick: function () { onPick(a); } },
        h('span', null, a.request), a.requester !== S.memberId ? h('span', { class: 'chip-who' }, 'as ' + a.requesterName) : h('span', { class: 'chip-who chip-who-me' }, 'yours'));
    }));
  }
  function pickExample(a) {
    var input = $('askInput'); if (input) input.value = a.request;
    S.askError = null;
    S.askResult = WI.store.exampleResult(a.index);
    S.askResult.animate = true;
    renderMain();
    var r = $('askResult'); if (r) r.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  function submitAsk(text) {
    text = String(text || '').trim();
    if (!text) { S.askError = 'Tell your agent what you’re looking for first.'; renderMain(); return; }
    if (text.length > 300) { S.askError = 'Keep it under 300 characters.'; renderMain(); return; }
    if (S.member && S.member.paused) { S.askError = 'Your agent is paused. Resume it to send it a request.'; renderMain(); return; }
    S.askError = null; S.askBusy = true; S.askResult = null; S.askText = text; S.askStarted = Date.now();
    renderMain();
    var forId = S.memberId;
    WI.store.ask(forId, text).then(function (res) {
      if (forId !== S.memberId) return;
      S.askBusy = false; res.animate = true; S.askResult = res;
      if (res.meeting && isLive()) refreshActivity();
      renderMain();
    }, function (err) {
      S.askBusy = false; S.askError = err.message; apiErrorNotice(err); renderMain();
    });
  }
  function progressView() {
    var n = Math.max(0, members().length - 1);
    var steps = ['Reading your request', 'Scouting ' + n + ' members for a two-way fit', 'Holding a first meeting with the best match’s agent', 'Both agents are voting', 'Writing the introduction, if both said yes'];
    var list = h('ol', { class: 'progress-steps' });
    var el = h('div', { class: 'card progress', 'aria-live': 'polite' },
      h('div', { class: 'progress-head' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('strong', null, 'Your agent is working on it'), h('span', { class: 'muted small elapsed' }, '')),
      list, h('p', { class: 'muted small' }, 'On IBM Granite this takes 10–30 seconds. You can switch tabs; the result will be here.'));
    function paint() {
      if (!S.askBusy || !el.isConnected) return;
      var secs = Math.floor((Date.now() - S.askStarted) / 1000);
      var at = Math.min(steps.length - 1, Math.floor(secs / 5));
      list.textContent = '';
      steps.forEach(function (s, i) { list.appendChild(h('li', { class: i < at ? 'done' : i === at ? 'now' : '' }, s + (i === at ? '…' : ''))); });
      el.querySelector('.elapsed').textContent = secs + ' s';
      setTimeout(paint, 1000);
    }
    setTimeout(paint, 0);
    steps.forEach(function (s, i) { list.appendChild(h('li', { class: i === 0 ? 'now' : '' }, s)); });
    return el;
  }
  function firstMatchesPanel() {
    var fm = WI.store.firstMatches(S.memberId);
    if (!fm) return null;
    var list = fm.first_matches || [];
    return h('section', { class: 'card first-matches', 'aria-labelledby': 'fmTitle' },
      h('div', { class: 'card-head' }, h('h2', { id: 'fmTitle' }, 'First matches'), h('span', { class: 'muted small' }, fm.note)),
      list.length ? h('ol', { class: 'cands' }, list.map(function (c, i) { return candidateCard(c, S.memberId, i + 1); }))
        : h('p', { class: 'muted' }, 'No member is a strong enough fit yet. Your agent will keep looking, and you can ask it for something specific above.'));
  }
  function askResultView(res) {
    var out = h('div', { id: 'askResult', class: 'ask-result' });
    if (res.unsupported) {
      append(out, h('div', { class: 'card honest' },
        h('h2', null, 'Demo mode can’t run new searches'),
        h('p', null, 'In live mode your agent runs this on IBM Granite: it scouts every member, holds a first meeting with the best match’s agent, and both agents vote. Here you can replay real Granite runs instead:'),
        exampleChips(pickExample),
        h('p', { class: 'muted small' }, 'Or connect a live agent with the “Demo data” button in the header.')));
      return out;
    }
    var viewer = res.example ? res.example.requester : S.memberId;
    if (res.example) {
      if (res.example.requester !== S.memberId) {
        append(out, h('div', { class: 'example-banner' },
          h('span', null, 'Example run by ', h('strong', null, res.example.requesterName + '’s agent'), ', precomputed on IBM Granite. It isn’t ' + (S.member ? S.member.name + '’s' : 'your') + ' result.'),
          h('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: function () { switchMember(res.example.requester, 'ask', res.example.index); } }, 'View as ' + res.example.requesterName)));
      } else {
        append(out, h('div', { class: 'example-banner example-mine' }, h('span', null, 'A real run of your agent on IBM Granite, precomputed for this demo: “' + res.example.request + '”')));
      }
    }
    var cands = res.candidates || [];
    var grid = h('div', { class: 'result-grid' });
    append(grid, h('section', { class: 'card', 'aria-labelledby': 'slTitle' },
      h('div', { class: 'card-head' }, h('h2', { id: 'slTitle' }, 'Shortlist'), h('span', { class: 'muted small' }, cands.length + ' of ' + Math.max(0, members().length - 1) + ' members cleared the fit bar')),
      cands.length ? h('ol', { class: 'cands' }, cands.map(function (c, i) { return candidateCard(c, viewer, i + 1); }))
        : h('p', { class: 'muted' }, res.note || 'No member is a strong enough fit yet; your agent will keep looking.'),
      h('p', { class: 'muted small foot-note' }, 'Fit is how well one side’s needs match the other’s offers. Score adds a small novelty bonus, learned weights and a capped cross-hub bonus.')));
    append(grid, res.meeting ? h('section', { class: 'card', 'aria-label': 'First meeting' }, meetingView(res.meeting, viewer, { animate: res.animate }))
      : h('section', { class: 'card' }, h('h2', null, 'No meeting yet'), h('p', { class: 'muted' }, res.note || 'Your agent didn’t find a fit strong enough to take a meeting.')));
    append(out, grid);
    res.animate = false;
    return out;
  }
  function renderAsk() {
    var m = S.member;
    var input = h('textarea', { id: 'askInput', rows: '2', maxlength: '300', placeholder: 'e.g. “find me someone who can do machine vision for inspection”', 'aria-describedby': 'askHelp' });
    if (S.askText) input.value = S.askText;
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitAsk(input.value); } });
    var form = h('form', { class: 'ask-form', onsubmit: function (e) { e.preventDefault(); submitAsk(input.value); } },
      h('label', { for: 'askInput', class: 'sr-only' }, 'What are you looking for?'),
      input,
      h('button', { type: 'submit', class: 'btn btn-primary', disabled: S.askBusy }, S.askBusy ? 'Working…' : 'Ask agent'));
    var hero = h('section', { class: 'card hero', 'aria-labelledby': 'askTitle' },
      h('p', { class: 'eyebrow' }, 'Ask your agent'),
      h('h1', { id: 'askTitle' }, 'What should ', h('span', { class: 'serif' }, m ? m.name + '’s' : 'your'), ' agent find?'),
      h('p', { class: 'lead', id: 'askHelp' }, 'Say it in plain words. Your agent scouts the network, takes the first meeting with the other member’s agent, and introduces you only if both agents vote yes.'),
      form,
      S.askError ? h('p', { class: 'field-error', role: 'alert' }, S.askError) : null,
      h('div', { class: 'chips-wrap' }, h('p', { class: 'chips-label' }, isLive() ? 'Or replay a precomputed Granite run:' : 'Real Granite runs you can replay:'), exampleChips(pickExample)));
    var out = [hero];
    if (m && m.paused) out.push(pausedBanner());
    var fm = firstMatchesPanel(); if (fm) out.push(fm);
    if (S.askBusy) out.push(progressView());
    else if (S.askResult) out.push(askResultView(S.askResult));
    else out.push(h('div', { class: 'card how' },
      h('h2', null, 'How your agent handles a request'),
      h('ol', { class: 'how-steps' },
        h('li', null, h('strong', null, 'Scouts.'), ' Scores every member in both directions: your needs against their offers, and theirs against yours.'),
        h('li', null, h('strong', null, 'Meets.'), ' Holds a short first meeting with the best match’s agent. Each agent argues only from its own member’s goals and deal-breakers.'),
        h('li', null, h('strong', null, 'Votes.'), ' Both agents vote yes or no with a reason. You hear about it only after two yes votes.')),
      !(m && m.user_created) ? null : null,
      h('p', { class: 'muted small' }, 'New here? ', h('button', { type: 'button', class: 'linkish', onclick: function () { openCreate(); } }, 'Create your own agent'), ' in about a minute.')));
    return out;
  }
  function pausedBanner() {
    return h('div', { class: 'paused-banner', role: 'status' },
      h('span', null, h('strong', null, 'Your agent is paused.'), ' It takes no new meetings and accepts no introductions until you resume it. Nothing is deleted.'),
      h('button', { type: 'button', class: 'btn btn-sm btn-primary', onclick: function () { togglePause(); } }, 'Resume agent'));
  }

  // ---------- 2. Activity ----------
  function sourceLabel(x) {
    if (x.source === 'network') return 'Proactive round';
    if (x.source === 'demo') return 'Demo round';
    if (x.source === 'ask') return x.request ? 'Asked: “' + x.request + '”' : 'On request';
    return 'Agent meeting';
  }
  function renderActivity() {
    var a = S.activity;
    if (!a) return [h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Loading activity…'))];
    var st = a.stats;
    var tiles = [['agents_met', 'Agents talked to'], ['meetings', 'Meetings'], ['yes_votes', 'Yes votes'], ['no_votes', 'No votes'], ['introductions', 'Introductions']];
    var stats = h('section', { class: 'stats', 'aria-label': 'Your agent at a glance' }, tiles.map(function (t) {
      return h('div', { class: 'stat stat-' + t[0] }, h('span', { class: 'stat-n' }, String(st[t[0]] || 0)), h('span', { class: 'stat-l' }, t[1]));
    }));
    var head = h('div', { class: 'section-head' },
      h('div', null, h('h1', null, 'What your agent did, and why'), h('p', { class: 'lead' }, 'Every first meeting your agent held, with its vote and reason. Open any item to read the whole conversation.')),
      h('span', { class: 'tag tag-ai tag-lg' }, 'Transcripts and votes are AI-generated'));
    if (!a.meetings.length) {
      return [head, stats, emptyState('No meetings yet', S.member && S.member.paused ? 'Your agent is paused, so it isn’t taking meetings.' :
        'Your agent hasn’t held a first meeting yet. Ask it for something specific, or wait for the next proactive round.', true)];
    }
    var feed = h('ol', { class: 'feed' }, a.meetings.map(function (x) {
      var open = !!S.expanded[x.id];
      var verb = x.result === 'introduced' ? 'introduced' : x.result === 'declined' ? 'declined' : 'blocked';
      var detailId = 'd-' + String(x.id).replace(/[^A-Za-z0-9_-]/g, '_');
      var meeting = { a: x.a || S.memberId, b: x.b || x.counterpart.id, transcript: x.transcript, votes: {}, result: x.result, introductions: x.introductions };
      if (!x.a) { meeting.a = (x.transcript[0] && x.transcript[0].speaker) || S.memberId; meeting.b = meeting.a === S.memberId ? x.counterpart.id : S.memberId; }
      meeting.votes[S.memberId] = x.my_vote; meeting.votes[x.counterpart.id] = x.their_vote;
      return h('li', { class: 'feed-item feed-' + verb },
        h('span', { class: 'feed-dot', 'aria-hidden': 'true' }),
        h('div', { class: 'feed-body' },
          h('div', { class: 'feed-top' },
            avatar(x.counterpart, 'sm'),
            h('p', { class: 'feed-title' }, 'Met ', h('strong', null, x.counterpart.name + '’s'), ' agent'),
            resultBadge(x.result)),
          h('p', { class: 'muted small' }, metaLine(x.counterpart), ' · ', sourceLabel(x)),
          x.candidate ? evidenceLine(x.candidate, S.memberId) : null,
          x.my_vote ? h('p', { class: 'feed-vote' }, h('span', { class: 'badge badge-' + (x.my_vote.vote === 'yes' ? 'ok' : 'no') }, 'You: ' + x.my_vote.vote),
            h('span', null, ' “' + x.my_vote.reason + '”'), aiTag()) : null,
          h('button', { type: 'button', class: 'expander', 'aria-expanded': String(open), 'aria-controls': detailId, onclick: function () { S.expanded[x.id] = !open; renderMain(); } },
            open ? 'Hide conversation' : 'Show conversation (' + x.transcript.length + ' turns)'),
          open ? h('div', { class: 'feed-detail', id: detailId }, meetingView(meeting, S.memberId, {})) : null));
    }));
    return [head, stats, h('section', { class: 'card feed-card', 'aria-label': 'Timeline' }, feed)];
  }
  function emptyState(title, text, withCreate) {
    return h('div', { class: 'card empty' },
      h('div', { class: 'empty-art', 'aria-hidden': 'true' }, h('span'), h('span'), h('span')),
      h('h2', null, title), h('p', { class: 'muted' }, text),
      h('div', { class: 'empty-actions' },
        h('button', { type: 'button', class: 'btn btn-primary', onclick: function () { setTab('ask'); } }, 'Ask your agent'),
        withCreate ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { openCreate(); } }, '+ Create your agent') : null));
  }

  // ---------- 3. Connections ----------
  function renderConnections() {
    var a = S.activity;
    if (!a) return [h('div', { class: 'card' }, h('p', { class: 'muted' }, 'Loading connections…'))];
    var head = h('div', { class: 'section-head' },
      h('div', null, h('h1', null, 'Your connections'), h('p', { class: 'lead' }, 'Introductions arrive only after both agents vote yes. Tell your agent how each one went; that teaches the network which kinds of meeting are worth taking.')));
    if (!a.introductions.length) return [head, emptyState('No introductions yet', 'Your agent introduces you only after both agents vote yes. When that happens, it will show up here.', true)];
    var list = h('div', { class: 'conn-grid' }, a.introductions.map(function (i) {
      var cp = i.counterpart, c = connGet(cp.id);
      var status = c.outcome ? ['done', 'Outcome recorded'] : c.status === 'hello' ? ['hello', 'Said hello'] : c.status === 'notnow' ? ['later', 'Not now'] : ['new', 'New'];
      var mt = (a.meetings || []).filter(function (x) { return x.id === i.meeting_id; })[0];
      var busy = S.busyFeedback[cp.id];
      return h('article', { class: 'card conn' },
        h('div', { class: 'conn-head' }, avatar(cp),
          h('div', { class: 'cand-id' }, h('strong', null, cp.name), h('span', { class: 'muted small' }, metaLine(cp))),
          h('span', { class: 'status status-' + status[0] }, status[1])),
        mt && mt.candidate ? evidenceLine(mt.candidate, S.memberId) : null,
        h('div', { class: 'conn-msg' }, h('div', { class: 'conn-msg-head' }, h('span', null, 'From your agent'), aiTag()), h('p', null, i.message)),
        introActions(cp.id),
        h('div', { class: 'outcomes' },
          h('p', { class: 'outcomes-label', id: 'oc-' + cp.id }, 'How did it go?'),
          h('div', { class: 'seg', role: 'group', 'aria-labelledby': 'oc-' + cp.id }, OUTCOMES.map(function (o) {
            return h('button', { type: 'button', class: 'seg-btn' + (c.outcome === o[0] ? ' is-on' : ''), 'aria-pressed': String(c.outcome === o[0]), disabled: busy,
              onclick: function () { recordOutcome(i, mt, o[0]); } }, o[1]);
          })),
          c.learned ? h('p', { class: 'learned' }, h('span', { class: 'learned-icon', 'aria-hidden': 'true' }, '↗'),
            'Your network learned: ', h('code', null, c.learned.key), ' weight ' + fmt(c.learned.before) + ' → ' + fmt(c.learned.after),
            c.learned.local ? h('span', { class: 'muted small' }, ' (recorded in this browser)') : null) : null,
          c.error ? h('p', { class: 'field-error' }, c.error) : null));
    }));
    return [head, list];
  }
  function recordOutcome(intro, meeting, outcome) {
    var cp = intro.counterpart;
    S.busyFeedback[cp.id] = true; renderMain();
    var ref = isLive() ? (meeting ? meeting.meeting_id || meeting.id : intro.meeting_id) : intro.meeting_id;
    WI.store.feedback(ref, outcome, { memberId: S.memberId, counterpartId: cp.id, candidate: meeting && meeting.candidate }).then(function (r) {
      var key = r.key;
      var before = r.weights_before && key in r.weights_before ? r.weights_before[key] : 1.0;
      var after = r.weights_after && key in r.weights_after ? r.weights_after[key] : before;
      connSet(cp.id, { outcome: outcome, learned: { key: key, before: before, after: after, local: !!r.local }, error: null });
      S.busyFeedback[cp.id] = false; renderMain();
    }, function (err) {
      connSet(cp.id, { error: apiErrorText(err, 'Couldn’t record that: ') });
      S.busyFeedback[cp.id] = false; renderMain();
    });
  }

  // ---------- 4. Profile (chip editor shared with onboarding) ----------
  function chipEditor(d, field, label, hint, singular, onChange) {
    var L = WI.LIMITS;
    var fs = h('fieldset', { class: 'chipfield' });
    function paint(focusAdd) {
      fs.textContent = '';
      var items = d[field];
      append(fs, h('legend', null, label, h('span', { class: 'count' + (items.length >= L.items ? ' is-full' : '') }, items.length + '/' + L.items)));
      append(fs, h('p', { class: 'hint' }, hint));
      var ul = h('ul', { class: 'chip-list' });
      items.forEach(function (text, idx) {
        var li = h('li', { class: 'chip chip-edit' });
        var txt = h('button', { type: 'button', class: 'chip-text', title: 'Edit', 'aria-label': 'Edit ' + singular + ': ' + text, onclick: function () {
          var inp = h('input', { type: 'text', class: 'chip-input', value: text, maxlength: String(L.chars), 'aria-label': 'Edit ' + singular });
          var done = false;
          function commit(save) {
            if (done) return; done = true;
            var v = inp.value.trim();
            if (save && v) d[field][idx] = v;
            else if (save && !v) d[field].splice(idx, 1);
            onChange(); paint();
          }
          inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); commit(true); } if (e.key === 'Escape') { e.preventDefault(); commit(false); } });
          inp.addEventListener('blur', function () { commit(true); });
          li.replaceChild(inp, txt); inp.focus(); inp.select();
        } }, text);
        var x = h('button', { type: 'button', class: 'chip-x', 'aria-label': 'Remove ' + singular + ': ' + text, onclick: function () { d[field].splice(idx, 1); onChange(); paint(true); } }, '×');
        append(li, [txt, x]); ul.appendChild(li);
      });
      if (!items.length) ul.appendChild(h('li', { class: 'chip-empty muted small' }, 'None yet.'));
      fs.appendChild(ul);
      var full = items.length >= L.items;
      var add = h('input', { type: 'text', class: 'chip-add-input', maxlength: String(L.chars), placeholder: full ? 'Limit of ' + L.items + ' reached' : 'Add a ' + singular + '…', disabled: full, 'aria-label': 'Add a ' + singular });
      var counter = h('span', { class: 'char-count muted small', 'aria-live': 'polite' }, '');
      function addIt() {
        var v = add.value.trim();
        if (!v) return;
        if (d[field].length >= L.items) return;
        d[field].push(v); onChange(); paint(true);
      }
      add.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addIt(); } });
      add.addEventListener('input', function () { counter.textContent = add.value.length > 120 ? add.value.length + '/' + L.chars : ''; });
      fs.appendChild(h('div', { class: 'chip-add' }, add, h('button', { type: 'button', class: 'btn btn-ghost btn-sm', disabled: full, onclick: addIt }, 'Add'), counter));
      if (focusAdd) { var t = fs.querySelector('.chip-add-input:not([disabled])') || fs.querySelector('.chip-text'); if (t) t.focus(); }
    }
    paint();
    return fs;
  }
  function toggleRow(id, title, text, checked, onToggle) {
    var btn = h('button', { type: 'button', role: 'switch', id: id, class: 'switch-btn', 'aria-checked': String(!!checked), 'aria-describedby': id + '-d', onclick: function () {
      var v = btn.getAttribute('aria-checked') !== 'true'; btn.setAttribute('aria-checked', String(v)); onToggle(v);
    } }, h('span', { class: 'switch', 'aria-hidden': 'true' }, h('span', { class: 'knob' })));
    return h('div', { class: 'toggle-row' },
      h('div', null, h('label', { for: id, class: 'toggle-title' }, title), h('p', { class: 'hint', id: id + '-d' }, text)), btn);
  }
  function profileEditor(d, onChange, opts) {
    opts = opts || {};
    var L = WI.LIMITS;
    var wrap = h('div', { class: 'editor' });
    var desc = h('textarea', { id: 'f-desc', rows: '4', maxlength: String(L.description) });
    desc.value = d.description || '';
    var dc = h('span', { class: 'muted small' }, (d.description || '').length + '/' + L.description);
    desc.addEventListener('input', function () { d.description = desc.value; dc.textContent = desc.value.length + '/' + L.description; onChange(); });
    append(wrap, h('div', { class: 'field' }, h('div', { class: 'field-row' }, h('label', { for: 'f-desc', class: 'field-label' }, 'In your words'), dc),
      h('p', { class: 'hint' }, 'Your agent opens every first meeting from this. Keep it to who you are and what you’re working on.'), desc));
    append(wrap, chipEditor(d, 'needs', 'Needs', 'What you’re looking for. Your agent scouts for members whose offers match these.', 'need', onChange));
    append(wrap, chipEditor(d, 'offers', 'Offers', 'What you can give. Other agents scout for these.', 'offer', onChange));
    append(wrap, chipEditor(d, 'deal_breakers', 'Deal-breakers', 'Your agent votes no on any meeting that runs into one of these.', 'deal-breaker', onChange));

    var out = h('output', { class: 'stepper-val', id: 'f-budget', 'aria-live': 'polite' }, String(d.intro_budget));
    function setB(v) { d.intro_budget = Math.max(0, Math.min(L.budgetMax, v)); out.textContent = String(d.intro_budget); minus.disabled = d.intro_budget <= 0; plus.disabled = d.intro_budget >= L.budgetMax; onChange(); }
    var minus = h('button', { type: 'button', class: 'step-btn', 'aria-label': 'Decrease introduction budget', disabled: d.intro_budget <= 0, onclick: function () { setB(d.intro_budget - 1); } }, '−');
    var plus = h('button', { type: 'button', class: 'step-btn', 'aria-label': 'Increase introduction budget', disabled: d.intro_budget >= L.budgetMax, onclick: function () { setB(d.intro_budget + 1); } }, '+');
    append(wrap, h('div', { class: 'field budget' },
      h('div', null, h('span', { class: 'field-label', id: 'budget-l' }, 'Introduction budget'),
        h('p', { class: 'hint' }, 'How many introductions your agent may accept per round. Every yes spends one, so it stays choosy. 0 means it never says yes.')),
      h('div', { class: 'stepper', role: 'group', 'aria-labelledby': 'budget-l' }, minus, out, plus)));

    var perms = h('fieldset', { class: 'perms' }, h('legend', null, 'Permissions'));
    WI.PERMISSION_KEYS.forEach(function (k) {
      append(perms, toggleRow('p-' + k + (opts.prefix || ''), PERMS[k][0], PERMS[k][1], d.permissions[k], function (v) { d.permissions[k] = v; onChange(); }));
    });
    append(wrap, perms);
    if (opts.showPause) {
      append(wrap, h('fieldset', { class: 'perms pause-field' }, h('legend', null, 'Agent status'),
        toggleRow('p-paused', 'Pause my agent', 'While paused your agent takes no new meetings and accepts no introductions. Nothing is deleted, and you can resume any time.', d.paused, function (v) { d.paused = v; onChange(); })));
    }
    return wrap;
  }
  function draftFromMember(m) {
    return { description: m.description || '', needs: (m.needs || []).slice(), offers: (m.offers || []).slice(), deal_breakers: (m.deal_breakers || []).slice(),
      intro_budget: m.intro_budget != null ? m.intro_budget : 2, permissions: Object.assign({ share_profile: true, propose_meetings: true, contact_member: true }, m.permissions || {}), paused: !!m.paused };
  }
  function renderProfile() {
    var m = S.member;
    if (!m) return [];
    if (!S.draft) S.draft = draftFromMember(m);
    var d = S.draft;
    var bar, statusEl, saveBtn;
    function onChange() {
      S.dirty = true; S.saveMsg = null; S.saveErr = WI.validatePatch(d);
      statusEl.textContent = S.saveErr || 'Unsaved changes';
      statusEl.className = 'save-status' + (S.saveErr ? ' is-error' : ' is-dirty');
      saveBtn.disabled = !!S.saveErr; bar.classList.add('is-dirty');
    }
    statusEl = h('span', { class: 'save-status' + (S.saveErr ? ' is-error' : S.dirty ? ' is-dirty' : ''), role: 'status' }, S.saveErr || S.saveMsg || (S.dirty ? 'Unsaved changes' : 'All changes saved'));
    saveBtn = h('button', { type: 'submit', class: 'btn btn-primary', disabled: !!S.saveErr }, 'Save');
    bar = h('div', { class: 'save-bar' + (S.dirty ? ' is-dirty' : '') }, statusEl,
      h('div', { class: 'save-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { S.draft = null; S.dirty = false; S.saveErr = null; S.saveMsg = null; renderMain(); } }, 'Reset'),
        saveBtn));
    var form = h('form', { class: 'card profile-form', novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      var err = WI.validatePatch(d);
      if (err) { S.saveErr = err; statusEl.textContent = err; statusEl.className = 'save-status is-error'; return; }
      saveBtn.disabled = true; statusEl.textContent = 'Saving…';
      WI.store.updateMember(S.memberId, { description: d.description, needs: d.needs, offers: d.offers, deal_breakers: d.deal_breakers, intro_budget: d.intro_budget, permissions: d.permissions, paused: d.paused })
        .then(function (mem) {
          S.member = mem; S.draft = null; S.dirty = false; S.saveErr = null; S.saveMsg = 'Saved. Your agent will use this from its next meeting.';
          renderHeader(); renderMain(); toast('Profile saved');
        }, function (err2) {
          S.saveErr = err2.status === 403 ? 'Not saved: this seeded member needs the presenter key.' : err2.message;
          statusEl.textContent = S.saveErr; statusEl.className = 'save-status is-error'; saveBtn.disabled = false;
          apiErrorNotice(err2);
        });
    } },
      h('div', { class: 'card-head' }, h('h2', null, 'Profile'), memberTag(m)),
      profileEditor(d, onChange, { showPause: true }),
      bar);
    var head = h('div', { class: 'section-head' },
      h('div', null, h('h1', null, 'What your agent knows about ', h('span', { class: 'serif' }, m.name)),
        h('p', { class: 'lead' }, 'This is everything your agent works from. Change it and your agent changes how it scouts, what it says in meetings, and how it votes.')),
      h('div', { class: 'who' }, avatar(m, 'lg'), h('div', null, h('strong', null, m.name), h('span', { class: 'muted small' }, metaLine(m)))));
    var aside = h('aside', { class: 'side' }, resourcesCard(), howCard());
    return [head, h('div', { class: 'profile-grid' }, form, aside)];
  }
  function resourcesCard() {
    var card = h('section', { class: 'card resources', 'aria-labelledby': 'resTitle' },
      h('div', { class: 'card-head' }, h('h2', { id: 'resTitle' }, 'Your agent also suggests')),
      h('p', { class: 'hint' }, 'Real Michigan organisations that fit your needs. They are not members: they never take meetings, vote or get messages. Only the matching is AI-generated.'));
    var r = S.resources;
    if (!r) { append(card, h('p', { class: 'muted small' }, 'Loading…')); return card; }
    if (r.error) { append(card, h('p', { class: 'muted small' }, r.error)); return card; }
    if (!r.suggestions.length) { append(card, h('p', { class: 'muted small' }, r.note || 'No suggestions for you yet.')); return card; }
    append(card, h('ul', { class: 'res-list' }, r.suggestions.map(function (s) {
      return h('li', { class: 'res' },
        h('div', { class: 'res-top' }, h('strong', null, s.name), realTag()),
        h('p', { class: 'muted small' }, [String(s.category || '').replace(/_/g, ' '), HUB[s.hub] || s.hub].filter(Boolean).join(' · ')),
        h('p', { class: 'small' }, 'For your need “', h('em', null, s.for_need), '” ↔ helps with “', h('em', null, s.matched), '”'),
        /^https?:\/\//.test(s.url || '') ? h('a', { href: s.url, target: '_blank', rel: 'noopener noreferrer', class: 'res-link' }, 'Visit website ↗', h('span', { class: 'sr-only' }, ' (opens in a new tab)')) : null);
    })));
    append(card, h('p', { class: 'muted small' }, r.note));
    return card;
  }
  function howCard() {
    return h('section', { class: 'card how-small' },
      h('h2', null, 'What your agent never does'),
      h('ul', { class: 'checks' },
        h('li', null, 'It contacts only you, and only after two yes votes.'),
        h('li', null, 'It never shares more than your permissions allow.'),
        h('li', null, 'It never accepts more introductions than your budget.')));
  }

  // ---------- Create your agent (onboarding) ----------
  function openCreate(step) {
    S.onboard = { step: 1, input: { name: '', type: '', hub: '', about: '' }, draft: null, note: null, error: null, busy: false };
    if (step >= 3) {
      S.onboard.input = { name: 'Jordan R.', type: 'individual', hub: 'ann_arbor', about: EXAMPLE_ABOUT };
      S.onboard.draft = WI.localDraft(S.onboard.input); S.onboard.draft.sector = 'mechanical engineering';
      S.onboard.note = 'Demo mode: drafted in your browser. Live mode drafts with IBM Granite.';
      S.onboard.step = 3;
    }
    setTab('create');
  }
  function stepper(at) {
    var names = ['Tell your agent about you', 'Your agent drafts a profile', 'Review and edit', 'Go live'];
    return h('ol', { class: 'steps', 'aria-label': 'Progress' }, names.map(function (n, i) {
      var s = i + 1;
      return h('li', { class: s < at ? 'done' : s === at ? 'now' : '', 'aria-current': s === at ? 'step' : null }, h('span', { class: 'step-n' }, s < at ? '✓' : String(s)), h('span', { class: 'step-t' }, n));
    }));
  }
  function renderCreate() {
    var o = S.onboard;
    if (!o) { openCreate(); o = S.onboard; }
    var head = h('div', { class: 'section-head' },
      h('div', null, h('p', { class: 'eyebrow' }, 'Create your agent'), h('h1', null, 'An agent that takes the first meeting ', h('span', { class: 'serif' }, 'for you')),
        h('p', { class: 'lead' }, 'Tell it who you are in your own words. It drafts a profile, you correct it, and it starts scouting Michigan’s network for you.')));
    var body;
    if (o.step === 1) body = createStep1(o);
    else if (o.step === 2) body = h('div', { class: 'card progress' }, h('div', { class: 'progress-head' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }), h('strong', null, 'Your agent is reading what you wrote and drafting a profile…')),
      h('p', { class: 'muted small' }, isLive() ? 'This takes a few seconds on IBM Granite.' : 'Demo mode: drafting in your browser.'));
    else body = createStep3(o);
    return [head, stepper(o.step), body];
  }
  function createStep1(o) {
    var L = WI.LIMITS, inp = o.input;
    var name = h('input', { id: 'c-name', type: 'text', maxlength: String(L.name), value: inp.name, autocomplete: 'name', required: true });
    name.addEventListener('input', function () { inp.name = name.value; });
    var types = h('div', { class: 'radio-cards', role: 'radiogroup', 'aria-labelledby': 'c-type-l' }, WI.MEMBER_TYPES.map(function (t) {
      var id = 'c-type-' + t;
      var r = h('input', { type: 'radio', name: 'c-type', id: id, value: t, checked: inp.type === t, onchange: function () { inp.type = t; } });
      return h('label', { class: 'radio-card', for: id }, r, h('span', { class: 'radio-title' }, TYPE_LONG[t]));
    }));
    var hub = h('select', { id: 'c-hub', required: true },
      h('option', { value: '' }, 'Choose a hub…'), WI.HUBS.map(function (k) { return h('option', { value: k, selected: inp.hub === k }, HUB[k]); }));
    hub.addEventListener('change', function () { inp.hub = hub.value; });
    var about = h('textarea', { id: 'c-about', rows: '6', maxlength: String(L.aboutMax), placeholder: 'Who you are, what you’re looking for, what you can offer, and anything your agent should never agree to.' });
    about.value = inp.about;
    var ac = h('span', { class: 'muted small' }, inp.about.length + '/' + L.aboutMax);
    about.addEventListener('input', function () { inp.about = about.value; ac.textContent = about.value.length + '/' + L.aboutMax; });
    return h('form', { class: 'card create-form', novalidate: true, onsubmit: function (e) { e.preventDefault(); draftIt(); } },
      h('div', { class: 'field' }, h('label', { for: 'c-name', class: 'field-label' }, 'Name'), h('p', { class: 'hint' }, 'Your name or your organisation’s.'), name),
      h('div', { class: 'field' }, h('span', { class: 'field-label', id: 'c-type-l' }, 'You are a…'), types),
      h('div', { class: 'field' }, h('label', { for: 'c-hub', class: 'field-label' }, 'Hub'), h('p', { class: 'hint' }, 'Where you’re based. Your agent still meets members in every hub.'), hub),
      h('div', { class: 'field' }, h('div', { class: 'field-row' }, h('label', { for: 'c-about', class: 'field-label' }, 'In your own words'), ac),
        h('p', { class: 'hint' }, 'A few sentences. Mention what you need (“I’m looking for…”), what you offer (“I can…”) and your deal-breakers (“I won’t…”).'), about,
        h('button', { type: 'button', class: 'linkish small', onclick: function () { inp.name = inp.name || 'Jordan R.'; inp.type = inp.type || 'individual'; inp.hub = inp.hub || 'ann_arbor'; inp.about = EXAMPLE_ABOUT; renderMain(); } }, 'Fill in an example')),
      o.error ? h('p', { class: 'field-error', role: 'alert' }, o.error) : null,
      h('p', { class: 'muted small' }, 'What you type is your own input, not synthetic data. ', isLive() ? 'It is sent to the Warm Intro API to draft your profile.' : 'In demo mode it stays in this browser.'),
      h('div', { class: 'form-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { S.onboard = null; setTab('ask'); } }, 'Cancel'),
        h('button', { type: 'submit', class: 'btn btn-primary' }, 'Draft my profile →')));
  }
  function draftIt() {
    var o = S.onboard, inp = o.input, L = WI.LIMITS;
    var err = !inp.name.trim() ? 'Add your name.' : inp.name.trim().length > L.name ? 'Name must be 80 characters or fewer.' :
      !inp.type ? 'Choose what kind of member you are.' : !inp.hub ? 'Choose a hub.' :
      inp.about.trim().length < L.aboutMin ? 'Write at least a sentence or two (20 characters) so your agent has something to work with.' : null;
    if (err) { o.error = err; renderMain(); return; }
    o.error = null; o.step = 2; renderMain();
    WI.store.draftProfile({ name: inp.name.trim(), type: inp.type, hub: inp.hub, about: inp.about.trim() }).then(function (r) {
      if (S.onboard !== o) return;
      var d = r.draft || {};
      o.draft = {
        name: d.name || inp.name.trim(), type: d.type || inp.type, hub: d.hub || inp.hub, sector: d.sector || '',
        description: d.description || '', needs: (d.needs || []).slice(0, 6), offers: (d.offers || []).slice(0, 6), deal_breakers: (d.deal_breakers || []).slice(0, 6),
        intro_budget: d.intro_budget != null ? d.intro_budget : 2, permissions: Object.assign({ share_profile: true, propose_meetings: true, contact_member: true }, d.permissions || {})
      };
      o.note = r.note; o.step = 3; renderMain();
    }, function (e) { o.step = 1; o.error = apiErrorText(e, 'Your agent couldn’t draft that: '); renderMain(); });
  }
  function createStep3(o) {
    var d = o.draft, L = WI.LIMITS;
    var errEl = h('p', { class: 'field-error', role: 'alert' }, o.error || '');
    function onChange() { o.error = null; errEl.textContent = ''; }
    var name = h('input', { id: 'r-name', type: 'text', maxlength: String(L.name), value: d.name });
    name.addEventListener('input', function () { d.name = name.value; onChange(); });
    var sector = h('input', { id: 'r-sector', type: 'text', maxlength: String(L.sector), value: d.sector, placeholder: 'e.g. robotics, machine vision, food packaging' });
    sector.addEventListener('input', function () { d.sector = sector.value; onChange(); });
    var type = h('select', { id: 'r-type' }, WI.MEMBER_TYPES.map(function (t) { return h('option', { value: t, selected: d.type === t }, TYPE_LONG[t]); }));
    type.addEventListener('change', function () { d.type = type.value; });
    var hub = h('select', { id: 'r-hub' }, WI.HUBS.map(function (k) { return h('option', { value: k, selected: d.hub === k }, HUB[k]); }));
    hub.addEventListener('change', function () { d.hub = hub.value; });
    var go = h('button', { type: 'submit', class: 'btn btn-primary', disabled: o.busy }, o.busy ? 'Going live…' : 'Go live');
    return h('form', { class: 'card create-form', novalidate: true, onsubmit: function (e) { e.preventDefault(); goLive(); } },
      h('div', { class: 'draft-note' }, h('span', { class: 'tag tag-ai' }, isLive() ? 'AI-generated draft' : 'Drafted in your browser'), h('span', { class: 'small' }, o.note || ''),
        h('span', { class: 'muted small' }, 'Check every line. Your agent will say exactly this in meetings.')),
      h('div', { class: 'grid-2' },
        h('div', { class: 'field' }, h('label', { for: 'r-name', class: 'field-label' }, 'Name'), name),
        h('div', { class: 'field' }, h('label', { for: 'r-sector', class: 'field-label' }, 'Sector'), sector),
        h('div', { class: 'field' }, h('label', { for: 'r-type', class: 'field-label' }, 'Member type'), type),
        h('div', { class: 'field' }, h('label', { for: 'r-hub', class: 'field-label' }, 'Hub'), hub)),
      profileEditor(d, onChange, { prefix: '-new' }),
      errEl,
      h('div', { class: 'form-actions' },
        h('button', { type: 'button', class: 'btn btn-ghost', onclick: function () { o.step = 1; o.error = null; renderMain(); } }, '← Back'),
        go));
  }
  function goLive() {
    var o = S.onboard, d = o.draft;
    var err = WI.validateDraft(d);
    if (err) { o.error = err; renderMain(); return; }
    o.busy = true; o.error = null; renderMain();
    WI.store.createMember(d).then(function (r) {
      S.onboard = null;
      toast('Your agent is live. Here are its first matches.');
      switchMember(r.member.id, 'ask');
    }, function (e) { o.busy = false; o.error = e.message; renderMain(); });
  }

  // ---------- control ----------
  function togglePause() {
    if (!S.member) return;
    var want = !S.member.paused;
    WI.store.updateMember(S.memberId, { paused: want }).then(function (m) {
      S.member = m; if (S.draft) S.draft.paused = m.paused;
      renderHeader(); renderMain();
      toast(m.paused ? 'Agent paused. It takes no new meetings.' : 'Agent resumed.');
    }, function (e) { if (!apiErrorNotice(e)) toast('Couldn’t change that: ' + e.message); });
  }
  function refreshActivity() {
    var id = S.memberId;
    return WI.store.getActivity(id).then(function (a) { if (id === S.memberId) { S.activity = a; renderHeader(); if (S.tab !== 'ask' && S.tab !== 'profile') renderMain(); } },
      function (e) { if (id === S.memberId) { S.activity = { stats: {}, meetings: [], introductions: [] }; notice('Couldn’t load activity: ' + e.message, 'warn'); renderMain(); } });
  }
  function loadResources() {
    var id = S.memberId; S.resources = null;
    WI.store.suggestions(id).then(function (r) { if (id === S.memberId) { S.resources = r; if (S.tab === 'profile') renderMain(); } },
      function (e) { if (id === S.memberId) { S.resources = { error: 'Couldn’t load suggestions: ' + e.message, suggestions: [] }; if (S.tab === 'profile') renderMain(); } });
  }
  function switchMember(id, tab, exampleIndex) {
    if (!byId(id)) id = members()[0] && members()[0].id;
    S.memberId = id; S.member = byId(id); S.activity = null; S.draft = null; S.dirty = false; S.saveErr = null; S.saveMsg = null;
    S.askResult = null; S.askText = ''; S.askError = null; S.expanded = {};
    if (exampleIndex != null) { var r = WI.store.exampleResult(exampleIndex); if (r) { r.animate = true; S.askResult = r; S.askText = r.example.request; } }
    if (tab) S.tab = tab;
    try { LS.set('wi.member', id); } catch (e) { /* ignore */ }
    renderHeader(); renderMain();
    if (isLive()) WI.store.getMember(id).then(function (m) { if (id === S.memberId) { S.member = m; renderHeader(); if (S.tab === 'profile' && !S.dirty) renderMain(); } }, function () {});
    refreshActivity(); loadResources();
  }
  function setTab(t) {
    if (S.tab === 'profile' && S.dirty && t !== 'profile') { /* keep the draft; it's still there when they come back */ }
    S.tab = t; renderHeader(); renderMain();
    var main = $('main'); if (main && document.activeElement && document.activeElement.closest && !document.activeElement.closest('#tabs')) main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }
  function rerender() { renderHeader(); renderMain(); }

  function renderMain() {
    var main = $('main');
    var keepScroll = window.scrollY;
    main.textContent = '';
    main.setAttribute('aria-labelledby', S.tab === 'create' ? '' : 'tab-' + S.tab);
    main.className = 'main main-' + S.tab;
    var parts = S.tab === 'activity' ? renderActivity() : S.tab === 'connections' ? renderConnections() : S.tab === 'profile' ? renderProfile() : S.tab === 'create' ? renderCreate() : renderAsk();
    append(main, parts);
    syncUrl();
    window.scrollTo(0, keepScroll);
  }

  // ---------- wiring ----------
  function wire() {
    $('persona').addEventListener('change', function (e) {
      var v = e.target.value;
      if (v === '__create') { e.target.value = S.memberId; openCreate(); return; }
      switchMember(v);
    });
    $('agentToggle').addEventListener('click', togglePause);
    var tabs = Array.prototype.slice.call(document.querySelectorAll('#tabs [role=tab]'));
    tabs.forEach(function (b, i) {
      b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
      b.addEventListener('keydown', function (e) {
        var j = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : -1;
        if (j < 0) return; e.preventDefault(); tabs[j].focus(); setTab(tabs[j].getAttribute('data-tab'));
      });
    });
    var dlg = $('connectDialog');
    $('modePill').addEventListener('click', function () {
      $('apiInput').value = (isLive() && WI.store.api) || LS.get('wi.api', '') || '';
      $('keyInput').value = presenterKey() || '';
      $('connectStatus').textContent = isLive() ? 'Connected to ' + WI.store.api + ' (provider: ' + ((S.info && S.info.provider) || 'unknown') + ').' :
        'You’re viewing demo data: real IBM Granite runs over 60 synthetic members, saved with this page. Connect a running Warm Intro API to ask your agent new things.';
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    });
    $('closeConnect').addEventListener('click', function () { dlg.close ? dlg.close() : dlg.removeAttribute('open'); });
    $('useDemo').addEventListener('click', function () { LS.del('wi.api'); dlg.close ? dlg.close() : dlg.removeAttribute('open'); start(null); });
    $('connectForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var v = $('apiInput').value.trim();
      if (!/^https?:\/\/.+/.test(v)) { $('connectStatus').textContent = 'Enter a URL starting with http:// or https://'; return; }
      setPresenterKey($('keyInput').value.trim());
      $('connectBtn').disabled = true; $('connectStatus').textContent = 'Connecting…';
      start(v).then(function (info) {
        $('connectBtn').disabled = false;
        if (info.mode === 'live') { LS.set('wi.api', v); dlg.close ? dlg.close() : dlg.removeAttribute('open'); toast('Connected to your live agent.'); }
        else $('connectStatus').textContent = info.notice;
      });
    });
  }

  // Presenter key: localStorage only (memory fallback when storage is blocked). Never in the URL after load.
  var keyMem = null;
  function presenterKey() { return LS.get('wi.key', null) || keyMem; }
  function setPresenterKey(k) { keyMem = k || null; if (k) LS.set('wi.key', k); else LS.del('wi.key'); }

  function start(api) {
    return WI.connect(api, presenterKey()).then(function (info) {
      S.info = info;
      notice(info.notice || (WI.isFallbackData && !isLive() ? 'Showing the development fallback data: example asks and resource suggestions aren’t bundled in this build.' : null), info.notice ? 'warn' : 'info');
      var want = params.get('member') || S.memberId || LS.get('wi.member', null) || 'm001';
      var t = S.tab;
      var ex = params.get('ask'); params.delete('ask');
      switchMember(want, t, ex != null && ex !== '' ? parseInt(ex, 10) : null);
      params.delete('member');
      return info;
    });
  }

  wire();
  if (params.get('key')) { setPresenterKey(params.get('key')); params.delete('key'); syncUrl(); }
  var t0 = params.get('tab');
  S.tab = TABS.concat(['create']).indexOf(t0) >= 0 ? t0 : 'ask';
  var apiParam = params.get('api') || LS.get('wi.api', null);
  start(apiParam).then(function () {
    if (S.tab === 'create') openCreate(parseInt(params.get('step') || '1', 10));
    try { document.body.setAttribute('data-sw', String(document.documentElement.scrollWidth) + '/' + window.innerWidth); document.body.setAttribute('data-ready', '1'); } catch (e) { /* ignore */ }
  });
})();
