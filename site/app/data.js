/* Warm Intro · My agent — data-access layer.
 *
 * One interface, two implementations (demo and live). The UI only talks to `WI.store`,
 * and both implementations return the live API's shapes (see docs/CONTRACTS.md and warmintro/api.py).
 *
 *   init()                       -> {mode: 'demo'|'live', provider, api, notice}
 *   members()                    -> [Member]                 (sync, after init)
 *   getMember(id)                -> Promise<Member>
 *   updateMember(id, patch)      -> Promise<Member>          (rejects with Error(detail) on 422)
 *   getActivity(id)              -> Promise<{stats, meetings, introductions}>
 *   ask(id, request)             -> Promise<{candidates, meeting, note, example?, unsupported?}>
 *   feedback(meetingRef, outcome, ctx) -> Promise<{weights_before, weights_after, key}>
 *   suggestions(id)              -> Promise<{suggestions, note}>
 *   exampleAsks()                -> [{index, request, requester, requesterName}]
 *   draftProfile(input)          -> Promise<{draft, note}>
 *   createMember(draft)          -> Promise<{member, first_matches, note}>
 *   firstMatches(id)             -> {first_matches, note} | null
 *
 * Demo data is synthetic (window.WARM_INTRO from ../data/site_data.js). Everything a member changes
 * in demo mode lives in this browser's localStorage, and the page still works when that is blocked.
 */
