// Service worker: keeps the toolbar badge in sync with new introductions,
// even before the popup has been opened. Classic worker (not a module).
self.window = self; // data/site_data.js assigns window.WARM_INTRO
importScripts('data/site_data.js', 'lib.js');

async function refreshBadge() {
  try {
    const settings = await WI.loadSettings();
    const activity = await WI.getActivity(settings);
    await WI.setBadge(WI.newIntroCount(activity, settings));
  } catch (err) {
    // Live API down or unreachable: fall back to the bundled demo data.
    try {
      const settings = await WI.loadSettings();
      const activity = WI.demoActivity(settings.memberId);
      await WI.setBadge(WI.newIntroCount(activity, settings));
    } catch (_) { /* nothing else to do */ }
  }
}

chrome.runtime.onInstalled.addListener(refreshBadge);
chrome.runtime.onStartup.addListener(refreshBadge);
chrome.storage.onChanged.addListener(refreshBadge);
