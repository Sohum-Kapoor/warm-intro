/* Section 2 (one connection, start to finish) and section 3 (the agent says no). */
(function () {
  'use strict';
  var WI = window.WI, esc = WI.esc;

  function byScore(a, b) { return (b.score || 0) - (a.score || 0); }
  function pairKey(a, b) { return [a, b].sort().join('|'); }
  function involves(m, id) { return m.a === id || m.b === id; }
  function firstSentence(s) { var m = String(s || '').match(/^.*?[.!?](\s|$)/); return m ? m[0].trim() : String(s || ''); }

  function pickFeatured(run) {
    var ms = run.meetings || [];
    return ms.filter(function (m) { return m.result === 'introduced' && involves(m, 'm001'); })[0] ||
      ms.filter(function (m) { return m.result === 'introduced'; })[0] || ms[0] || null;
  }

  function involve(on, name) {
    return on
      ? '<div class="involve on"><i></i>' + esc(name) + "'s people: one message to read</div>"
      : '<div class="involve"><i></i>' + esc(name) + "'s people: not involved</div>";
  }

  function step(n, title, body, visual, opts) {
    opts = opts || {};
    return '<div class="step' + (opts.final ? ' final' : '') + '">' +
      '<div class="node reveal" aria-hidden="true">' + n + '</div>' +
      '<div class="copy reveal"><div class="label-sm">Step ' + n + '</div><h3 style="margin-top:8px">' + title + '</h3><p>' + body + '</p>' + (opts.involve || '') + '</div>' +
      '<div class="visual reveal d1">' + visual + '</div></div>';
  }

  function profileCard(m, needHl) {
    var list = function (xs, hl) {
      return '<ul>' + (xs || []).map(function (x) { return '<li>' + (x === hl ? '<span class="need-hl">' + esc(x) + '</span>' : esc(x)) + '</li>'; }).join('') + '</ul>';
    };
    return '<div class="card">' +
      '<div class="profile-top"><span class="avatar warm" aria-hidden="true">' + esc(WI.initials(m.name)) + '</span><div><div class="profile-name">' + esc(m.name) + '</div>' +
      '<div class="profile-meta">' + esc(WI.type(m.type)) + ' · ' + esc(m.sector) + ' · ' + esc(WI.hub(m.hub)) + '</div></div>' +
      '<span class="chip" style="margin-left:auto">synthetic</span></div>' +
      '<p class="profile-desc">' + esc(m.description) + '</p>' +
      '<dl class="kv"><dt>Needs</dt><dd>' + list(m.needs, needHl) + '</dd>' +
      '<dt>Offers</dt><dd>' + list(m.offers) + '</dd>' +
      (m.deal_breakers ? '<dt>Won\'t accept</dt><dd><div class="chips">' + m.deal_breakers.map(function (d) { return '<span class="chip no">' + esc(d) + '</span>'; }).join('') + '</div></dd>' : '') +
      (m.intro_budget != null ? '<dt>Budget</dt><dd>' + m.intro_budget + ' introductions per round</dd>' : '') +
      '</dl></div>';
  }

  function funnel(run) {
    var st = run.stats || {};
    var intros = (run.meetings || []).filter(function (m) { return m.result === 'introduced'; }).length;
    var msgs = (run.introductions || []).length;
    var rows = [
      { n: st.pairs_scored || 0, label: 'possible pairs scored across the network' },
      { n: st.passed_filter || 0, label: 'passed the fit filter' },
      { n: st.meetings || (run.meetings || []).length, label: 'first meetings held by agents' },
      { n: intros, label: 'introductions (' + msgs + ' messages, one to each member)', warm: true }
    ];
    var max = Math.log10(Math.max(10, rows[0].n));
    return '<div class="card"><div class="funnel" id="funnel">' + rows.map(function (r) {
      var w = r.n > 0 ? Math.max(3, Math.log10(r.n + 1) / (max + 0.0001) * 100) : 0;
      return '<div class="frow' + (r.warm ? ' warm' : '') + '"><div class="ftop"><span class="fnum" data-n="' + r.n + '">0</span><span class="flabel">' + esc(r.label) + '</span></div>' +
        '<div class="fbar"><span data-w="' + w.toFixed(1) + '"></span></div></div>';
    }).join('') + '</div><p class="funnel-note">One full round on the synthetic network of ' + WI.members.length + ' members. Bars on a log scale. Each member gets at most three meetings per round.</p></div>';
  }

  function evidenceBlock(c, focusId) {
    return (c.evidence || []).map(function (e) {
      var sim = e.similarity || 0;
      return '<div class="ev"><div class="ev-row">' +
        '<div class="ev-side"><div class="who">' + esc(WI.name(e.need_of)) + ' needs</div><div class="what">' + esc(e.need) + '</div></div>' +
        '<div class="ev-link" aria-hidden="true"><svg viewBox="0 0 34 14"><path d="M1 7h32M5 2 1 7l4 5M29 2l4 5-4 5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>' + sim.toFixed(2) + '</div>' +
        '<div class="ev-side"><div class="who">' + esc(WI.name(e.offer_of)) + ' offers</div><div class="what">' + esc(e.offer) + '</div></div>' +
        '</div><div class="simbar" role="img" aria-label="similarity ' + sim.toFixed(2) + '"><span style="width:' + Math.round(sim * 100) + '%"></span></div></div>';
    }).join('');
  }

  function shortlist(run, feat) {
    var cands = (run.candidates || []).slice().sort(byScore);
    var key = pairKey(feat.a, feat.b);
    var idx = -1;
    cands.forEach(function (c, i) { if (idx < 0 && pairKey(c.a, c.b) === key) idx = i; });
    var shown = cands.slice(0, 5);
    if (idx >= 5) shown.push(cands[idx]);
    var c = idx >= 0 ? cands[idx] : (feat.candidate || {});
    var rows = shown.map(function (x) {
      var me = pairKey(x.a, x.b) === key;
      var rank = cands.indexOf(x) + 1;
      return '<li class="' + (me ? 'me' : '') + '"><span class="rk">#' + rank + '</span><span>' + esc(WI.name(x.a)) + ' × ' + esc(WI.name(x.b)) + '</span><span class="sc">' + WI.fmt(x.score, 3) + '</span></li>';
    }).join('');
    var a = WI.member(c.a), b = WI.member(c.b);
    return {
      rank: idx + 1, total: cands.length, cand: c,
      html: '<div class="card"><div class="label-sm" style="margin-bottom:12px">Top pairs in the network, by score</div><ol class="shortlist">' + rows + '</ol>' +
        '<div class="evidence">' + evidenceBlock(c) + '</div>' +
        '<div class="chips score-chips">' +
          '<span class="chip scan">fit ' + WI.fmt(c.fit, 3) + '</span>' +
          '<span class="chip">novelty ' + WI.fmt(c.novelty, 2) + '</span>' +
          '<span class="chip">learned weight ×' + WI.fmt(c.weight, 2) + '</span>' +
          (c.cross_hub ? '<span class="chip">cross-hub · ' + esc(WI.hub(a.hub)) + ' ↔ ' + esc(WI.hub(b.hub)) + '</span>' : '') +
          (c.label ? '<span class="chip warm">' + esc(c.label) + '</span>' : '') +
        '</div></div>'
    };
  }

  WI.register(function connection() {
    var run = WI.network;
    var feat = pickFeatured(run);
    var host = document.getElementById('steps');
    if (!feat || !host) { if (host) host.innerHTML = '<div class="empty-state">No meetings in this run.</div>'; return; }

    var focusId = involves(feat, 'm001') ? 'm001' : feat.b;
    var otherId = feat.a === focusId ? feat.b : feat.a;
    var F = WI.member(focusId), O = WI.member(otherId);
    WI.storyFocus = focusId;
    var evFocus = ((feat.candidate || {}).evidence || []).filter(function (e) { return e.need_of === focusId; })[0];
    var others = WI.members.length - 1;

    document.getElementById('storyTitle').textContent =
      focusId === 'm001' ? 'A stamping plant meets the startup that fixes its scrap problem.' : F.name + ' meets ' + O.name + '.';
    document.getElementById('storyLede').innerHTML =
      'Follow ' + esc(F.name) + "'s agent through one real round on the synthetic network" + (WI.data.provider === 'watsonx' ? ', generated with Granite on watsonx.ai. ' : '. ') +
      'Watch the badge under each step: nobody at ' + esc(F.name) + ' does anything until the last one.';

    var eb = document.querySelector('#connection .eyebrow');
    if (eb && WI.data.provider !== 'watsonx') eb.textContent = 'One connection, start to finish · recorded run';
    var sl = shortlist(run, feat);
    var passed = (run.stats || {}).passed_filter || sl.total;
    var intro = (feat.introductions || run.introductions || []).filter(function (i) { return i.meeting_id === feat.id && i.to === focusId; })[0] ||
      (run.introductions || []).filter(function (i) { return i.meeting_id === feat.id && i.to === focusId; })[0];
    var yesCount = Object.keys(feat.votes || {}).filter(function (k) { return feat.votes[k].vote === 'yes'; }).length;

    var html = '';
    html += step('01', 'The need',
      esc(F.name) + ', a ' + esc(WI.type(F.type).toLowerCase()) + ' in ' + esc(WI.hub(F.hub)) + ', has a problem it can name. ' +
      (evFocus ? 'It needs <b class="hl-scan">' + esc(evFocus.need) + '</b>. ' : '') +
      'Its agent holds the profile, the deal-breakers and a small budget of introductions it may accept. That is the whole setup.',
      profileCard(F, evFocus && evFocus.need), { involve: involve(false, F.name) });
    html += step('02', 'The scan',
      esc(F.name) + "'s agent compares its needs and offers with all " + others + ' other members, in both directions. ' +
      'Scoring is arithmetic on Granite embeddings, so every possible pair in the network gets scored, and only the few that clear the fit threshold ever cost a meeting.',
      funnel(run), { involve: involve(false, F.name) });
    html += step('03', 'The shortlist',
      esc(O.name) + ', a ' + esc(WI.type(O.type).toLowerCase()) + ' in ' + esc(WI.hub(O.hub)) + ', ranks #' + sl.rank + ' of the ' + passed + ' pairs that passed the fit filter network-wide. ' +
      'The evidence is specific: each side offers almost exactly what the other needs. Different sector, different city: a pair that would never share a room.',
      sl.html, { involve: involve(false, F.name) });
    html += step('04', 'The agents meet',
      'The two agents hold the first meeting themselves, a few turns each. Each speaks only from its own member\'s profile and goals, and each is told to protect its member\'s time, not to make a deal.',
      '<div class="card"><div class="chat-head"><span class="label-sm">Meeting ' + esc(feat.id) + ' · ' + esc(O.name) + ' × ' + esc(F.name) + '</span>' +
      '<button class="btn small" id="replayChat" type="button">↻ Replay</button></div><div class="chat" id="storyChat"></div></div>',
      { involve: involve(false, F.name) });
    html += step('05', 'Both vote',
      'Each agent votes yes or no with a one-sentence reason. Two yes votes make an introduction. Anything else ends there, and the reason is kept.',
      '<div class="votes" id="storyVotes">' + Object.keys(feat.votes || {}).map(function (id) { return WI.voteCard(id, feat.votes[id]); }).join('') +
      '<div class="verdict"><b>' + yesCount + ' of 2 YES</b> → introduction approved. Each agent now writes to its own member, and only its own.</div></div>',
      { involve: involve(false, F.name) });
    html += step('06', 'The introduction',
      'Only now does anyone at ' + esc(F.name) + ' hear about it: one message from its own agent, with who, why, what was discussed and a proposed next step. ' + esc(O.name) + ' gets the mirror message from its agent.',
      '<div class="phone-wrap"><div class="phone" aria-label="Phone lock screen showing the introduction message"><div class="screen">' +
        '<div class="notch"></div><div class="lock-time">9:41</div><div class="lock-date">Friday, November 13</div>' +
        '<div class="notif" id="notif"><div class="notif-app"><span class="appicon"><svg viewBox="0 0 12 12"><circle cx="3.5" cy="7.5" r="2" fill="#1a0f02"/><circle cx="8.5" cy="4.5" r="2" fill="#1a0f02"/><path d="M3.5 7.5 8.5 4.5" stroke="#1a0f02" stroke-width="1"/></svg></span>Warm Intro · your agent<time>now</time></div>' +
        '<h4>Introduction: ' + esc(O.name) + '</h4><p>' + esc(intro ? intro.message : 'Introduction message unavailable in this run.') + '</p>' +
        '<span class="ai-tag">AI-generated message</span>' +
        '<div class="notif-actions"><span>Not now</span><span class="go">Book a call</span></div></div>' +
      '</div></div></div>' +
      '<div class="nobody"><div class="big">Nobody at ' + esc(F.name) + ' lifted a finger until <em>both agents said yes.</em></div>' +
      '<p>No searching, no cold emails, no meeting that went nowhere. The scan, the shortlist, the first meeting and the vote all happened without them.</p>' +
      '<div class="timer"><div><b>0 min</b>spent before this message</div><div><b>' + (feat.transcript || []).length + '</b>agent turns, AI-generated</div><div><b>' + yesCount + ' / 2</b>yes votes</div></div></div>' +
      '<div id="suggestSlot"></div>',
      { final: true, involve: involve(true, F.name) });
    host.innerHTML = html;

    // Animations
    var fun = document.getElementById('funnel');
    WI.onView(fun, function () {
      fun.querySelectorAll('.fnum').forEach(function (el, i) {
        setTimeout(function () { WI.countUp(el, +el.dataset.n, 1300); }, WI.reduced ? 0 : i * 260);
      });
      fun.querySelectorAll('.fbar span').forEach(function (el, i) {
        setTimeout(function () { el.style.width = el.dataset.w + '%'; }, WI.reduced ? 0 : i * 260);
      });
    }, 0.4);

    var chat = document.getElementById('storyChat');
    var play = function () { return WI.playChat(chat, feat.transcript || [], focusId, 1200); };
    WI.onView(chat, play, 0.3);
    document.getElementById('replayChat').addEventListener('click', play);

    var notif = document.getElementById('notif');
    WI.onView(notif, function () { setTimeout(function () { notif.classList.add('show'); }, WI.reduced ? 0 : 500); }, 0.5);
  });

  // ---------- Section 3: the agent says no ----------
  function markOverlap(text, words) {
    var out = esc(text);
    words.forEach(function (w) {
      var re = new RegExp('\\b(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\w*)', 'i');
      out = out.replace(re, '<mark>$1</mark>');
    });
    return out;
  }

  WI.register(function declined() {
    var run = WI.network;
    var ms = (run.meetings || []).filter(function (m) { return m.result === 'declined'; });
    var m = ms.filter(function (x) { return involves(x, 'm003'); })[0] || ms[0];
    var lede = document.getElementById('noLede');
    var right = document.getElementById('noMeeting');
    if (!m) { lede.textContent = 'No meeting in this run ended in no.'; return; }

    var personId = WI.member(m.a).type === 'individual' ? m.a : (WI.member(m.b).type === 'individual' ? m.b : m.a);
    var otherId = personId === m.a ? m.b : m.a;
    var P = WI.member(personId), O = WI.member(otherId);

    // Find the deal-breaker that the other side's offer runs into.
    var hit = null;
    (P.deal_breakers || []).forEach(function (db) {
      var words = db.toLowerCase().split(/[^a-z]+/).filter(function (w) { return w.length > 3; }).map(function (w) { return w.replace(/s$/, ''); });
      (O.offers || []).forEach(function (off) {
        var lw = off.toLowerCase();
        var found = words.filter(function (w) { return lw.indexOf(w) >= 0; });
        if (found.length && (!hit || found.length > hit.n)) hit = { db: db, offer: off, n: found.length, words: [found.sort(function (x, y) { return y.length - x.length; })[0]] };
      });
    });
    var needPaid = (P.needs || []).filter(function (n) { return /paid/i.test(n); })[0] || (P.needs || [])[0];

    var noes = Object.keys(m.votes || {}).filter(function (id) { return m.votes[id].vote !== 'yes'; }).length;
    lede.innerHTML = esc(P.name) + ', a ' + esc(String(P.sector || WI.type(P.type)).toLowerCase()) + ' in ' + esc(WI.hub(P.hub)) + ', and ' + esc(O.name) + ', a ' +
      esc(WI.type(O.type).toLowerCase()) + ' in ' + esc(WI.hub(O.hub)) + ', look like a perfect match on paper. Their agents met, found the catch, and ' + (noes > 1 ? 'both voted no' : 'one voted no') + '. ' +
      'Neither person was contacted. The reason is kept, and it feeds what the network learns.';

    var clash = document.getElementById('clash');
    if (hit) {
      clash.innerHTML =
        '<div class="card"><div class="row"><span class="avatar sm alt" aria-hidden="true">' + esc(WI.initials(P.name)) + '</span><b>' + esc(P.name) + '</b><span class="chip" style="margin-left:auto">' + esc(WI.type(P.type)) + '</span></div>' +
        (needPaid ? '<div class="line">Needs: ' + esc(needPaid) + '</div>' : '') +
        '<div class="line">Deal-breaker: ' + markOverlap(hit.db, hit.words) + '</div></div>' +
        '<div class="clash-x" aria-hidden="true">✕ CONFLICT</div>' +
        '<div class="card"><div class="row"><span class="avatar sm" aria-hidden="true">' + esc(WI.initials(O.name)) + '</span><b>' + esc(O.name) + '</b><span class="chip" style="margin-left:auto">' + esc(WI.type(O.type)) + '</span></div>' +
        '<div class="line">Offers: ' + markOverlap(hit.offer, hit.words) + '</div></div>';
    } else {
      clash.remove();
    }

    var cands = (run.candidates || []).slice().sort(byScore);
    var rank = -1;
    cands.forEach(function (c, i) { if (rank < 0 && pairKey(c.a, c.b) === pairKey(m.a, m.b)) rank = i + 1; });
    var top = document.getElementById('topScore');
    var c = m.candidate || {};
    if (rank > 0) {
      top.hidden = false;
      top.innerHTML = (rank === 1 ? 'This was the <b>highest-scoring pair in the entire network</b>' : 'This pair ranked <b>#' + rank + ' of ' + cands.length + '</b> in the network') +
        ', with a fit of ' + WI.fmt(c.fit, 2) + '. The scout can only see that the words match. The agents saw that the terms don\'t.';
    }

    right.innerHTML = '<div class="card no-chat"><div class="chat-head"><span class="label-sm">Meeting ' + esc(m.id) + ' · ' + esc(P.name) + ' × ' + esc(O.name) + '</span><span class="ai-tag">AI-generated transcript</span></div>' +
      '<div class="chat" id="noChat"></div>' +
      '<div class="votes" style="margin-top:18px">' + Object.keys(m.votes || {}).map(function (id) { return WI.voteCard(id, m.votes[id]); }).join('') +
      '<div class="verdict no"><b>DECLINED</b> No introduction. Nobody was contacted. The reason is kept.</div></div></div>';
    var chat = document.getElementById('noChat');
    WI.onView(chat, function () { WI.playChat(chat, m.transcript || [], otherId, 900); }, 0.3);
  });
})();
