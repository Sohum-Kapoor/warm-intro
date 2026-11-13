// Warm Intro popup. Renders one shape (the live /members/{id}/activity shape)
// from either the bundled Granite data (demo) or the live API.
(function () {
  'use strict';

  const $ = (sel) => document.querySelector(sel);
  const params = new URLSearchParams(location.search);
  const ICON = {
    check: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.3 5 8.6 9.6 3.6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    cross: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 3.5l5 5M8.5 3.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    tw: '<svg class="tw" viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 3 7.5 6 4.5 9" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    ok: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5 8.2 7.1 10.2 11 6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  let settings = null;
  let activity = null;
  let firstRender = true;

  // Tiny DOM builder. Strings become text nodes, so remote data is never parsed as HTML.
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k === 'html') el.innerHTML = v; // only ever used with the constant ICON strings
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    kids.flat().forEach((k) => {
      if (k == null || k === false) return;
      el.append(k instanceof Node ? k : document.createTextNode(String(k)));
    });
    return el;
  }

  const initials = (name) =>
    String(name || '?').replace(/[^A-Za-z\s.]/g, '').split(/\s+/).filter(Boolean).slice(0, 2)
      .map((w) => w[0]).join('').toUpperCase() || '?';
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  const metaLine = (m) => [WI.typeLabel(m.type), WI.hubLabel(m.hub), m.sector].filter(Boolean).join(' · ');
  const isLive = () => !!settings.apiBase;

  // ---------- header ----------
  function renderMemberSwitcher() {
    const select = $('#member');
    select.textContent = '';
    const members = WI.demoMembers();
    if (!members.some((m) => m.id === settings.memberId)) {
      const m = WI.member(settings.memberId);
      members.push(m || { id: settings.memberId, name: settings.memberId });
    }
    members.forEach((m) => select.append(h('option', { value: m.id }, m.name)));
    select.value = settings.memberId;
    const me = WI.member(settings.memberId) || { name: settings.memberId };
    $('#avatar').textContent = initials(me.name);
    $('#who-meta').textContent = metaLine(me) || settings.memberId;
    // Size the select to its label so the chevron sits right after the name.
    const probe = h('span', { class: 'sr-only', style: 'font-weight:650;font-size:14px;position:absolute;clip:auto;width:auto;height:auto;visibility:hidden' }, me.name);
    document.body.append(probe);
    select.style.width = Math.min(probe.offsetWidth + 22, 230) + 'px';
    probe.remove();

    const app = new URL(WI.APP_URL);
    app.searchParams.set('member', settings.memberId);
    $('#open-app').href = app.toString();

    const mode = $('#mode');
    mode.classList.toggle('live', isLive());
    mode.textContent = isLive() ? 'Live' : 'Demo';
    mode.title = isLive() ? `Live API: ${settings.apiBase}` : 'Demo data from IBM Granite runs. Click to set a live API.';
  }

  function renderStatus() {
    const paused = !!settings.paused[settings.memberId];
    const btn = $('#status');
    btn.setAttribute('aria-checked', String(!paused));
    btn.querySelector('.status-label').textContent = paused ? 'Paused' : 'Active';
  }

  // ---------- feed ----------
  function renderSummary() {
    const s = activity.stats || {};
    const declined = activity.meetings.filter((m) => m.result && m.result !== 'introduced').length;
    const el = $('#summary');
    el.textContent = '';
    if (!activity.meetings.length) {
      el.append('Your agent is scouting. No meetings yet this week.');
      return;
    }
    const parts = [
      ['Talked to ', h('b', null, plural(s.agents_met != null ? s.agents_met : activity.meetings.length, 'agent'))],
      [h('b', null, plural(s.introductions != null ? s.introductions : activity.introductions.length, 'introduction'))],
    ];
    if (declined) parts.push([h('b', null, String(declined)), ' declined']);
    parts.forEach((p, i) => {
      if (i) el.append(h('span', { class: 'sep', 'aria-hidden': 'true' }, '·'));
      el.append(...p);
    });
  }

  function speakerName(line, m) {
    const sp = String(line.speaker || '').replace(/^agent:/, '');
    if (sp === (m.me || settings.memberId)) return { mine: true, name: 'Your agent' };
    const who = sp === m.counterpart.id ? m.counterpart.name : (WI.member(sp) || {}).name || sp;
    return { mine: false, name: `${who}'s agent` };
  }

  function voteChip(v, label) {
    const yes = v && v.vote === 'yes';
    return h('span', { class: 'vote ' + (yes ? 'yes' : 'no') },
      h('span', { html: yes ? ICON.check : ICON.cross, style: 'display:inline-flex' }),
      `${label}: ${v ? v.vote : 'n/a'}`);
  }

  function meetingDetails(m, openIt) {
    const lines = (m.transcript || []).map((line) => {
      const sp = speakerName(line, m);
      return h('div', { class: 'line ' + (sp.mine ? 'me' : 'them') },
        h('div', { class: 'line-head' }, h('b', null, sp.name), h('span', { class: 'ai' }, 'AI-generated')),
        h('div', { class: 'bubble' }, line.text));
    });
    const ballot = h('div', { class: 'ballot' },
      [['Your agent', m.my_vote], [`${m.counterpart.name}'s agent`, m.their_vote]]
        .filter(([, v]) => v)
        .map(([who, v]) => h('div', { class: 'ballot-row' },
          voteChip(v, 'Vote'),
          h('div', null, h('span', { class: 'who-v' }, who + ': '), v.reason || ''))));
    const turns = (m.transcript || []).length;
    return h('details', { class: 'meeting', open: openIt },
      h('summary', null, h('span', { html: ICON.tw, style: 'display:inline-flex' }), 'Read the meeting',
        h('span', { class: 'right' }, `${plural(turns, 'turn')} · AI-generated`)),
      h('div', { class: 'transcript' }, lines),
      ballot);
  }

  function whyLine(m, isAsk) {
    const me = m.me || settings.memberId;
    const ev = (m.evidence || []).find((e) => e.need_of === me) || (m.evidence || [])[0];
    if (ev && isAsk) {
      // The "need" is the ask itself, already quoted above the card.
      return h('div', { class: 'why' }, h('span', { class: 'k' }, 'Fit'), 'They offer ', h('em', null, ev.offer), '.');
    }
    if (ev) {
      const mine = ev.need_of === me;
      return h('div', { class: 'why' }, h('span', { class: 'k' }, 'Why'),
        mine ? 'You need ' : `They need `, h('em', null, ev.need), mine ? '. They offer ' : '. You offer ',
        ev.offer, '.');
    }
    const reason = m.my_vote && m.my_vote.reason;
    return reason ? h('div', { class: 'why' }, h('span', { class: 'k' }, 'Why'), reason) : null;
  }

  function introMessage(m) {
    const intro = (m.introductions || [])[0] ||
      activity.introductions.find((i) => i.meeting_id === m.id);
    if (!intro) return null;
    const box = h('div', { class: 'message' },
      h('div', { class: 'k' }, h('span', null, 'From your agent'), h('span', { class: 'ai' }, 'AI-generated')),
      h('p', null, intro.message));
    const more = h('button', { class: 'more', type: 'button', 'aria-label': 'Show the whole introduction' }, 'Show all');
    more.addEventListener('click', () => {
      box.classList.toggle('open');
      more.textContent = box.classList.contains('open') ? 'Show less' : 'Show all';
    });
    box.querySelector('.k').insertBefore(more, box.querySelector('.k .ai'));
    requestAnimationFrame(() => {
      const p = box.querySelector('p');
      if (p.scrollHeight <= p.clientHeight + 2) more.remove();
    });
    return box;
  }

  function handledState(m) {
    return ((settings.handled || {})[settings.memberId] || {})[m.id];
  }

  async function setHandled(m, value) {
    const forMember = Object.assign({}, settings.handled[settings.memberId]);
    if (value) forMember[m.id] = value; else delete forMember[m.id];
    settings.handled[settings.memberId] = forMember;
    await WI.saveSettings(settings);
    await updateBadge();
    renderFeed();
  }

  function actionsFor(m) {
    const state = handledState(m);
    const name = m.counterpart.name;
    if (state === 'hello') {
      return h('div', { class: 'done' }, h('span', { html: ICON.ok, style: 'display:inline-flex' }),
        h('span', null, isLive()
          ? `You said hello. Your agent shared your contact with ${name}.`
          : `You said hello. Demo mode: nothing was sent. Live, your agent shares your contact with ${name}.`),
        h('button', { class: 'linkbtn', type: 'button', onclick: () => setHandled(m, null) }, 'Undo'));
    }
    if (state === 'later') {
      return h('div', { class: 'done' }, h('span', { html: ICON.ok, style: 'display:inline-flex' }),
        h('span', null, `Saved for later. Your agent won't nudge you about ${name} again this week.`),
        h('button', { class: 'linkbtn', type: 'button', onclick: () => setHandled(m, null) }, 'Undo'));
    }
    return h('div', { class: 'actions' },
      h('button', { class: 'btn primary', type: 'button', onclick: () => setHandled(m, 'hello') }, 'Say hello'),
      h('button', { class: 'btn', type: 'button', onclick: () => setHandled(m, 'later') }, 'Not now'));
  }

  function party(c) {
    return h('div', { class: 'party' },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, initials(c.name)),
      h('div', null, h('div', { class: 'party-name' }, c.name), h('div', { class: 'party-meta' }, metaLine(c))));
  }

  function dealBreakerHit(m) {
    const me = WI.member(m.me || settings.memberId);
    if (!me || !me.deal_breakers) return null;
    const text = [m.my_vote && m.my_vote.reason, ...(m.transcript || []).map((l) => l.text)].join(' ').toLowerCase();
    return me.deal_breakers.find((d) => {
      const words = d.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
      return words.length && words.every((w) => text.includes(w.replace(/s$/, '')));
    }) || null;
  }

  function introCard(m, openIt, opts) {
    const o = opts || {};
    const state = handledState(m);
    return h('article', { class: 'card intro' },
      h('div', { class: 'eyebrow' }, h('span', { class: 'pip' }),
        o.eyebrow || (state ? 'Introduction' : 'New introduction'),
        h('span', { class: 'right' }, o.right || '')),
      party(m.counterpart),
      whyLine(m, o.ask),
      h('div', { class: 'votes' }, h('span', { class: 'votes-head' }, 'Both agents said yes'),
        voteChip(m.my_vote, 'You'), voteChip(m.their_vote, 'Them')),
      introMessage(m),
      o.noActions ? null : actionsFor(m),
      meetingDetails(m, openIt));
  }

  function declinedCard(m, openIt, opts) {
    const o = opts || {};
    const mineNo = m.my_vote && m.my_vote.vote === 'no';
    const v = mineNo ? m.my_vote : m.their_vote;
    const hit = dealBreakerHit(m);
    return h('article', { class: 'card muted' },
      h('div', { class: 'eyebrow gray' }, h('span', { class: 'pip' }), o.eyebrow || 'Declined, no introduction',
        h('span', { class: 'right' }, o.right || '')),
      party(m.counterpart),
      v ? h('div', { class: 'reason' },
        h('span', { class: 'k' }, mineNo ? 'Your agent said no' : `${m.counterpart.name}'s agent said no`),
        v.reason) : null,
      hit ? h('span', { class: 'chip' }, 'Matched your deal-breaker: ', h('b', null, hit)) : null,
      h('div', { class: 'votes' }, voteChip(m.my_vote, 'You'), voteChip(m.their_vote, 'Them')),
      meetingDetails(m, openIt));
  }

  function meetingCard(m, openIt, opts) {
    return m.result === 'introduced' ? introCard(m, openIt, opts) : declinedCard(m, openIt, opts);
  }

  function renderFeed() {
    renderSummary();
    const feed = $('#feed');
    feed.textContent = '';
    if (settings.paused[settings.memberId]) {
      feed.append(h('div', { class: 'paused-note' },
        'Your agent is paused. It keeps what it already did, but won\'t scout or take new meetings until you resume.'));
    }
    const expand = firstRender ? params.get('expand') : null;
    firstRender = false;
    const sorted = activity.meetings.slice().sort((a, b) =>
      (a.result === 'introduced' ? 0 : 1) - (b.result === 'introduced' ? 0 : 1));
    sorted.forEach((m, i) => {
      const openIt = expand && (expand === m.id || (expand === '1' && i === 0));
      feed.append(meetingCard(m, !!openIt));
    });
    const opened = feed.querySelector('details[open]');
    if (opened) requestAnimationFrame(() => opened.scrollIntoView({ block: 'start' }));
    if (!sorted.length) {
      feed.append(h('div', { class: 'empty' }, 'Nothing yet. Your agent meets other agents in the background and only brings you an introduction after two yes votes.'));
    }
    renderResources();
  }

  function renderResources() {
    const box = $('#resources');
    box.textContent = '';
    const list = (WI.data().resource_suggestions || {})[settings.memberId] || [];
    if (!list.length) return;
    box.append(h('h2', null, 'Your agent also pointed you to'));
    list.slice(0, 2).forEach((r) => {
      box.append(h('a', { class: 'res', href: r.url, target: '_blank', rel: 'noopener' },
        h('div', { class: 'res-name' }, r.name, ' ', h('span', { 'aria-hidden': 'true' }, '↗')),
        h('div', { class: 'res-meta' }, `For "${r.for_need}" · ${WI.hubLabel(r.hub)}`),
        h('div', { class: 'res-note' }, 'Real Michigan organisation, not a member. It never talks or votes.')));
    });
  }

  function banner(text, kind, action) {
    const el = $('#banner');
    el.textContent = '';
    if (!text) return;
    el.append(h('div', { class: 'banner ' + (kind || '') }, h('span', null, text), action || null));
  }

  // ---------- ask ----------
  function askResult(nodes) {
    const box = $('#ask-result');
    box.textContent = '';
    if (!nodes) return;
    box.append(h('div', { class: 'ask-head' }, h('h2', null, 'Ask your agent'),
      h('button', { class: 'linkbtn', type: 'button', onclick: () => askResult(null) }, 'Clear')));
    box.append(...[].concat(nodes));
    $('#scroll').scrollTop = 0;
  }

  function suggestions() {
    return h('div', { class: 'suggest' }, (WI.data().asks || []).map((a) =>
      h('button', {
        type: 'button',
        onclick: () => { $('#ask-input').value = a.request; runAsk(a.request); },
      }, a.request.length > 52 ? a.request.slice(0, 50) + '…' : a.request)));
  }

  async function runAsk(text) {
    const q = String(text || '').trim();
    if (!q) return;
    if (isLive()) {
      askResult([h('div', { class: 'ask-q' }, `"${q}"`),
        h('div', { class: 'ask-note' }, h('span', { class: 'spinner' }), 'Your agent is scouting and taking the first meeting on IBM Granite…')]);
      try {
        const res = await WI.askLive(settings, q);
        const m = WI.normalizeMeeting(res.meeting, settings.memberId);
        askResult([
          h('div', { class: 'ask-q' }, `"${q}"`),
          m ? meetingCard(m, false, { eyebrow: 'Live meeting', right: `${plural((res.candidates || []).length, 'candidate')}`, noActions: true, ask: true })
            : h('div', { class: 'empty' }, 'No meeting this time.'),
          res.note ? h('div', { class: 'ask-note' }, res.note) : null,
        ]);
      } catch (err) {
        askResult([h('div', { class: 'ask-q' }, `"${q}"`),
          h('div', { class: 'banner err' }, `The live API didn't answer (${err.message}).`)]);
      }
      return;
    }
    const ask = WI.askDemo(q);
    if (!ask) {
      askResult([
        h('div', { class: 'ask-q' }, `"${q}"`),
        h('div', { class: 'banner' }, 'Demo mode answers only the four asks precomputed on IBM Granite. In live mode, your agent runs this ask on IBM Granite: it scouts members and takes the first meeting.'),
        h('div', { class: 'ask-note' }, 'Try one of these:'),
        suggestions(),
      ]);
      return;
    }
    const requester = WI.member(ask.requester) || { name: ask.requester };
    const m = WI.normalizeMeeting(ask.meeting, ask.requester);
    askResult([
      h('div', { class: 'ask-q' }, `"${ask.request}"`),
      meetingCard(m, false, {
        eyebrow: m.result === 'introduced' ? 'Match found' : 'Met, no match',
        right: plural((ask.candidates || []).length, 'candidate'),
        noActions: true,
        ask: true,
      }),
      h('div', { class: 'ask-note' }, `Precomputed on IBM Granite for ${requester.name}${ask.requester !== settings.memberId ? ' (another synthetic member)' : ''}. Set a live API to run your own asks.`),
    ]);
  }

  // ---------- data loading ----------
  async function updateBadge() {
    await WI.setBadge(WI.newIntroCount(activity, settings));
  }

  async function load() {
    banner(null);
    $('#summary').textContent = 'Loading…';
    try {
      activity = await WI.getActivity(settings);
    } catch (err) {
      activity = WI.demoActivity(settings.memberId);
      banner(`Live API unreachable (${err.message}). Showing demo data.`, 'err',
        h('button', { class: 'linkbtn', type: 'button', onclick: useDemo }, 'Use demo'));
    }
    renderMemberSwitcher();
    renderStatus();
    renderFeed();
    await updateBadge();
  }

  async function useDemo() {
    settings.apiBase = '';
    await WI.saveSettings(settings);
    load();
  }

  function openOptions() {
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open('options.html', '_blank');
    }
  }

  async function init() {
    settings = await WI.loadSettings();
    if (params.get('member')) settings.memberId = params.get('member');
    if (params.has('api')) settings.apiBase = WI.normalizeApi(params.get('api'));

    $('#member').addEventListener('change', async (e) => {
      settings.memberId = e.target.value;
      askResult(null);
      await WI.saveSettings(settings);
      load();
    });

    $('#status').addEventListener('click', async () => {
      const id = settings.memberId;
      const next = !settings.paused[id];
      settings.paused[id] = next;
      renderStatus();
      renderFeed();
      if (isLive()) {
        try { await WI.setPausedLive(settings, next); } catch (err) {
          settings.paused[id] = !next;
          renderStatus();
          renderFeed();
          banner(`Couldn't ${next ? 'pause' : 'resume'} on the live API (${err.message}).`, 'err');
          return;
        }
      }
      await WI.saveSettings(settings);
    });

    $('#mode').addEventListener('click', openOptions);

    $('#ask').addEventListener('submit', (e) => {
      e.preventDefault();
      runAsk($('#ask-input').value);
    });

    $('#open-app').addEventListener('click', (e) => {
      if (typeof chrome !== 'undefined' && chrome.tabs && chrome.tabs.create) {
        e.preventDefault();
        chrome.tabs.create({ url: e.currentTarget.href });
      }
    });

    await load();
    if (params.get('ask')) {
      $('#ask-input').value = params.get('ask');
      runAsk(params.get('ask'));
    }
  }

  init();
})();
