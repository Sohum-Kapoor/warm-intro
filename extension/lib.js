// Shared by the popup, the options page and the service worker.
// One adapter (demoActivity) turns the bundled Granite data into the exact
// shape of the live GET /members/{id}/activity endpoint, so the UI only ever
// renders one shape and demo and live mode cannot drift apart.
(function (root) {
  'use strict';

  const DEFAULT_MEMBER = 'm001';
  const STORE_KEY = 'warmintro';
  const APP_URL = 'https://sohum-kapoor.github.io/warm-intro/site/app/';
  const ACCENT = '#b4441c';

  const hasChromeStorage = () =>
    typeof chrome !== 'undefined' && !!(chrome.storage && chrome.storage.local);
  const hasChromeAction = () =>
    typeof chrome !== 'undefined' && !!(chrome.action && chrome.action.setBadgeText);

  // ---------- data ----------
  function data() {
    return root.WARM_INTRO || { members: [], demo_run: { meetings: [] }, asks: [], resource_suggestions: {} };
  }

  function member(id) {
    return data().members.find((m) => m.id === id) || null;
  }

  function demoMembers() {
    return data().members.filter((m) => m.demo);
  }

  const TYPE_LABEL = {
    small_business: 'Small business',
    startup: 'Startup',
    corporation: 'Corporation',
    individual: 'Individual',
    student: 'Student',
    university: 'University',
  };
  const typeLabel = (t) => TYPE_LABEL[t] || titleCase(t || '');
  const hubLabel = (h) => titleCase(h || '');
  function titleCase(s) {
    return String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function counterpartOf(id) {
    const m = member(id);
    return m
      ? { id: m.id, name: m.name, type: m.type, hub: m.hub, sector: m.sector }
      : { id, name: id, type: '', hub: '', sector: '' };
  }

  // Raw meeting (a, b, votes) -> activity meeting (counterpart, my_vote, ...).
  function normalizeMeeting(raw, memberId) {
    if (!raw) return null;
    if (raw.counterpart) return raw; // already activity-shaped (live)
    const me = raw.a === memberId || raw.b === memberId ? memberId : raw.a;
    const other = raw.a === me ? raw.b : raw.a;
    const votes = raw.votes || {};
    return {
      id: raw.id,
      result: raw.result,
      me,
      counterpart: counterpartOf(other),
      my_vote: votes[me] || null,
      their_vote: votes[other] || null,
      transcript: raw.transcript || [],
      introductions: (raw.introductions || []).filter((i) => !i.to || i.to === me),
      evidence: (raw.candidate && raw.candidate.evidence) || [],
      ai_generated: true,
    };
  }

  function statsFor(meetings, introductions) {
    const agents = new Set(meetings.map((m) => m.counterpart && m.counterpart.id));
    return {
      agents_met: agents.size,
      meetings: meetings.length,
      yes_votes: meetings.filter((m) => m.my_vote && m.my_vote.vote === 'yes').length,
      no_votes: meetings.filter((m) => m.my_vote && m.my_vote.vote === 'no').length,
      introductions: introductions.length,
    };
  }

  function demoActivity(memberId) {
    const run = data().demo_run || { meetings: [] };
    const meetings = (run.meetings || [])
      .filter((m) => m.a === memberId || m.b === memberId)
      .map((m) => normalizeMeeting(m, memberId));
    const introductions = [];
    meetings.forEach((m) =>
      m.introductions.forEach((i) =>
        introductions.push({ meeting_id: m.id, message: i.message, counterpart: m.counterpart })
      )
    );
    return { stats: statsFor(meetings, introductions), meetings, introductions, source: 'demo' };
  }

  // ---------- settings ----------
  const DEFAULTS = { memberId: DEFAULT_MEMBER, apiBase: '', paused: {}, handled: {} };

  async function loadSettings() {
    let stored = {};
    try {
      if (hasChromeStorage()) {
        stored = (await chrome.storage.local.get(STORE_KEY))[STORE_KEY] || {};
      } else {
        stored = JSON.parse(root.localStorage.getItem(STORE_KEY) || '{}');
      }
    } catch (_) {
      stored = {};
    }
    return Object.assign({}, DEFAULTS, stored, {
      paused: Object.assign({}, stored.paused),
      handled: Object.assign({}, stored.handled),
    });
  }

  async function saveSettings(settings) {
    const clean = {
      memberId: settings.memberId,
      apiBase: settings.apiBase || '',
      paused: settings.paused || {},
      handled: settings.handled || {},
    };
    try {
      if (hasChromeStorage()) await chrome.storage.local.set({ [STORE_KEY]: clean });
      else root.localStorage.setItem(STORE_KEY, JSON.stringify(clean));
    } catch (_) { /* storage unavailable: keep working in memory */ }
  }

  function normalizeApi(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  }

  // ---------- live API ----------
  async function api(base, path, opts) {
    const res = await fetch(normalizeApi(base) + path, Object.assign({
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    }, opts));
    if (!res.ok) throw new Error(`${res.status} ${res.statusText || 'error'} from ${path}`);
    return res.json();
  }

  async function getActivity(settings) {
    if (!settings.apiBase) return demoActivity(settings.memberId);
    const body = await api(settings.apiBase, `/members/${encodeURIComponent(settings.memberId)}/activity`);
    const meetings = (body.meetings || []).map((m) => normalizeMeeting(m, settings.memberId));
    const introductions = body.introductions || [];
    return {
      stats: body.stats || statsFor(meetings, introductions),
      meetings,
      introductions,
      source: 'live',
    };
  }

  function setPausedLive(settings, paused) {
    return api(settings.apiBase, `/members/${encodeURIComponent(settings.memberId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ paused }),
    });
  }

  function askLive(settings, request) {
    return api(settings.apiBase, '/ask', {
      method: 'POST',
      body: JSON.stringify({ member_id: settings.memberId, request, meet: true }),
    });
  }

  // ---------- demo ask: keyword match against the 4 precomputed asks ----------
  const STOP = new Set(('a an and are at be but by can do for from get got have help i if in into is it ' +
    'its keep looking me my need needs of on or our so some someone something that the their them ' +
    'there they this to us want we what who will with you your find before can\'t im i\'m who\'s').split(' '));

  function tokens(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s-]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => (w.length > 4 ? w.replace(/(ing|ers|er|es|s)$/, '') : w));
  }

  function askDemo(request) {
    const q = new Set(tokens(request));
    if (!q.size) return null;
    let best = null;
    (data().asks || []).forEach((ask) => {
      const t = new Set(tokens(ask.request));
      let hits = 0;
      q.forEach((w) => { if (t.has(w)) hits += 1; });
      const score = hits / Math.min(q.size, t.size);
      if (hits >= 2 || (hits === 1 && q.size <= 2 && score >= 0.5)) {
        if (!best || hits > best.hits) best = { ask, hits };
      }
    });
    return best && best.ask;
  }

  // ---------- badge ----------
  function newIntroCount(activity, settings) {
    const handled = (settings.handled || {})[settings.memberId] || {};
    return (activity.introductions || []).filter((i) => !handled[i.meeting_id]).length;
  }

  async function setBadge(n) {
    if (!hasChromeAction()) return;
    try {
      await chrome.action.setBadgeBackgroundColor({ color: ACCENT });
      if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#ffffff' });
      await chrome.action.setBadgeText({ text: n > 0 ? String(n) : '' });
    } catch (_) { /* badge is cosmetic */ }
  }

  root.WI = {
    APP_URL, DEFAULT_MEMBER, data, member, demoMembers, typeLabel, hubLabel,
    normalizeMeeting, demoActivity, loadSettings, saveSettings, normalizeApi,
    getActivity, setPausedLive, askLive, askDemo, newIntroCount, setBadge,
    hasChromeStorage, hasChromeAction,
  };
})(typeof self !== 'undefined' ? self : window);
