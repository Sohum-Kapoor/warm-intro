/* Hero: a radar sweep over the three hubs. Members are dots; real candidate pairs, meetings and introductions are lines. */
(function () {
  'use strict';
  var WI = window.WI;

  WI.register(function hero() {
    var canvas = document.getElementById('radar');
    var box = document.getElementById('radarBox');
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext('2d');
    var run = WI.network;

    // Hubs placed roughly as on the map: Grand Rapids west, Ann Arbor south-east, Detroit east.
    var HUB = {
      grand_rapids: { x: 0.27, y: 0.36, label: 'GRAND RAPIDS' },
      ann_arbor: { x: 0.50, y: 0.74, label: 'ANN ARBOR' },
      detroit: { x: 0.76, y: 0.42, label: 'DETROIT' }
    };
    var CX = 0.5, CY = 0.5;

    var counts = {};
    var nodes = {};
    WI.members.forEach(function (m) {
      var h = HUB[m.hub] || HUB.detroit;
      var i = counts[m.hub] = (counts[m.hub] || 0) + 1;
      var r = 0.028 + 0.12 * Math.sqrt(i / 21);
      var a = i * 2.39996 + (m.hub === 'detroit' ? 1 : m.hub === 'ann_arbor' ? 2 : 0);
      var x = h.x + r * Math.cos(a), y = h.y + r * Math.sin(a) * 0.9;
      nodes[m.id] = { x: x, y: y, ang: Math.atan2(y - CY, x - CX), hit: -99, demo: !!m.demo };
    });

    var met = {}, intro = {};
    (run.meetings || []).forEach(function (m) {
      var k = [m.a, m.b].sort().join('|');
      met[k] = true;
      if (m.result === 'introduced') intro[k] = true;
    });
    var edges = [];
    var seen = {};
    function addEdge(a, b) {
      var k = [a, b].sort().join('|');
      if (seen[k] || !nodes[a] || !nodes[b]) return;
      seen[k] = true;
      var na = nodes[a], nb = nodes[b];
      var mx = (na.x + nb.x) / 2, my = (na.y + nb.y) / 2;
      edges.push({ a: na, b: nb, kind: intro[k] ? 'intro' : met[k] ? 'met' : 'cand', ang: Math.atan2(my - CY, mx - CX), hit: -99, phase: Math.random() });
    }
    (run.candidates || []).forEach(function (c) { addEdge(c.a, c.b); });
    (run.meetings || []).forEach(function (m) { addEdge(m.a, m.b); });

    var readout = document.getElementById('radarReadout');
    var st = run.stats || {};
    if (readout) {
      readout.innerHTML = 'SCAN · ' + WI.members.length + ' members<br>pairs scored <b>' + (st.pairs_scored || 0).toLocaleString() + '</b><br>passed filter <b>' + (st.passed_filter || 0) + '</b>';
    }

    var W = 0, H = 0, dpr = 1;
    function size() {
      var r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function angDiff(a, b) { var d = a - b; while (d < 0) d += Math.PI * 2; while (d >= Math.PI * 2) d -= Math.PI * 2; return d; }

    var sweep = -Math.PI / 2, lastT = 0, time = 0;
    var SPEED = 0.75; // rad/s
    var DECAY = 5.2;  // seconds of afterglow

    function draw(t, staticFrame) {
      var dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0;
      lastT = t; time += dt;
      var prev = sweep;
      if (!staticFrame) sweep += SPEED * dt;
      var S = Math.min(W, H), R = S * 0.48;
      var cx = W * CX, cy = H * CY;
      function px(n) { return [n.x * W, n.y * H]; }

      ctx.clearRect(0, 0, W, H);

      // rings, crosshair and ticks
      ctx.lineWidth = 1;
      for (var i = 1; i <= 4; i++) {
        ctx.beginPath(); ctx.arc(cx, cy, R * i / 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(94,242,214,' + (i === 4 ? 0.22 : 0.08) + ')'; ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(94,242,214,0.07)';
      ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
      for (var k = 0; k < 72; k++) {
        var a = k / 72 * Math.PI * 2, l = k % 6 === 0 ? 10 : 4;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l));
        ctx.strokeStyle = 'rgba(94,242,214,' + (k % 6 === 0 ? 0.35 : 0.15) + ')'; ctx.stroke();
      }

      // sweep wedge
      if (!staticFrame) {
        var slices = 28, span = 0.9;
        for (var s = 0; s < slices; s++) {
          var a0 = sweep - span * (s + 1) / slices, a1 = sweep - span * s / slices;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, a0, a1); ctx.closePath();
          ctx.fillStyle = 'rgba(94,242,214,' + (0.16 * Math.pow(1 - s / slices, 2.2)) + ')'; ctx.fill();
        }
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sweep) * R, cy + Math.sin(sweep) * R);
        ctx.strokeStyle = 'rgba(94,242,214,0.85)'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
      }

      // update hits
      function passed(ang) { return angDiff(sweep, ang) < angDiff(sweep, prev) + 1e-9 && sweep !== prev; }
      Object.keys(nodes).forEach(function (id) { var n = nodes[id]; if (passed(n.ang)) n.hit = time; });
      edges.forEach(function (e) { if (passed(e.ang)) e.hit = time; });

      function glow(hit) {
        if (staticFrame) return 0.55;
        var age = time - hit; return age < 0 ? 0 : Math.exp(-age / DECAY * 2.2);
      }

      // edges
      edges.forEach(function (e) {
        var g = glow(e.hit);
        var p1 = px(e.a), p2 = px(e.b);
        var base = e.kind === 'cand' ? 0.06 : 0.18;
        var col = e.kind === 'intro' ? '255,180,94' : e.kind === 'met' ? '94,242,214' : '160,180,225';
        var alpha = base + g * (e.kind === 'cand' ? 0.35 : 0.8);
        ctx.beginPath();
        var mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
        var dx = p2[0] - p1[0], dy = p2[1] - p1[1];
        var bend = 0.12;
        var qx = mx - dy * bend, qy = my + dx * bend;
        ctx.moveTo(p1[0], p1[1]); ctx.quadraticCurveTo(qx, qy, p2[0], p2[1]);
        ctx.strokeStyle = 'rgba(' + col + ',' + alpha + ')';
        ctx.lineWidth = e.kind === 'cand' ? 0.8 : 1.6;
        ctx.stroke();
        // a pulse travelling along introductions
        if (e.kind === 'intro' && !staticFrame) {
          var u = (time * 0.35 + e.phase) % 1, v = 1 - u;
          var bx = v * v * p1[0] + 2 * v * u * qx + u * u * p2[0];
          var by = v * v * p1[1] + 2 * v * u * qy + u * u * p2[1];
          ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,200,130,' + (0.5 + g * 0.5) + ')'; ctx.fill();
        }
      });
      ctx.lineWidth = 1;

      // nodes
      Object.keys(nodes).forEach(function (id) {
        var n = nodes[id], p = px(n), g = glow(n.hit);
        var r = n.demo ? 3.2 : 2.4;
        if (g > 0.02) {
          ctx.beginPath(); ctx.arc(p[0], p[1], r + 7 * g, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(94,242,214,' + (0.16 * g) + ')'; ctx.fill();
        }
        ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(' + (n.demo ? '233,238,248' : '170,190,230') + ',' + (0.35 + 0.65 * g) + ')';
        ctx.fill();
      });

      // hub labels
      ctx.font = '500 ' + Math.max(9, Math.round(S * 0.019)) + 'px "JetBrains Mono", ui-monospace, monospace';
      ctx.textAlign = 'center';
      Object.keys(HUB).forEach(function (k) {
        var h = HUB[k];
        var y = k === 'ann_arbor' ? h.y * H + S * 0.165 : h.y * H - S * 0.165;
        ctx.fillStyle = 'rgba(233,238,248,0.78)';
        ctx.fillText(h.label, h.x * W, y);
        ctx.fillStyle = 'rgba(138,150,174,0.9)';
        ctx.fillText((counts[k] || 0) + ' members', h.x * W, y + S * 0.03);
      });
    }

    var running = false, raf = 0, visible = true;
    function loop(t) { draw(t, false); if (running) raf = requestAnimationFrame(loop); }
    function start() { if (running || WI.reduced) return; running = true; lastT = 0; raf = requestAnimationFrame(loop); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    size();
    if (WI.reduced) draw(0, true); else start();
    window.addEventListener('resize', function () { size(); if (WI.reduced) draw(0, true); });
    if ('IntersectionObserver' in window && !WI.reduced) {
      new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) start(); else stop(); }).observe(box);
    }
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (visible) start(); });
  });
})();
