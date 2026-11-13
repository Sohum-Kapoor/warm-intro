/* Section 5: the network learns. Outcomes recorded, weight change per kind of connection, rankings before and after. */
(function () {
  'use strict';
  var WI = window.WI, esc = WI.esc;
  var OUTCOME = { pilot: 'pilot started', hire: 'hired', partnership: 'partnership', no_follow_up: 'no follow-up' };

  function outcomes(list) {
    if (!list || !list.length) return '<div class="empty-state">No simulated outcomes in this build.</div>';
    return '<div class="outcomes">' + list.map(function (o) {
      var pair = o.meeting_pair || [o.a, o.b];
      var good = o.outcome !== 'no_follow_up';
      var k = WI.kindLabel(o.key || '');
      return '<div class="outcome-card"><div class="pair">' + esc(WI.name(pair[0])) + ' × ' + esc(WI.name(pair[1])) + '</div>' +
        '<div class="k">' + esc(k.pair) + ' · ' + esc(k.label) + '</div>' +
        '<div class="res"><span class="chip ' + (good ? 'warm' : 'no') + '">' + esc(OUTCOME[o.outcome] || o.outcome) + (o.times ? ' × ' + o.times : '') + '</span></div></div>';
    }).join('') + '</div>';
  }

  function weights(before, after) {
    var keys = Object.keys(after || before || {});
    if (!keys.length) return '<div class="empty-state">No weights in this build.</div>';
    var lo = 0.5, hi = 1.5;
    var pos = function (v) { return ((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo) * 100).toFixed(2) + '%'; };
    keys.sort(function (x, y) {
      var dx = Math.abs((after[x] || 1) - (before[x] || 1)), dy = Math.abs((after[y] || 1) - (before[y] || 1));
      return dy - dx || (after[y] || 1) - (after[x] || 1);
    });
    return '<div class="wrows">' + keys.map(function (k) {
      var b = before[k] != null ? before[k] : 1, a = after[k] != null ? after[k] : 1;
      var d = a - b, ch = Math.abs(d) > 0.0005, up = d > 0;
      var kl = WI.kindLabel(k);
      var left = Math.min(a, b), right = Math.max(a, b);
      return '<div class="wrow' + (ch ? ' changed' : '') + '"><div class="wk">' + esc(kl.pair) + '<small>' + esc(kl.label) + '</small></div>' +
        '<div class="wtrack" role="img" aria-label="weight ' + b.toFixed(2) + ' to ' + a.toFixed(2) + '"><span class="one" style="left:50%"></span>' +
        (ch ? '<span class="seg" style="left:' + pos(left) + ';width:calc(' + pos(right) + ' - ' + pos(left) + ');background:' + (up ? 'rgba(94,242,214,.5)' : 'rgba(255,123,110,.5)') + '"></span><span class="dot before" style="left:' + pos(b) + '"></span>' : '') +
        '<span class="dot after' + (ch && !up ? ' down' : '') + '" style="left:' + pos(a) + (ch ? '' : ';background:#8a96ae;box-shadow:none') + '"></span></div>' +
        '<div class="wval' + (ch ? (up ? ' up' : ' down') : '') + '">' + (ch ? b.toFixed(2) + '→' + a.toFixed(2) : '×' + a.toFixed(2)) + '</div></div>';
    }).join('') + '</div><div class="wscale"><div></div><div><span>×0.5</span><span>×1.0</span><span>×1.5</span></div><div></div></div>';
  }

  function rankings(before, after) {
    if (!before || !before.length || !after || !after.length) return '<div class="empty-state">Before-and-after rankings appear when the learning simulation is included in the site data.</div>';
    var key = function (r) { return [r.a, r.b].sort().join('|'); };
    var posBefore = {}, posAfter = {};
    before.forEach(function (r, i) { posBefore[key(r)] = i; });
    after.forEach(function (r, i) { posAfter[key(r)] = i; });
    function row(r, i, cmp, isAfter) {
      var j = cmp[key(r)], cls = '', mv = '';
      if (j == null) { cls = isAfter ? 'new' : ''; mv = isAfter ? 'NEW' : '<span class="mv same">drops out</span>'; }
      else if (isAfter && j > i) { cls = 'up'; mv = '▲ ' + (j - i); }
      else if (isAfter && j < i) { cls = 'down'; mv = '▼ ' + (i - j); }
      else if (!isAfter) { mv = j === i ? '<span class="mv same">=</span>' : '<span class="mv same">→ ' + (j + 1) + '</span>'; }
      else { mv = '<span class="mv same">=</span>'; }
      var kl = WI.kindLabel((r.kind || '') + '|' + (r.label || ''));
      return '<li class="' + cls + '"><span class="n">' + (i + 1) + '</span><span class="p">' + esc(r.a_name || WI.name(r.a)) + ' × ' + esc(r.b_name || WI.name(r.b)) +
        '<small>' + esc(kl.pair) + ' · score ' + WI.fmt(r.score, 3) + '</small></span><span class="mv">' + mv + '</span></li>';
    }
    return '<div class="rankings"><div><div class="label-sm" style="margin-bottom:10px">Before</div><ol class="rlist">' +
      before.map(function (r, i) { return row(r, i, posAfter, false); }).join('') + '</ol></div>' +
      '<div><div class="label-sm" style="margin-bottom:10px">After the outcomes</div><ol class="rlist">' +
      after.map(function (r, i) { return row(r, i, posBefore, true); }).join('') + '</ol></div></div>';
  }

  function effects(list, wb, wa) {
    if (!list || !list.length) return '';
    return '<div class="effects">' + list.map(function (o) {
      var b = wb[o.key] != null ? wb[o.key] : 1, a = wa[o.key] != null ? wa[o.key] : 1, up = a > b;
      var k = WI.kindLabel(o.key);
      return '<div class="effect"><span class="arrow ' + (up ? 'up' : 'down') + '">' + (up ? '▲' : '▼') + '</span><span>Every <b>' + esc(k.pair) + '</b> (' + esc(k.label) + ') pair now scores <b class="' + (up ? 'hl-scan' : 'hl-no') + '">×' + a.toFixed(2) + '</b> instead of ×' + b.toFixed(2) + '.</span></div>';
    }).join('') + '<p class="muted" style="margin:14px 0 0;font-size:13.5px">One weight per kind of connection, not per pair: an outcome changes the odds for every similar pair in the network.</p></div>';
  }

  WI.register(function learn() {
    var host = document.getElementById('learn');
    if (!host) return;
    var L = WI.learning || {};
    var wb = L.weights_before || WI.network.weights_before || WI.demo.weights_before || {};
    var wa = L.weights_after || WI.network.weights_after || WI.demo.weights_after || {};
    host.innerHTML = '<div class="learn-grid">' +
      '<div class="card reveal"><h3>1 · Outcomes come back</h3><p class="muted" style="margin:8px 0 0;font-size:14.5px">Simulated: each outcome recorded three times on a pair from the round above.</p>' + outcomes(L.outcomes_recorded) + effects(L.outcomes_recorded, wb, wa) + '</div>' +
      '<div class="card reveal d1"><h3>2 · Weights move</h3><p class="muted" style="margin:8px 0 0;font-size:14.5px">One multiplier per kind of connection, clamped between ×0.5 and ×1.5. Grey dot before, coloured dot after.</p>' + weights(wb, wa) + '</div>' +
      '<div class="card wide reveal"><h3>3 · The next round chooses differently</h3><p class="muted" style="margin:8px 0 0;font-size:14.5px">The network\'s top 10 pairs, scored again with the new weights. Same members, same profiles; only the learned weights changed. Rescored inside the simulation from its own starting weights, so scores differ slightly from the round above.</p>' + rankings(L.ranking_before, L.ranking_after) + '</div>' +
      '</div>';
  });
})();
