/* Sections 6-9 and footer: member kinds, trust settings, IBM stack, data metadata. */
(function () {
  'use strict';
  var WI = window.WI, esc = WI.esc;

  var ICON = {
    individual: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
    startup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c4 2 6 6 6 10l-3 3H9l-3-3c0-4 2-8 6-10z"/><circle cx="12" cy="10" r="2"/><path d="M9 16l-2 5 5-2 5 2-2-5"/></svg>',
    small_business: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21V10l5 3V10l5 3V6h4l1 15z"/><path d="M3 21h18"/></svg>',
    corporation: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2M11 21v-3h2v3"/></svg>'
  };
  var KINDS = [
    { type: 'individual', title: 'Individuals', example: 'm017', gets: 'Students and professionals get a scout for paid work, mentors and teams hiring here, before they sign an offer somewhere else.' },
    { type: 'startup', title: 'Startups', example: 'm026', gets: 'First customers, pilot sites and early hires, found without cold outreach and pre-screened against the founder\'s own terms.' },
    { type: 'small_business', title: 'Small businesses & manufacturers', example: 'm035', gets: 'The technology, suppliers and people that solve the problem on the floor today, from across the state, not just down the road.' },
    { type: 'corporation', title: 'Corporations', example: 'm005', gets: 'Startups and suppliers already in Michigan, checked against the company\'s rules (data agreements, audits) before anyone takes a call.' }
  ];

  WI.register(function kinds() {
    var host = document.getElementById('kinds');
    if (!host) return;
    host.innerHTML = KINDS.map(function (k, i) {
      var m = WI.members.filter(function (x) { return x.id === k.example && x.type === k.type; })[0] ||
        WI.members.filter(function (x) { return x.type === k.type; })[0];
      return '<div class="card kind reveal' + (i ? ' d' + i : '') + '"><div class="icon">' + ICON[k.type] + '</div><h3>' + esc(k.title) + '</h3><p class="gets">' + esc(k.gets) + '</p>' +
        (m ? '<div class="example"><div class="label-sm" style="margin-bottom:8px">Example member</div><div class="nm">' + esc(m.name) + '</div><div class="mt">' + esc(m.sector) + ' · ' + esc(WI.hub(m.hub)) + '</div>' +
          ((m.needs || [])[0] ? '<div class="nd"><span>needs</span>' + esc(m.needs[0]) + '</div>' : '') + '</div>' : '') + '</div>';
    }).join('');
    var c = {}, h = {};
    WI.members.forEach(function (m) { c[m.type] = (c[m.type] || 0) + 1; h[m.hub] = (h[m.hub] || 0) + 1; });
    document.getElementById('counts').textContent = 'The synthetic network: ' + WI.members.length + ' members · ' +
      Object.keys(WI.TYPES).map(function (t) { return (c[t] || 0) + ' ' + WI.type(t).toLowerCase() + (c[t] === 1 ? '' : (t === 'small_business' ? 'es' : 's')); }).join(' · ') +
      ' · across ' + Object.keys(WI.HUBS).map(function (k) { return WI.hub(k) + ' (' + (h[k] || 0) + ')'; }).join(', ') + '.';
  });

  WI.register(function trust() {
    var host = document.getElementById('settings');
    if (!host) return;
    var m = WI.member('m001');
    var p = m.permissions || { share_profile: true, propose_meetings: true, contact_member: true };
    var tog = function (label, on) { return '<div class="setting"><span>' + esc(label) + '</span><span class="toggle' + (on ? ' on' : '') + '" role="img" aria-label="' + (on ? 'on' : 'off') + '"></span></div>'; };
    host.innerHTML = '<div class="settings-head"><span class="avatar warm" aria-hidden="true">' + esc(WI.initials(m.name)) + '</span><div><div class="t">Agent settings · ' + esc(m.name) + '</div><div class="s">set once · synthetic member</div></div></div>' +
      tog('Share my profile with other agents', p.share_profile) +
      tog('Let my agent propose meetings', p.propose_meetings) +
      tog('Message me after two yes votes', p.contact_member) +
      '<div class="setting"><span>Introductions per round</span><span class="val">' + (m.intro_budget != null ? m.intro_budget : 2) + '</span></div>' +
      '<div class="setting col"><span>Deal-breakers my agent enforces</span><div class="chips">' + (m.deal_breakers || ['set by the member']).map(function (d) { return '<span class="chip no">' + esc(d) + '</span>'; }).join('') + '</div></div>' +
      '<div class="setting" style="border-bottom:0"><span>Who my agent may message</span><span class="val">Only me</span></div>';
  });

  WI.register(function stack() {
    var D = WI.data, host = document.getElementById('stack');
    if (!host) return;
    var live = D.provider === 'watsonx';
    var model = function (label, id) { return '<div>' + label + ': ' + (id ? '<code>' + esc(id) + '</code>' : 'set at run time from the environment') + '</div>'; };
    host.innerHTML =
      '<div class="card reveal"><span class="label-sm">The voice and the scoring</span><h3>Granite on watsonx.ai</h3><p>Every member agent\'s words, every vote and every message to a member is written by a Granite model. Granite embeddings turn each need and offer into the numbers the scout scores.</p>' +
        '<div class="ids">' + model('chat', D.chat_model) + model('embeddings', D.embed_model) + '</div></div>' +
      '<div class="card reveal d1"><span class="label-sm">The loop</span><h3>watsonx Orchestrate</h3><p>The network agent is defined for watsonx Orchestrate. It calls our tools (scout, meeting, feedback, round) through an OpenAPI connection, to run a round without being asked and to answer requests in plain words.</p>' +
        '<div class="ids"><div>spec: <code>orchestrate/warm_intro_network_agent.yaml</code></div><div>tools: <code class="tool">runRound</code><code class="tool">scout</code><code class="tool">holdMeeting</code><code class="tool">recordFeedback</code></div></div></div>' +
      '<div class="card reveal d2"><span class="label-sm">The build</span><h3>IBM Bob</h3><p>Built two real pieces of the project, with screenshots in the repo: the data validator that checks every synthetic profile against the contract, and the run-summary tool.</p>' +
        '<div class="ids"><div><code>scripts/validate_data.py</code></div><div><code>tools/summarize_run.py</code></div></div></div>';
    document.getElementById('honestNote').innerHTML =
      '<span class="ai-tag" style="margin-top:2px">Honest scope</span><span><b>Each member\'s agent is one agent design, run once per member inside the meeting tool</b>, each time with only its own member\'s profile, goals and limits. ' +
      (live ? 'The runs on this page were generated with Granite on watsonx.ai' + (D.generated_at ? ' (' + esc(String(D.generated_at).slice(0, 10)) + ')' : '') + '. ' : 'This build is showing the offline fallback data. ') +
      'Members and history are synthetic; the conversations are real model output.</span>';
  });

  WI.register(function meta() {
    var D = WI.data, el = document.getElementById('dataMeta');
    if (!el) return;
    el.textContent = (WI.isFallback ? 'Data: offline fallback (runs/demo.json)' : 'Data generated ' + (D.generated_at || 'n/a')) +
      ' · provider ' + (D.provider || 'n/a') + (D.chat_model ? ' · ' + D.chat_model : '') + (D.embed_model ? ' · ' + D.embed_model : '') + ' · synthetic: true · ai_generated: true';
  });
})();
