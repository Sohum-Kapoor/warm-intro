(async function () {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const settings = await WI.loadSettings();
  $('#api').value = settings.apiBase || '';

  function say(text, kind) {
    const el = $('#result');
    el.textContent = text;
    el.className = 'result ' + (kind || '');
  }

  $('#form').addEventListener('submit', async (e) => {
    e.preventDefault();
    settings.apiBase = WI.normalizeApi($('#api').value);
    await WI.saveSettings(settings);
    say(settings.apiBase ? `Saved. The popup now uses ${settings.apiBase}.` : 'Saved. The popup uses the bundled demo data.', 'ok');
  });

  $('#clear').addEventListener('click', async () => {
    $('#api').value = '';
    settings.apiBase = '';
    await WI.saveSettings(settings);
    say('Demo mode. The popup uses the bundled Granite data.', 'ok');
  });

  $('#test').addEventListener('click', async () => {
    const base = WI.normalizeApi($('#api').value);
    if (!base) return say('Enter an API base URL first.', 'err');
    say('Testing…');
    try {
      const act = await WI.getActivity(Object.assign({}, settings, { apiBase: base }));
      say(`Connected. ${settings.memberId}: ${act.meetings.length} meetings, ${act.introductions.length} introductions.`, 'ok');
    } catch (err) {
      say(`No answer from ${base}: ${err.message}`, 'err');
    }
  });
})();
