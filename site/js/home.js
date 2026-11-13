/* Warm Intro home page. Classic script, no modules, no fetch: works from file:// and GitHub Pages.
   Data: window.WARM_INTRO (data/site_data.js), else window.WARM_INTRO_FALLBACK (data/dev_fallback.js). */
(function () {
  'use strict';
  var doc = document.documentElement;

  var D = window.WARM_INTRO || window.WARM_INTRO_FALLBACK || {};
  var isFallback = !!window.WARM_INTRO_IS_FALLBACK;
  var qs = new URLSearchParams(location.search);
  var shot = qs.has('shot');
  var reduced = shot || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (shot) doc.classList.remove('js'); // screenshot mode: every element in its finished state

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function aiTag() { return el('span', 'ai', 'AI-generated'); }
  function setText(id, t) { var e = $(id); if (e && t != null) e.textContent = t; }
  function fmt(n) { return typeof n === 'number' ? n.toLocaleString('en-US') : '–'; }
  function cap(s) { s = String(s || ''); return s.charAt(0).toUpperCase() + s.slice(1); }
  function firstSentence(s, max) {
    s = String(s || '').trim();
    var m = s.match(/^.+?[.!?](\s|$)/);
    var out = m ? m[0].trim() : s;
    if (max && out.length > max) out = out.slice(0, max).replace(/\s+\S*$/, '') + '…';
    return out;
  }

  // ---------- Members (run data first, then any member listed inside a run) ----------
  var members = {};
  (D.members || []).forEach(function (m) { members[m.id] = m; });
  [D.network_run, D.demo_run].forEach(function (r) {
    ((r && r.members) || []).forEach(function (m) { if (m && m.id && !members[m.id]) members[m.id] = m; });
  });
  function name(id) { return (members[id] && members[id].name) || id; }
  var TYPES = { individual: 'Individual', startup: 'Startup', small_business: 'Small business', corporation: 'Corporation' };
  var HUBS = { detroit: 'Detroit', grand_rapids: 'Grand Rapids', ann_arbor: 'Ann Arbor' };
  function hub(id) { var m = members[id] || {}; return HUBS[m.hub] || m.hub || ''; }
  function meta(id) {
    var m = members[id] || {};
    return [TYPES[m.type] || m.type, HUBS[m.hub] || m.hub].filter(Boolean).join(', ');
  }
  function initials(n) {
    return String(n || '?').replace(/[^A-Za-z .&]/g, '').split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }

  var run = (D.network_run && D.network_run.meetings && D.network_run.meetings.length) ? D.network_run : (D.demo_run || {});
  var meetings = run.meetings || [];

  // Find a meeting by its member pair (ids differ between runs), network run first.
  function findMeeting(x, y) {
    var runs = [D.network_run, D.demo_run];
    for (var i = 0; i < runs.length; i++) {
      var ms = (runs[i] && runs[i].meetings) || [];
      for (var j = 0; j < ms.length; j++) {
        var m = ms[j];
        if ((m.a === x && m.b === y) || (m.a === y && m.b === x)) return m;
      }
    }
    return null;
  }

  var isReal = D.provider === 'watsonx';
  var providerLabel = isReal ? 'Real run on Granite, watsonx.ai' : 'Dev fallback on the mock provider';

  var ME = 'm001', OTHER = 'm002';
  var yesMeeting = findMeeting(OTHER, ME);
  var noMeeting = findMeeting('m003', 'm004');

  // ---------- Hero: the extension popup ----------
  (function popup() {
    setText('popMe', name(ME));
    setText('popMeMeta', meta(ME));
    setText('popMeAv', initials(name(ME)));
    setText('popName', name(OTHER));
    setText('popMeta', meta(OTHER));
    setText('popAv', initials(name(OTHER)));
    var mine = meetings.filter(function (m) { return m.a === ME || m.b === ME; });
    var intros = 0;
    mine.forEach(function (m) { (m.introductions || []).forEach(function (x) { if (x.to === ME) intros++; }); });
    if (mine.length) {
      setText('popSum', 'Took ' + mine.length + (mine.length === 1 ? ' meeting. ' : ' meetings. ') +
        intros + (intros === 1 ? ' introduction' : ' introductions') + ', both agents said yes.');
    }
    var ev = yesMeeting && yesMeeting.candidate && (yesMeeting.candidate.evidence || []).filter(function (e) { return e.offer_of === OTHER; })[0];
    if (ev) setText('popWhy', cap(ev.offer) + '.');

    $('popRead').addEventListener('click', function () {
      if (!yesMeeting) return;
      openRow(yesMeeting.id, true);
      var row = document.querySelector('[data-mid="' + yesMeeting.id + '"]');
      if (row) row.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
    });
    $('popHello').addEventListener('click', function () {
      var n = $('popNote');
      n.textContent = 'In the pilot this opens a message to ' + name(OTHER) + '. Nothing is sent from this page.';
      n.hidden = false;
    });
    $('popStatus').addEventListener('click', function () { setPaused($('popStatus').getAttribute('aria-checked') === 'true'); });
  })();

  function setPaused(paused) {
    var s = $('popStatus');
    s.setAttribute('aria-checked', paused ? 'false' : 'true');
    setText('popStatusLabel', paused ? 'Paused' : 'Active');
    $('popup').classList.toggle('is-paused', paused);
    var pauseSw = document.querySelector('.toggle[aria-label="Pause my agent"]');
    if (pauseSw) setSwitch(pauseSw, paused, true);
  }

  // ---------- The meetings board ----------
  var board = $('board');
  var rowEls = {};
  function renderTranscript(m, box) {
    box.textContent = '';
    box.appendChild(el('p', 't-head', name(m.a) + '’s agent meets ' + name(m.b) + '’s agent'));
    var src = el('p', 't-src', providerLabel + (D.chat_model && isReal ? ', ' + D.chat_model : '') + '. Synthetic members. Every line below is AI-generated.');
    box.appendChild(src);
    var list = el('ol', 't-list');
    (m.transcript || []).forEach(function (t) {
      var li = el('li', 't-line ' + (t.speaker === m.a ? 'side-a' : 'side-b'));
      var who = el('div', 't-who', 'Agent for ' + name(t.speaker));
      var sm = el('small', null, 'Turn ' + t.turn);
      sm.appendChild(aiTag());
      who.appendChild(sm);
      li.appendChild(who);
      li.appendChild(el('p', null, t.text));
      list.appendChild(li);
    });
    box.appendChild(list);
    var intro = el('div', 't-intro');
    var msgs = m.introductions || [];
    if (msgs.length) {
      msgs.forEach(function (msg) {
        var label = el('p', 'label', 'What ' + name(msg.to) + '’s agent wrote to ' + name(msg.to));
        label.appendChild(aiTag());
        intro.appendChild(label);
        intro.appendChild(el('blockquote', null, msg.message));
      });
    } else {
      intro.appendChild(el('p', 'label', 'No introduction'));
      intro.appendChild(el('p', null, 'Two no votes, so neither member was contacted. The reasons are kept so the network learns from them.'));
    }
    box.appendChild(intro);
  }

  meetings.forEach(function (m, i) {
    var yes = m.result === 'introduced';
    var row = el('div', 'row' + (yes ? '' : ' is-declined'));
    row.setAttribute('role', 'listitem');
    row.setAttribute('data-mid', m.id);
    row.style.setProperty('--r', i);

    var main = el('button', 'row-main');
    main.type = 'button';
    main.setAttribute('aria-expanded', 'false');
    var pair = el('span', 'row-pair');
    pair.appendChild(document.createTextNode(name(m.a)));
    pair.appendChild(el('span', 'and', 'and'));
    pair.appendChild(document.createTextNode(name(m.b)));
    main.appendChild(pair);
    var h1 = hub(m.a), h2 = hub(m.b);
    main.appendChild(el('span', 'row-fact hub', h1 === h2 ? 'Both in ' + h1 : h1 + ' to ' + h2));
    var label = m.candidate && m.candidate.label;
    main.appendChild(el('span', 'row-fact', label ? cap(label) + ' fit' : ''));
    main.appendChild(el('span', 'row-status ' + (yes ? 'yes' : 'no'), yes ? 'Both said yes' : 'Both said no'));
    row.appendChild(main);

    var detail = el('div', 'row-detail');
    var votes = el('div', 'votes');
    [m.a, m.b].forEach(function (id) {
      var v = m.votes && m.votes[id];
      if (!v) return;
      var box = el('div', 'vote');
      var b = el('b', null, name(id) + '’s agent: ' + v.vote);
      b.appendChild(aiTag());
      box.appendChild(b);
      box.appendChild(el('p', null, v.reason));
      votes.appendChild(box);
    });
    detail.appendChild(votes);
    var read = el('button', 'read', 'Read the whole meeting');
    read.type = 'button';
    read.setAttribute('aria-expanded', 'false');
    detail.appendChild(read);
    row.appendChild(detail);

    var tr = el('div', 'transcript');
    tr.hidden = true;
    tr.id = 'tr-' + m.id;
    read.setAttribute('aria-controls', tr.id);
    row.appendChild(tr);

    main.addEventListener('click', function () { openRow(m.id, false); });
    read.addEventListener('click', function () {
      var open = tr.hidden;
      if (open) renderTranscript(m, tr);
      tr.hidden = !open;
      read.setAttribute('aria-expanded', open ? 'true' : 'false');
      read.textContent = open ? 'Hide the meeting' : 'Read the whole meeting';
    });
    rowEls[m.id] = { row: row, main: main, read: read, tr: tr, m: m };
    board.appendChild(row);
  });

  function openRow(id, withTranscript) {
    Object.keys(rowEls).forEach(function (k) {
      var r = rowEls[k], on = k === id;
      r.row.classList.toggle('is-open', on);
      r.main.setAttribute('aria-expanded', on ? 'true' : 'false');
      if (!on) { r.tr.hidden = true; r.read.setAttribute('aria-expanded', 'false'); r.read.textContent = 'Read the whole meeting'; }
    });
    var r = rowEls[id];
    if (r && withTranscript && r.tr.hidden) r.read.click();
  }
  if (yesMeeting && rowEls[yesMeeting.id]) openRow(yesMeeting.id, false);
  setText('bMeetCount', String(meetings.length));
  setText('boardSrc', providerLabel + '.');

  // ---------- How it works: the same introduction, four stages ----------
  var st = run.stats || (D.demo_run && D.demo_run.stats);
  if (st) {
    setText('fPairs', fmt(st.pairs_scored));
    setText('fFits', fmt(st.passed_filter));
    setText('fMeet', fmt(st.meetings));
  }
  if (yesMeeting) {
    var c = yesMeeting.candidate || {};
    if (typeof c.fit === 'number') setText('icFit', c.fit.toFixed(2));
    var t2 = (yesMeeting.transcript || []).filter(function (t) { return t.turn === 2; })[0];
    if (t2) setText('icQuote', '“' + firstSentence(t2.text, 110) + '”');
    var vMe = yesMeeting.votes && yesMeeting.votes[ME];
    if (vMe) setText('icVote', '“' + firstSentence(vMe.reason, 120) + '”');
    var toMe = (yesMeeting.introductions || []).filter(function (x) { return x.to === ME; })[0];
    if (toMe) setText('icIntro', firstSentence(toMe.message, 130));
  }

  // ---------- Who it's for ----------
  var WHO = {
    individual: 'Students and professionals. Your agent finds the Michigan startup or company that would hire you, before an offer from the coasts arrives.',
    startup: 'Startups. Your agent finds your first customer, a pilot site or your next engineer, in sectors you would never walk into.',
    small_business: 'Manufacturers and small businesses. Your agent finds the founder or engineer who can fix the problem on your line.',
    corporation: 'Corporations. Your agent finds the startups and talent worth backing, without a scouting team.'
  };
  var pool = ((D.network_run && D.network_run.members) || D.members || []).map(function (m) { return members[m.id] || m; });
  Object.keys(WHO).forEach(function (t) {
    var n = pool.filter(function (m) { return m.type === t; }).length;
    if (n) setText('cnt-' + t, n + ' synthetic members');
  });
  function renderWho(type) {
    setText('whoLead', WHO[type]);
    var rows = $('whoRows');
    rows.textContent = '';
    var list = pool.filter(function (m) { return m.type === type; });
    list.sort(function (a, b) { return (b.demo ? 1 : 0) - (a.demo ? 1 : 0); });
    list.slice(0, 4).forEach(function (m, i) {
      var b = el('div', 'band');
      b.style.setProperty('--r', i);
      b.appendChild(el('span', 'b-hub', HUBS[m.hub] || m.hub || ''));
      var nm = el('span', 'b-name', m.name);
      nm.appendChild(el('small', null, cap(m.sector || TYPES[m.type] || '')));
      b.appendChild(nm);
      var of = el('span', 'b-offer');
      of.appendChild(el('b', null, 'Needs'));
      of.appendChild(document.createTextNode(cap((m.needs || [])[0] || '')));
      b.appendChild(of);
      rows.appendChild(b);
    });
    var note = el('p', 'who-note', 'Synthetic members from the network run. Every name and company is invented.');
    rows.appendChild(note);
  }
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  function selectTab(tab, focus) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', on ? 'true' : 'false');
      t.tabIndex = on ? 0 : -1;
    });
    $('whoPanel').setAttribute('aria-labelledby', tab.id);
    renderWho(tab.getAttribute('data-type'));
    if (focus) tab.focus();
  }
  tabs.forEach(function (t, i) {
    t.addEventListener('click', function () { selectTab(t); });
    t.addEventListener('keydown', function (e) {
      var k = e.key, j = -1;
      if (k === 'ArrowDown' || k === 'ArrowRight') j = (i + 1) % tabs.length;
      if (k === 'ArrowUp' || k === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
      if (j >= 0) { e.preventDefault(); selectTab(tabs[j], true); }
    });
  });
  renderWho('individual');

  // ---------- Trust switches ----------
  var introduced = meetings.filter(function (m) { return m.result === 'introduced'; }).length;
  var ended = meetings.length - introduced;
  Array.prototype.forEach.call(document.querySelectorAll('.js-meet'), function (e) { e.textContent = String(meetings.length); });
  if (meetings.length) {
    setText('twoYes', 'This run: ' + introduced + ' of ' + meetings.length + ' meetings ended in two yes votes. The other ' +
      ended + ' ended in the room, with the reasons kept.');
  }
  function setSwitch(btn, on, silent) {
    btn.setAttribute('aria-checked', on ? 'true' : 'false');
    var band = btn.closest('.sw');
    if (band) band.classList.toggle('is-on', on);
    if (!silent && btn.getAttribute('aria-label') === 'Pause my agent') setPaused(on);
  }
  Array.prototype.forEach.call(document.querySelectorAll('.sw .toggle'), function (btn) {
    setSwitch(btn, btn.getAttribute('aria-checked') === 'true', true);
    btn.addEventListener('click', function () { setSwitch(btn, btn.getAttribute('aria-checked') !== 'true'); });
  });

  // ---------- Built with IBM ----------
  if (isReal) {
    if (D.chat_model) setText('chatModel', D.chat_model);
    if (D.embed_model) setText('embedModel', D.embed_model);
  } else {
    setText('chatModel', 'the mock provider (dev fallback)');
    setText('embedModel', 'the mock provider (dev fallback)');
  }
  var res = Array.isArray(D.resources) ? D.resources : [];
  if (res.length) {
    var prefer = ['Automation Alley', 'Ann Arbor SPARK', 'The Right Place'];
    var picked = prefer.map(function (n) { return res.filter(function (r) { return r.name === n; })[0]; }).filter(Boolean);
    res.forEach(function (r) { if (picked.length < 3 && picked.indexOf(r) < 0) picked.push(r); });
    picked = picked.slice(0, 3).filter(function (r) { return r.url && /^https?:\/\//.test(r.url); });
    if (picked.length) {
      var p = $('resources');
      p.appendChild(document.createTextNode('Agents can also point members to real Michigan programs, such as '));
      picked.forEach(function (r, i) {
        var a = el('a', null, r.name);
        a.href = r.url; a.rel = 'noopener';
        p.appendChild(a);
        p.appendChild(document.createTextNode(i < picked.length - 2 ? ', ' : i === picked.length - 2 ? ' and ' : ''));
      });
      p.appendChild(document.createTextNode('. Real organisations, not members.'));
      p.hidden = false;
    }
  }

  // ---------- Footer data note ----------
  var dm = $('dataMeta');
  var base = 'Every member and company on this page is synthetic. Every transcript, vote and message is generated by AI and labelled as such. Not affiliated with any university.';
  if (isFallback) dm.textContent = base + ' Data: development fallback on the mock provider.';
  else if (D.generated_at) dm.textContent = base + ' Data: a real Granite run on watsonx.ai, generated ' + String(D.generated_at).slice(0, 10) + '.';

  // ---------- Reveals (once, below the fold) ----------
  var targets = document.querySelectorAll('[data-reveal], [data-ui].board, .how, .sw');
  if (reduced || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(targets, function (e) { e.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.08, rootMargin: '0px 0px -10% 0px' });
    Array.prototype.forEach.call(targets, function (e) { io.observe(e); });
  }

  // ---------- The one moving picture: plays only in view, never under reduced motion ----------
  var clips = Array.prototype.slice.call(document.querySelectorAll('video[autoplay]'));
  if (reduced) {
    clips.forEach(function (v) { v.removeAttribute('autoplay'); v.pause(); });
  } else if ('IntersectionObserver' in window) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function () {}); } else e.target.pause(); });
    }, { threshold: 0.2 });
    clips.forEach(function (v) { vio.observe(v); });
  }

  // ---------- Screenshot mode: ?shot opens the yes meeting, ?shot=no the declined one ----------
  if (shot) {
    var target = qs.get('shot') === 'no' ? noMeeting : yesMeeting;
    if (target) openRow(target.id, true);
    requestAnimationFrame(function () {
      doc.setAttribute('data-scroll-width', String(doc.scrollWidth));
      doc.setAttribute('data-client-width', String(doc.clientWidth));
    });
  }
})();
