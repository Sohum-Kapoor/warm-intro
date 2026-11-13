/* Section 4: ask your agent. Preset requests from the data, typed into a fake input, then ranked results and the meeting outcome. */
(function () {
  'use strict';
  var WI = window.WI, esc = WI.esc;

  function reqId(a) { return typeof a.requester === 'object' && a.requester ? a.requester.id : a.requester; }

  WI.register(function ask() {
    var prompts = document.getElementById('prompts');
    var out = document.getElementById('console');
    var title = document.getElementById('consoleTitle');
    if (!prompts || !out) return;
    var asks = WI.asks.filter(function (a) { return a && a.request; });

    if (!asks.length) {
      prompts.innerHTML = '<div class="empty-state">Preset requests appear here when the site data includes an ask-mode run.</div>';
      out.innerHTML = '<div class="empty-state">On request, a member types what it needs and its agent ranks the network the same way it does in a proactive round. This build has no recorded ask-mode run to replay.</div>';
      return;
    }

    var token = 0;
    function render(i) {
      var a = asks[i], my = ++token;
      var rid = reqId(a), R = WI.member(rid);
      prompts.querySelectorAll('.prompt').forEach(function (b, j) { b.setAttribute('aria-pressed', j === i ? 'true' : 'false'); });
      title.textContent = 'agent for ' + R.name;
      out.innerHTML = '<div class="ask-input"><span class="to">to my agent ›</span><span><span class="typed"></span><span class="caret"></span></span></div><div class="scanline" id="scanline"></div><ol class="results" id="results"></ol><div id="outcome"></div>';
      var typed = out.querySelector('.typed');
      var live = function () { return my === token; };

      var p = Promise.resolve();
      if (WI.reduced) typed.textContent = a.request;
      else {
        p = new Promise(function (res) {
          var k = 0;
          (function tick() {
            if (!live()) return res();
            typed.textContent = a.request.slice(0, ++k);
            if (k < a.request.length) setTimeout(tick, 16 + Math.random() * 18); else res();
          })();
        });
      }
      p.then(function () {
        if (!live()) return;
        var sl = out.querySelector('#scanline');
        sl.innerHTML = '<span class="pulse"></span>Treating the request as a one-off need · scoring ' + (WI.members.length - 1) + ' members…';
        return WI.wait(900);
      }).then(function () {
        if (!live()) return;
        var cands = (a.candidates || []).slice(0, 3);
        var sl = out.querySelector('#scanline');
        sl.innerHTML = cands.length + (cands.length === 1 ? ' member' : ' members') + ' cleared the fit threshold' + (cands.length < 3 ? ' (the rest fell below it)' : '') + '.';
        var ol = out.querySelector('#results');
        return cands.reduce(function (pp, c, k) {
          return pp.then(function () {
            if (!live()) return;
            var oid = c.a === rid ? c.b : c.a, O = WI.member(oid);
            var ev = (c.evidence || []).filter(function (e) { return e.offer_of === oid; })[0] || (c.evidence || [])[0] || {};
            ol.appendChild(WI.h('<li class="result"><span class="rk">' + (k + 1) + '</span><div><div class="nm">' + esc(O.name) + '</div>' +
              '<div class="meta">' + esc(WI.type(O.type)) + ' · ' + esc(O.sector || '') + ' · ' + esc(WI.hub(O.hub)) + (c.cross_hub ? ' · cross-hub' : '') + '</div>' +
              '<div class="why">Why: offers <b>' + esc(ev.offer || '') + '</b></div></div>' +
              '<div class="sim"><b>' + WI.fmt(c.score, 2) + '</b>score<br>fit ' + WI.fmt(c.fit, 2) + '</div></li>'));
            return WI.wait(380);
          });
        }, Promise.resolve());
      }).then(function () {
        if (!live()) return;
        return WI.wait(500);
      }).then(function () {
        if (!live()) return;
        var m = a.meeting, box = out.querySelector('#outcome');
        if (!m) { box.innerHTML = '<div class="empty-state" style="margin-top:16px">No meeting was held for this request.</div>'; return; }
        var yes = m.result === 'introduced';
        var other = m.a === rid ? m.b : m.a;
        box.innerHTML = '<div class="outcome"><div class="label-sm">Agents met with #1 · ' + esc(WI.name(other)) + '</div>' +
          '<div class="votes">' + Object.keys(m.votes || {}).map(function (id) { return WI.voteCard(id, m.votes[id]); }).join('') +
          '<div class="verdict' + (yes ? '' : ' no') + '"><b>' + (yes ? 'INTRODUCED' : 'DECLINED') + '</b>' +
          (yes ? 'Both agents said yes. Each one messages its own member.' : (function () { var n = Object.keys(m.votes || {}).filter(function (id) { return m.votes[id].vote !== 'yes'; }).length; return (n > 1 ? 'Both agents said no' : 'One agent said no') + ', so nobody is contacted. The reason is kept.'; })()) + '</div></div>' +
          '<details><summary>Read the agents\' meeting (' + (m.transcript || []).length + ' turns, AI-generated)</summary><div class="chat"></div></details></div>';
        var chat = box.querySelector('.chat');
        (m.transcript || []).forEach(function (t) { chat.appendChild(WI.bubble(t, rid)); });
      });
    }

    asks.forEach(function (a, i) {
      var R = WI.member(reqId(a));
      var b = WI.h('<button type="button" class="prompt" aria-pressed="false"><span class="avatar sm' + (i % 2 ? ' alt' : '') + '" aria-hidden="true">' + esc(WI.initials(R.name)) + '</span>' +
        '<span><span class="q">“' + esc(a.request) + '”</span><span class="who" style="display:block">' + esc(R.name) + ' · ' + esc(WI.type(R.type)) + ' · ' + esc(WI.hub(R.hub)) + '</span></span></button>');
      b.addEventListener('click', function () { render(i); });
      prompts.appendChild(b);
    });

    out.innerHTML = '<div class="empty-state">Pick a request to see the agent rank the network.</div>';
    WI.onView(out, function () { render(0); }, 0.35);
  });
})();
