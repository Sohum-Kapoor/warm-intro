/* Real Michigan resources: public organisations an agent points its member to. Not members; never plotted as nodes.
   Reads WARM_INTRO.resources and WARM_INTRO.resource_suggestions; the section stays hidden when they are absent. */
(function () {
  'use strict';
  var WI = window.WI, esc = WI.esc;
  var LABEL = 'Real organisation · public information · not a member: never speaks or votes for them';
  var HUB_ORDER = ['detroit', 'grand_rapids', 'ann_arbor', 'statewide'];

  function hubName(h) {
    var k = String(h || '').toLowerCase();
    if (!k || k === 'statewide' || k === 'michigan' || k === 'state') return 'Statewide';
    return WI.hub(k);
  }
  function hubKey(h) {
    var k = String(h || '').toLowerCase();
    return (!k || k === 'michigan' || k === 'state') ? 'statewide' : k;
  }
  function safeUrl(u) { return /^https?:\/\//i.test(String(u || '')) ? String(u) : ''; }
  function pretty(s) { return String(s || '').replace(/_/g, ' '); }
  function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
  var ARROW = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 8.5 8.5 3.5M4.5 3.5h4v4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';

  function card(r) {
    var url = safeUrl(r.url);
    var helps = (r.helps_with || []).slice(0, 3);
    var serves = (r.serves || []).map(function (t) { return WI.TYPES[t] ? WI.type(t) : pretty(t); });
    return '<article class="res" data-hub="' + esc(hubKey(r.hub)) + '">' +
      '<div class="res-label">' + esc(LABEL) + '</div>' +
      '<div class="res-body">' +
        '<div class="res-meta"><span>' + esc(pretty(r.category)) + '</span><span>' + esc(hubName(r.hub)) + '</span></div>' +
        '<h3>' + esc(r.name) + '</h3>' +
        (r.description ? '<p>' + esc(r.description) + '</p>' : '') +
        (helps.length ? '<div class="res-helps"><span class="label-sm">Helps with</span><ul>' + helps.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul></div>' : '') +
        (serves.length ? '<div class="res-serves">Serves: ' + esc(serves.join(', ')) + '</div>' : '') +
        (url ? '<a class="res-link" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(host(url) || 'Visit site') + ARROW + '<span class="sr-only"> (opens the organisation\'s own website)</span></a>' : '') +
      '</div></article>';
  }

  WI.register(function resources() {
    var D = WI.data;
    var list = Array.isArray(D.resources) ? D.resources.filter(function (r) { return r && r.name; }) : [];
    var sec = document.getElementById('resources');
    var nav = document.getElementById('navResources');
    if (sec && list.length) {
      sec.hidden = false;
      if (nav) nav.hidden = false;
      var grid = document.getElementById('resGrid');
      var filters = document.getElementById('resFilters');
      var counts = {};
      list.forEach(function (r) { var k = hubKey(r.hub); counts[k] = (counts[k] || 0) + 1; });
      var hubs = HUB_ORDER.filter(function (k) { return counts[k]; })
        .concat(Object.keys(counts).filter(function (k) { return HUB_ORDER.indexOf(k) < 0; }));
      grid.innerHTML = list.map(card).join('');
      filters.innerHTML = '<button type="button" aria-pressed="true" data-hub="">All <span>' + list.length + '</span></button>' +
        hubs.map(function (k) { return '<button type="button" aria-pressed="false" data-hub="' + esc(k) + '">' + esc(hubName(k)) + ' <span>' + counts[k] + '</span></button>'; }).join('');
      filters.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        var hub = b.getAttribute('data-hub');
        filters.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        grid.querySelectorAll('.res').forEach(function (c) { c.hidden = !!hub && c.getAttribute('data-hub') !== hub; });
        document.getElementById('resStatus').textContent = 'Showing ' + (hub ? counts[hub] + ' in ' + hubName(hub) : 'all ' + list.length) + ' organisations.';
      });
      document.getElementById('resCount').textContent = list.length + ' public organisations';
    }

    // "Your agent also suggests" card in the walkthrough, for the featured member.
    var slot = document.getElementById('suggestSlot');
    var sugg = D.resource_suggestions && WI.storyFocus ? D.resource_suggestions[WI.storyFocus] : null;
    if (slot && Array.isArray(sugg) && sugg.length) {
      var F = WI.member(WI.storyFocus);
      slot.innerHTML = '<div class="suggest"><div class="suggest-head"><span class="label-sm">Your agent also suggests</span><span class="real-tag">Real organisations · not members</span></div>' +
        '<p class="suggest-sub">Besides the introduction, ' + esc(F.name) + '\'s agent points it to public Michigan programs that match its needs. These organisations never speak or vote; the agent only links to their public information.</p>' +
        '<ul>' + sugg.slice(0, 3).map(function (s) {
          var url = safeUrl(s.url);
          var name = url ? '<a href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(s.name) + ARROW + '</a>' : esc(s.name);
          return '<li><div class="sg-name">' + name + '</div><div class="sg-meta">' + esc(pretty(s.category)) + ' · ' + esc(hubName(s.hub)) +
            (typeof s.similarity === 'number' ? ' · match ' + s.similarity.toFixed(2) : '') + '</div>' +
            (s.for_need ? '<div class="sg-why">For your need: <b>' + esc(s.for_need) + '</b>' + (s.matched ? ' ↔ ' + esc(s.matched) : '') + '</div>' : '') + '</li>';
        }).join('') + '</ul></div>';
    }
  });
})();
