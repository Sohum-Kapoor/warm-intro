/* Warm Intro home page. Classic script, no modules, no fetch: works from file:// and GitHub Pages. */
(function () {
  'use strict';
  var doc = document.documentElement;
  doc.classList.add('js');

  var D = window.WARM_INTRO || window.WARM_INTRO_FALLBACK || {};
  var isFallback = !!window.WARM_INTRO_IS_FALLBACK;
  var qs = new URLSearchParams(location.search);
  var shot = qs.has('shot');
  var reduced = shot || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (reduced) doc.classList.add('no-motion');

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function aiTag() { var t = el('span', 'ai', 'AI-generated'); return t; }

  // Members: run data first, then any member listed inside a run.
  var members = {};
  (D.members || []).forEach(function (m) { members[m.id] = m; });
  [D.network_run, D.demo_run].forEach(function (r) {
    ((r && r.members) || []).forEach(function (m) { if (!members[m.id]) members[m.id] = m; });
  });
  function name(id) { return (members[id] && members[id].name) || id; }
  var TYPES = { individual: 'Individual', startup: 'Startup', small_business: 'Small business', corporation: 'Corporation' };
  var HUBS = { detroit: 'Detroit', grand_rapids: 'Grand Rapids', ann_arbor: 'Ann Arbor' };
  function meta(id) {
    var m = members[id] || {};
    return [TYPES[m.type] || m.type, HUBS[m.hub] || m.hub].filter(Boolean).join(' · ');
  }
  function initials(n) {
    return String(n || '?').replace(/[^A-Za-z .&]/g, '').split(/\s+/).filter(Boolean).slice(0, 2)
      .map(function (w) { return w[0]; }).join('').toUpperCase();
  }

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

  var providerLabel = D.provider === 'watsonx'
    ? 'Real run · Granite on watsonx.ai'
    : 'Dev fallback · mock provider';

  // The two card states. Copy for the card face; everything inside "Read the meeting" comes from the data.
  var STATES = {
    yes: {
      viewer: 'm001', other: 'm002',
      forLine: 'for ' + name('m001'),
      title: 'Your agent found 1 introduction',
      why: 'Camera inspection for your stamping line',
      note: name('m001') + ', a stamping plant in Grand Rapids, sees one introduction this week.',
      meeting: findMeeting('m002', 'm001')
    },
    no: {
      viewer: 'm003', other: 'm004',
      forLine: 'for ' + name('m003'),
      title: 'Your agent passed on 1 meeting',
      why: 'Flight software roles on a drone team',
      note: name('m003') + ', a robotics student in Ann Arbor, is never interrupted. Her agent kept the reason.',
      meeting: findMeeting('m003', 'm004')
    }
  };
  var current = 'yes';

  var popup = $('popup'), readBtn = $('readBtn'), helloBtn = $('helloBtn'), helloNote = $('helloNote');
  var meetingEl = $('meeting');

  function renderCard(key) {
    var s = STATES[key];
    var isNo = key === 'no';
    popup.classList.toggle('is-no', isNo);
    $('popFor').textContent = s.forLine;
    $('popTitle').textContent = s.title;
    $('popName').textContent = name(s.other);
    $('popMeta').textContent = meta(s.other);
    $('popAvatar').textContent = initials(name(s.other));
    $('popWhy').textContent = s.why;
    var v = $('popVerdict');
    v.textContent = '';
    var mark = el('span', 'vv' + (isNo ? ' no' : ' yes'), isNo ? 'NO · NO' : '✓✓');
    mark.setAttribute('aria-hidden', 'true');
    v.appendChild(mark);
    v.appendChild(document.createTextNode(isNo ? ' Both agents said no: unpaid roles' : ' Both agents said yes'));
    var reason = $('popReason');
    var vote = s.meeting && s.meeting.votes && s.meeting.votes[s.viewer];
    if (isNo && vote) {
      reason.textContent = '';
      reason.appendChild(document.createTextNode('“' + vote.reason + '”'));
      reason.appendChild(aiTag());
      reason.hidden = false;
    } else {
      reason.hidden = true;
    }
    helloBtn.hidden = isNo;
    helloNote.hidden = true;
    readBtn.hidden = !s.meeting;
    $('toggleNote').textContent = s.note;
  }

  function renderMeeting(key) {
    var s = STATES[key];
    var m = s.meeting;
    if (!m) return;
    var isNo = m.result !== 'introduced';
    $('meetingKicker').textContent = isNo ? 'The meeting that ended in two no votes' : 'The meeting your agent took';
    $('meetingTitle').textContent = name(m.a) + '’s agent meets ' + name(m.b) + '’s agent';
    var src = $('meetingSrc');
    src.textContent = providerLabel + (D.chat_model ? ' · ' : '');
    if (D.chat_model) src.appendChild(el('code', null, D.chat_model));
    src.appendChild(document.createTextNode('. Synthetic members. Every line below is AI-generated.'));

    var list = $('transcript');
    list.textContent = '';
    (m.transcript || []).forEach(function (t) {
      var li = el('li', 'line ' + (t.speaker === m.a ? 'side-a' : 'side-b'));
      var who = el('div', 'who', 'Agent for ' + name(t.speaker));
      var small = el('small', null, 'Turn ' + t.turn);
      small.appendChild(aiTag());
      who.appendChild(small);
      li.appendChild(who);
      li.appendChild(el('p', null, t.text));
      list.appendChild(li);
    });

    var votes = $('votes');
    votes.textContent = '';
    [m.a, m.b].forEach(function (id) {
      var v = m.votes && m.votes[id];
      if (!v) return;
      var box = el('div', 'vote');
      var top = el('div', 'vote-top');
      top.appendChild(el('span', null, name(id) + '’s agent votes'));
      top.appendChild(el('span', 'verdict ' + (v.vote === 'yes' ? 'yes' : 'no'), v.vote));
      top.appendChild(aiTag());
      box.appendChild(top);
      box.appendChild(el('p', null, v.reason));
      votes.appendChild(box);
    });

    var intro = $('introMsg');
    intro.textContent = '';
    var msg = (m.introductions || []).filter(function (x) { return x.to === s.viewer; })[0];
    if (msg) {
      var label = el('p', 'label', 'What ' + name(s.viewer) + '’s agent wrote to ' + name(s.viewer));
      label.appendChild(aiTag());
      intro.appendChild(label);
      intro.appendChild(el('blockquote', null, msg.message));
    } else {
      intro.appendChild(el('p', 'label', 'No introduction'));
      intro.appendChild(el('p', 'none', 'Two no votes, so neither member was contacted. The reasons are kept so the network learns from them.'));
    }
  }

  function setExpanded(open, focus) {
    readBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    readBtn.textContent = open ? 'Hide the meeting' : 'Read the meeting';
    if (open) {
      renderMeeting(current);
      meetingEl.hidden = false;
      if (!reduced) { meetingEl.classList.remove('enter'); void meetingEl.offsetWidth; meetingEl.classList.add('enter'); }
      if (focus) {
        meetingEl.focus({ preventScroll: true });
        meetingEl.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      }
    } else {
      meetingEl.hidden = true;
    }
  }

  function setState(key, animate) {
    if (key === current && !animate) return;
    current = key;
    document.querySelectorAll('.tog').forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-state') === key ? 'true' : 'false');
    });
    var open = readBtn.getAttribute('aria-expanded') === 'true';
    function apply() {
      renderCard(key);
      if (open) renderMeeting(key);
      popup.classList.remove('swap');
    }
    if (reduced) { apply(); return; }
    popup.classList.add('swap');
    setTimeout(apply, 180);
  }

  document.querySelectorAll('.tog').forEach(function (b) {
    b.addEventListener('click', function () { setState(b.getAttribute('data-state')); });
  });
  readBtn.addEventListener('click', function () {
    setExpanded(readBtn.getAttribute('aria-expanded') !== 'true', true);
  });
  helloBtn.addEventListener('click', function () {
    helloNote.textContent = 'Concept UI: in the pilot, this opens a message to ' + name(STATES.yes.other) + '. Nothing is sent from this page.';
    helloNote.hidden = false;
  });

  renderCard('yes');

  // Number line from the network run's own stats.
  var st = (D.network_run && D.network_run.stats) || (D.demo_run && D.demo_run.stats);
  if (st) {
    var f = function (n) { return typeof n === 'number' ? n.toLocaleString('en-US') : '–'; };
    $('fPairs').textContent = f(st.pairs_scored);
    $('fFits').textContent = f(st.passed_filter);
    $('fMeet').textContent = f(st.meetings);
    $('funnelCap').textContent = D.provider === 'watsonx'
      ? 'From one network run on Granite. Synthetic members.'
      : 'From the dev fallback run on the mock provider. Synthetic members.';
  }

  // Model ids.
  if (D.provider === 'watsonx') {
    if (D.chat_model) $('chatModel').textContent = D.chat_model;
    if (D.embed_model) $('embedModel').textContent = D.embed_model;
  } else {
    $('chatModel').textContent = 'mock provider (dev fallback)';
    $('embedModel').textContent = 'mock provider (dev fallback)';
  }

  // Optional: three real Michigan programs agents can point members to.
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

  // Footer data note.
  var dm = $('dataMeta');
  if (isFallback) dm.textContent = 'Data: development fallback on the mock provider. Synthetic members, AI-generated text.';
  else if (D.generated_at) dm.textContent = 'Data: real Granite run on watsonx.ai, generated ' + String(D.generated_at).slice(0, 10) + '. Synthetic members, AI-generated text.';

  // Sticky bar border once scrolled.
  var bar = document.querySelector('.bar');
  var onScroll = function () { bar.classList.toggle('scrolled', window.scrollY > 8); };
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Reveal on scroll. Visible by default without JS; reduced motion and screenshot mode show everything at once.
  var els = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    els.forEach(function (e) { e.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  // Screenshot mode: ?shot opens the meeting (or ?shot=no for the declined state) and records page width.
  if (shot) {
    if (qs.get('shot') === 'no') setState('no', true);
    setExpanded(true, false);
    requestAnimationFrame(function () {
      doc.setAttribute('data-scroll-width', String(doc.scrollWidth));
      doc.setAttribute('data-client-width', String(doc.clientWidth));
    });
  }
})();