(function () {
  'use strict';

  var W = window.WARM_INTRO || {};
  var FB = window.WARM_INTRO_FALLBACK || {};

  // ---------- small helpers ----------
  var LS = {
    get: function (k, d) {
      try { var v = window.localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; }
    },
    set: function (k, v) {
      try { window.localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
    },
    del: function (k) { try { window.localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function pairKey(a, b) { return [a, b].sort().join('~'); }
  function kindOf(t1, t2) { return [t1, t2].sort().join('-'); }

  var LIMITS = { items: 6, chars: 160, description: 400, budgetMax: 5, sector: 60, name: 80, aboutMin: 20, aboutMax: 1200 };
  var PERMISSION_KEYS = ['share_profile', 'propose_meetings', 'contact_member'];
  var MEMBER_TYPES = ['individual', 'startup', 'small_business', 'corporation'];
  var HUBS = ['detroit', 'grand_rapids', 'ann_arbor'];

  /* Mirrors warmintro/api.py _apply_patch. Returns an error message or null. */
  function validatePatch(p) {
    var lists = { needs: 'Needs', offers: 'Offers', deal_breakers: 'Deal-breakers' };
    for (var name in lists) {
      if (!(name in p)) continue;
      var items = p[name];
      if (!Array.isArray(items) || items.length > LIMITS.items) return lists[name] + ': at most ' + LIMITS.items + ' items.';
      for (var i = 0; i < items.length; i++) {
        var s = typeof items[i] === 'string' ? items[i].trim() : '';
        if (!s) return lists[name] + ': items can’t be empty.';
        if (s.length > LIMITS.chars) return lists[name] + ': each item must be ' + LIMITS.chars + ' characters or fewer.';
      }
    }
    if ('description' in p && (typeof p.description !== 'string' || p.description.length > LIMITS.description)) {
      return 'Description must be ' + LIMITS.description + ' characters or fewer.';
    }
    if ('intro_budget' in p) {
      var b = p.intro_budget;
      if (typeof b !== 'number' || Math.floor(b) !== b || b < 0 || b > LIMITS.budgetMax) return 'Introduction budget must be a whole number from 0 to 5.';
    }
    if ('paused' in p && typeof p.paused !== 'boolean') return 'Paused must be on or off.';
    if ('permissions' in p) {
      var perms = p.permissions;
      if (!perms || typeof perms !== 'object') return 'Permissions are invalid.';
      for (var k in perms) if (PERMISSION_KEYS.indexOf(k) < 0 || typeof perms[k] !== 'boolean') return 'Permissions are invalid.';
    }
    return null;
  }

  /* Mirrors warmintro/api.py _new_member. */
  function validateDraft(d) {
    if (!d.name || !d.name.trim() || d.name.trim().length > LIMITS.name) return 'Name must be 1 to 80 characters.';
    if (!d.sector || !d.sector.trim() || d.sector.trim().length > LIMITS.sector) return 'Add a sector (1 to 60 characters), e.g. “machine vision”.';
    if (MEMBER_TYPES.indexOf(d.type) < 0) return 'Choose a member type.';
    if (HUBS.indexOf(d.hub) < 0) return 'Choose a hub.';
    var err = validatePatch({ needs: d.needs, offers: d.offers, deal_breakers: d.deal_breakers, description: d.description, intro_budget: d.intro_budget, permissions: d.permissions });
    if (err) return err;
    if (!d.needs.length || !d.offers.length) return 'Add at least one need and one offer so your agent has something to work with.';
    return null;
  }

  function cleanPatch(p) {
    var out = {};
    for (var k in p) {
      if (k === 'needs' || k === 'offers' || k === 'deal_breakers') out[k] = p[k].map(function (s) { return String(s).trim(); });
      else if (k === 'description') out[k] = String(p[k]).trim();
      else out[k] = p[k];
    }
    return out;
  }

  // ---------- keyword matching (demo only; honest and simple) ----------
  var STOP = ('a an the and or but of for to in on at by with from into about as is are was were be been being i im i\'m me my we our us you your ' +
    'it its this that these those who whom which what can could would should will do does did done find someone somebody something ' +
    'need needs want wants looking look help get got have has had some any more most very just like also so than then there here ' +
    'up out over under not no new one two who\'s they them their he she his her').split(' ');
  function tokens(text) {
    return String(text || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(function (w) {
      return w.length > 1 && STOP.indexOf(w) < 0;
    }).map(function (w) { return w.length > 4 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w; });
  }
  function overlap(qa, qb) {
    var a = tokens(qa), b = tokens(qb), shared = 0, seen = {};
    a.forEach(function (w) { if (!seen[w] && b.indexOf(w) >= 0) { shared++; seen[w] = 1; } });
    var uniqA = Object.keys(a.reduce(function (o, w) { o[w] = 1; return o; }, {})).length;
    return { shared: shared, ratio: uniqA ? shared / uniqA : 0 };
  }

  // ---------- demo data normalisation ----------
  var fbById = {};
  (FB.members || []).forEach(function (m) { fbById[m.id] = m; });

  function baseMembers() {
    return (W.members || FB.members || []).map(function (m) {
      var f = fbById[m.id] || {};
      var out = clone(m);
      if (!out.deal_breakers) out.deal_breakers = clone(f.deal_breakers) || [];
      if (out.intro_budget == null) out.intro_budget = f.intro_budget != null ? f.intro_budget : 2;
      if (!out.permissions) out.permissions = clone(f.permissions) || { share_profile: true, propose_meetings: true, contact_member: true };
      if (!out.needs) out.needs = clone(f.needs) || [];
      if (!out.offers) out.offers = clone(f.offers) || [];
      if (out.paused == null) out.paused = false;
      return out;
    });
  }

  function runIntros(run, meetingId) {
    return (run.introductions || []).filter(function (i) { return i.meeting_id === meetingId; });
  }

  /* Every demo meeting, deduped by unordered pair, network_run first, then demo_run, then asks. */
  function demoMeetings() {
    var out = [], seen = {};
    function add(source, m, intros, request) {
      if (!m || !m.a || !m.b) return;
      var pk = pairKey(m.a, m.b);
      if (seen[pk]) return;
      seen[pk] = 1;
      var mm = clone(m);
      mm.ref = source + ':' + m.id;
      mm.source = source;
      mm.request = request || null;
      mm.introductions = (m.introductions && m.introductions.length) ? clone(m.introductions) : clone(intros || []);
      out.push(mm);
    }
    var nr = W.network_run || {}, dr = W.demo_run || {};
    (nr.meetings || []).forEach(function (m) { add('network', m, runIntros(nr, m.id)); });
    (dr.meetings || []).forEach(function (m) { add('demo', m, runIntros(dr, m.id)); });
    (W.asks || []).forEach(function (a) { if (a.meeting) add('ask', a.meeting, a.meeting.introductions, a.request); });
    return out;
  }

  // ---------- demo implementation ----------
  function DemoStore() {
    this.mode = 'demo';
    this._base = baseMembers();
    this._meetings = demoMeetings();
  }
  DemoStore.prototype = {
    init: function () { return Promise.resolve({ mode: 'demo', provider: W.provider || null }); },
    _created: function () { return LS.get('wi.demo.created', []); },
    members: function () {
      var created = this._created();
      return created.concat(this._base).map(function (m) {
        var over = LS.get('wi.demo.profile.' + m.id, null);
        var out = Object.assign(clone(m), over || {});
        if (out.paused == null) out.paused = false;
        return out;
      });
    },
    _byId: function (id) { return this.members().filter(function (m) { return m.id === id; })[0] || null; },
    getMember: function (id) {
      var m = this._byId(id);
      return m ? Promise.resolve(m) : Promise.reject(new Error('Unknown member ' + id));
    },
    updateMember: function (id, patch) {
      var err = validatePatch(patch);
      if (err) return Promise.reject(new Error(err));
      var over = LS.get('wi.demo.profile.' + id, {}) || {};
      var clean = cleanPatch(patch);
      if (clean.permissions) {
        var cur = this._byId(id);
        clean.permissions = Object.assign({}, cur && cur.permissions, clean.permissions);
      }
      Object.assign(over, clean);
      LS.set('wi.demo.profile.' + id, over);
      return this.getMember(id);
    },
    getActivity: function (id) {
      var byId = {};
      this.members().forEach(function (m) { byId[m.id] = m; });
      var meetings = [], introductions = [];
      this._meetings.forEach(function (m) {
        if (m.a !== id && m.b !== id) return;
        var other = m.a === id ? m.b : m.a;
        var o = byId[other] || { id: other, name: other };
        var counterpart = { id: o.id, name: o.name, type: o.type || '', hub: o.hub || '', sector: o.sector || '' };
        var intros = (m.introductions || []).filter(function (i) { return i.to === id; });
        meetings.push({
          id: m.ref, meeting_id: m.id, source: m.source, request: m.request, result: m.result, counterpart: counterpart,
          my_vote: (m.votes || {})[id] || null, their_vote: (m.votes || {})[other] || null,
          transcript: m.transcript || [], introductions: intros, candidate: m.candidate || null, a: m.a, b: m.b
        });
        intros.forEach(function (i) { introductions.push(Object.assign({}, i, { counterpart: counterpart, meeting_id: m.ref })); });
      });
      var votes = meetings.filter(function (x) { return x.my_vote; }).map(function (x) { return x.my_vote.vote; });
      var agents = {};
      meetings.forEach(function (x) { agents[x.counterpart.id] = 1; });
      return Promise.resolve({
        stats: {
          agents_met: Object.keys(agents).length, meetings: meetings.length,
          yes_votes: votes.filter(function (v) { return v === 'yes'; }).length,
          no_votes: votes.filter(function (v) { return v === 'no'; }).length,
          introductions: introductions.length
        },
        meetings: meetings, introductions: introductions
      });
    },
    exampleAsks: function () {
      var self = this;
      return (W.asks || []).map(function (a, i) {
        var r = self._byId(a.requester);
        return { index: i, request: a.request, requester: a.requester, requesterName: r ? r.name : a.requester };
      });
    },
    matchAsk: function (text) {
      var best = null;
      (W.asks || []).forEach(function (a, i) {
        var o = overlap(text, a.request);
        if (o.shared >= 2 && o.ratio >= 0.4 && (!best || o.ratio > best.ratio || (o.ratio === best.ratio && o.shared > best.shared))) {
          best = { index: i, shared: o.shared, ratio: o.ratio };
        }
      });
      return best;
    },
    exampleResult: function (index) {
      var a = (W.asks || [])[index];
      if (!a) return null;
      var r = this._byId(a.requester);
      return {
        candidates: clone(a.candidates || []), meeting: a.meeting ? Object.assign(clone(a.meeting), { ref: 'ask:' + a.meeting.id }) : null,
        note: a.meeting ? 'The agent held a first meeting with the best match.' : 'Here are the best matches.',
        example: { index: index, request: a.request, requester: a.requester, requesterName: r ? r.name : a.requester }
      };
    },
    ask: function (id, request) {
      var m = this.matchAsk(request);
      if (m) return Promise.resolve(this.exampleResult(m.index));
      return Promise.resolve({
        candidates: [], meeting: null, unsupported: true,
        note: 'Demo mode can’t run new searches. In live mode your agent runs this on IBM Granite.'
      });
    },
    _weights: function () {
      var stored = LS.get('wi.demo.weights', null);
      if (stored) return stored;
      var l = W.learning || {};
      return clone(l.weights_after || (W.network_run || {}).weights_after || {});
    },
    feedback: function (meetingRef, outcome, ctx) {
      var me = this._byId(ctx.memberId), other = this._byId(ctx.counterpartId);
      var label = (ctx.candidate && ctx.candidate.label) || 'complementary';
      var key = kindOf(me ? me.type : '', other ? other.type : '') + '|' + label;
      var before = this._weights();
      var after = clone(before);
      var delta = outcome === 'no_follow_up' ? -0.08 : 0.08;
      var v = (before[key] != null ? before[key] : 1.0) + delta;
      after[key] = Math.round(Math.min(1.5, Math.max(0.5, v)) * 10000) / 10000;
      LS.set('wi.demo.weights', after);
      return Promise.resolve({ weights_before: before, weights_after: after, key: key, local: true });
    },
    suggestions: function (id) {
      var rs = W.resource_suggestions || {};
      if (rs[id]) return Promise.resolve({ suggestions: clone(rs[id]), note: 'Matched on IBM Granite embeddings when the demo data was built.' });
      var me = this._byId(id);
      if (me && me.user_created) {
        var out = [];
        (W.resources || []).forEach(function (r) {
          if (r.serves && r.serves.indexOf(me.type) < 0) return;
          var best = null;
          (me.needs || []).forEach(function (n) {
            (r.helps_with || []).forEach(function (h) {
              var o = overlap(n, h);
              if (o.shared && (!best || o.ratio > best.similarity)) best = { for_need: n, matched: h, similarity: Math.round(o.ratio * 100) / 100 };
            });
          });
          if (best) out.push(Object.assign({ resource_id: r.id, name: r.name, url: r.url, hub: r.hub, category: r.category }, best));
        });
        out.sort(function (a, b) { return b.similarity - a.similarity; });
        return Promise.resolve({ suggestions: out.slice(0, 2), note: 'Matched in your browser by keyword overlap (demo mode).' });
      }
      return Promise.resolve({ suggestions: [], note: 'No suggestions were precomputed for this member in demo mode.' });
    },
    draftProfile: function (input) {
      return Promise.resolve({ draft: localDraft(input), note: 'Demo mode: drafted in your browser. Live mode drafts with IBM Granite.' });
    },
    createMember: function (draft) {
      var err = validateDraft(draft);
      if (err) return Promise.reject(new Error(err));
      var created = this._created();
      var id = 'u' + String(created.length + 1).padStart(2, '0') + Date.now().toString(36).slice(-4);
      var member = Object.assign(cleanPatch({
        needs: draft.needs, offers: draft.offers, deal_breakers: draft.deal_breakers, description: draft.description
      }), {
        id: id, name: draft.name.trim(), type: draft.type, hub: draft.hub, sector: draft.sector.trim(),
        intro_budget: draft.intro_budget, permissions: clone(draft.permissions), paused: false, user_created: true
      });
      var matches = keywordMatches(member, this.members());
      created.unshift(member);
      if (!LS.set('wi.demo.created', created)) this._volatile = (this._volatile || []).concat([member]);
      var fm = { first_matches: matches, note: 'Demo mode: matched in your browser by keyword overlap, not IBM Granite.' };
      LS.set('wi.firstMatches.demo.' + id, fm);
      this._fm = this._fm || {}; this._fm[id] = fm;
      return Promise.resolve({ member: member, first_matches: matches, note: fm.note });
    },
    firstMatches: function (id) { return LS.get('wi.firstMatches.demo.' + id, null) || (this._fm && this._fm[id]) || null; }
  };

  /* Demo-only: sentence splitter that turns a person's own words into a draft profile. */
  function localDraft(input) {
    var about = String(input.about || '').trim();
    var sentences = about.split(/(?<=[.!?])\s+|\n+|;\s*/).map(function (s) { return s.trim(); }).filter(Boolean);
    var needs = [], offers = [], breakers = [];
    var reBreak = /\b(won['’]?t|will not|wont|never|don['’]?t|do not|no|not interested|can['’]?t|cannot|avoid)\b/i;
    var reNeed = /\b(need|needs|looking for|look for|want|wants|seeking|searching for|hope to find|hoping to find|would like)\b/i;
    var reOffer = /\b(offer|offers|can|could|provide|provides|bring|have|has|help with|happy to)\b/i;
    function tail(s, re) {
      var m = s.match(re);
      var t = m ? s.slice(m.index + m[0].length) : s;
      t = t.replace(/^\s*(to\s+(find|get|hire|meet)\s+|to\s+)?(offer|provide|bring|help with)?\s*/i, '').replace(/[.!?]+$/, '').trim();
      if (t.length < 4) t = s.replace(/[.!?]+$/, '').trim();
      return t.length > LIMITS.chars ? t.slice(0, LIMITS.chars - 1).trim() + '…' : t;
    }
    sentences.forEach(function (s) {
      if (reNeed.test(s) && !/^(we|i)\s+(don|won|never)/i.test(s)) { if (needs.length < LIMITS.items) needs.push(tail(s, reNeed)); return; }
      if (reBreak.test(s)) { if (breakers.length < LIMITS.items) breakers.push(s.replace(/[.!?]+$/, '').slice(0, LIMITS.chars)); return; }
      if (reOffer.test(s)) { if (offers.length < LIMITS.items) offers.push(tail(s, reOffer)); }
    });
    if (!needs.length && sentences.length) needs.push(tail(sentences[0], reNeed));
    var description = sentences.slice(0, 3).join(' ');
    if (description.length > LIMITS.description) description = description.slice(0, LIMITS.description - 1).trim() + '…';
    return {
      name: String(input.name || '').trim(), type: input.type, hub: input.hub, sector: '',
      description: description, needs: needs, offers: offers, deal_breakers: breakers, intro_budget: 2,
      permissions: { share_profile: true, propose_meetings: true, contact_member: true }
    };
  }

  /* Demo-only first matches: my needs vs. their offers (and theirs vs. mine) by shared keywords. */
  function keywordMatches(me, members) {
    var out = [];
    members.forEach(function (o) {
      if (o.id === me.id || o.user_created) return;
      var ev = [];
      (me.needs || []).forEach(function (n) {
        (o.offers || []).forEach(function (f) {
          var s = overlap(n, f);
          if (s.shared) ev.push({ need_of: me.id, need: n, offer_of: o.id, offer: f, similarity: Math.round(s.ratio * 100) / 100 });
        });
      });
      (o.needs || []).forEach(function (n) {
        (me.offers || []).forEach(function (f) {
          var s = overlap(n, f);
          if (s.shared) ev.push({ need_of: o.id, need: n, offer_of: me.id, offer: f, similarity: Math.round(s.ratio * 100) / 100 });
        });
      });
      if (!ev.length) return;
      ev.sort(function (a, b) { return b.similarity - a.similarity; });
      var fit = ev[0].similarity;
      out.push({ a: me.id, b: o.id, fit: fit, novelty: 0, weight: 1, cross_hub: o.hub !== me.hub, score: fit, label: 'keyword overlap', evidence: ev.slice(0, 2) });
    });
    out.sort(function (a, b) { return b.score - a.score; });
    return out.slice(0, 3);
  }

  // ---------- live implementation ----------
  function LiveStore(api) {
    this.mode = 'live';
    this.api = api.replace(/\/+$/, '');
    this._members = [];
    this.provider = null;
  }
  function detailOf(body, status) {
    var d = body && body.detail;
    if (Array.isArray(d)) d = d.map(function (x) { return (x && x.msg) || String(x); }).join('; ');
    if (d && typeof d === 'object') d = JSON.stringify(d);
    return d || ('Request failed (' + status + ')');
  }
  LiveStore.prototype = {
    _req: function (method, path, body, timeoutMs) {
      var ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      var t = ctl ? setTimeout(function () { ctl.abort(); }, timeoutMs || 15000) : null;
      var opts = { method: method, headers: {}, signal: ctl ? ctl.signal : undefined };
      if (body !== undefined) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
      return fetch(this.api + path, opts).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (!res.ok) { var e = new Error(detailOf(data, res.status)); e.status = res.status; throw e; }
          return data;
        });
      }, function (err) {
        var e = new Error(err && err.name === 'AbortError' ? 'The live agent took too long to answer.' : 'Couldn’t reach the live agent.');
        e.network = true; throw e;
      }).finally(function () { if (t) clearTimeout(t); });
    },
    init: function () {
      var self = this;
      return this._req('GET', '/health', undefined, 4000).then(function (h) {
        if (!h || !h.ok) throw new Error('health check failed');
        self.provider = h.provider || null;
        return self._req('GET', '/members', undefined, 8000);
      }).then(function (d) {
        self._members = (d.members || []).map(function (m) { if (m.paused == null) m.paused = false; return m; });
        return { mode: 'live', provider: self.provider, api: self.api };
      });
    },
    members: function () { return this._members.slice(); },
    _replace: function (m) {
      if (m.paused == null) m.paused = false;
      var i = this._members.findIndex(function (x) { return x.id === m.id; });
      if (i >= 0) this._members[i] = m; else this._members.unshift(m);
      return m;
    },
    getMember: function (id) {
      var self = this;
      return this._req('GET', '/members/' + encodeURIComponent(id)).then(function (d) { return self._replace(d.member); });
    },
    updateMember: function (id, patch) {
      var err = validatePatch(patch);
      if (err) return Promise.reject(new Error(err));
      var self = this;
      return this._req('PATCH', '/members/' + encodeURIComponent(id), cleanPatch(patch)).then(function (d) { return self._replace(d.member); });
    },
    getActivity: function (id) {
      return this._req('GET', '/members/' + encodeURIComponent(id) + '/activity').then(function (d) {
        (d.meetings || []).forEach(function (m) { m.meeting_id = m.id; });
        // Repeated rounds can introduce the same pair again; keep the newest per counterpart (newest first from the API).
        var seen = {};
        d.introductions = (d.introductions || []).filter(function (i) {
          var k = i.counterpart && i.counterpart.id; if (seen[k]) return false; seen[k] = 1; return true;
        });
        return d;
      });
    },
    exampleAsks: function () { return DemoStore.prototype.exampleAsks.call(DEMO); },
    exampleResult: function (i) { return DEMO.exampleResult(i); },
    ask: function (id, request) {
      return this._req('POST', '/ask', { member_id: id, request: request, meet: true }, 120000).then(function (d) {
        if (d.meeting) d.meeting.ref = d.meeting.id;
        return d;
      });
    },
    feedback: function (meetingRef, outcome) {
      return this._req('POST', '/feedback', { meeting_id: meetingRef, outcome: outcome });
    },
    suggestions: function (id) {
      return this._req('GET', '/members/' + encodeURIComponent(id) + '/resources').then(function (d) {
        return { suggestions: d.suggestions || [], note: 'Matched live by the agent (AI-generated matching).' };
      });
    },
    draftProfile: function (input) {
      return this._req('POST', '/onboard/draft', input, 90000).then(function (d) {
        return { draft: d.draft, note: 'Drafted by your agent on ' + (this.provider === 'watsonx' ? 'IBM Granite' : 'the live API') + ' · AI-generated.' };
      }.bind(this));
    },
    createMember: function (draft) {
      var err = validateDraft(draft);
      if (err) return Promise.reject(new Error(err));
      var self = this;
      var body = cleanPatch({ needs: draft.needs, offers: draft.offers, deal_breakers: draft.deal_breakers, description: draft.description });
      Object.assign(body, { name: draft.name.trim(), type: draft.type, hub: draft.hub, sector: draft.sector.trim(), intro_budget: draft.intro_budget, permissions: draft.permissions });
      return this._req('POST', '/onboard', body, 90000).then(function (d) {
        self._replace(d.member);
        var fm = { first_matches: d.first_matches || [], note: 'Scored by the live agent.' };
        LS.set('wi.firstMatches.live.' + d.member.id, fm);
        self._fm = self._fm || {}; self._fm[d.member.id] = fm;
        return { member: d.member, first_matches: fm.first_matches, note: fm.note };
      });
    },
    firstMatches: function (id) { return LS.get('wi.firstMatches.live.' + id, null) || (this._fm && this._fm[id]) || null; }
  };

  var DEMO = new DemoStore();

  window.WI = {
    LS: LS, LIMITS: LIMITS, PERMISSION_KEYS: PERMISSION_KEYS, MEMBER_TYPES: MEMBER_TYPES, HUBS: HUBS,
    validatePatch: validatePatch, validateDraft: validateDraft, localDraft: localDraft, overlap: overlap,
    demoData: W, isFallbackData: !!window.WARM_INTRO_IS_FALLBACK,
    store: DEMO,
    /* Pick the implementation: ?api=… or a remembered URL means live; any failure falls back to demo. */
    connect: function (api) {
      if (!api) { window.WI.store = DEMO; return DEMO.init(); }
      var live = new LiveStore(api);
      return live.init().then(function (info) { window.WI.store = live; return info; }, function (err) {
        window.WI.store = DEMO;
        return { mode: 'demo', provider: W.provider || null, failedApi: api, notice: 'Couldn’t reach the live agent at ' + api + ' (' + (err && err.message || 'error') + '). Showing demo data instead.' };
      });
    }
  };
})();
