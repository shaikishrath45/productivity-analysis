const API_BASE = 'http://localhost:3000/api';
const SYNC_ALARM = 'sync-data';
const SYNC_INTERVAL_MINUTES = 1;
const IDLE_THRESHOLD_SECONDS = 60;

const DEFAULT_CLASSIFICATIONS = {
 productive: [
  'github.com',
  'gitlab.com',
  'stackoverflow.com',
  'developer.mozilla.org',
  'docs.google.com',
  'notion.so',
  'figma.com',
  'codepen.io',
  'leetcode.com',
  'hackerrank.com',
  'coursera.org',
  'udemy.com',
  'khanacademy.org',
  'medium.com',
  'dev.to',
  'npmjs.com',
  'pypi.org',
  'wikipedia.org',
  'linkedin.com',
  'slack.com',
  'teams.microsoft.com',
  'zoom.us',
  'meet.google.com',
  'jira.atlassian.com',
  'trello.com',
  'asana.com',
  'linear.app',

  // AI & Learning Platforms
  'chatgpt.com',
  'chat.openai.com',
  'openai.com',
  'claude.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'perplexity.ai',
  'geeksforgeeks.org',
  'w3schools.com',
  'freecodecamp.org'
],
  unproductive: [
    'facebook.com', 'instagram.com', 'twitter.com', 'x.com', 'tiktok.com',
    'reddit.com', 'youtube.com', 'netflix.com', 'twitch.tv', 'pinterest.com',
    'snapchat.com', 'discord.com', '9gag.com', 'roblox.com'
  ]
};

let currentTab = null;
let sessionStart = null;
let isIdle = false;
let pendingEntries = [];

function extractDomain(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function matchesDomain(hostname, pattern) {
  return hostname === pattern || hostname.endsWith('.' + pattern);
}

function classifyDomain(domain) {
  for (const pattern of DEFAULT_CLASSIFICATIONS.productive) {
    if (matchesDomain(domain, pattern)) return 'productive';
  }
  for (const pattern of DEFAULT_CLASSIFICATIONS.unproductive) {
    if (matchesDomain(domain, pattern)) return 'unproductive';
  }
  return 'neutral';
}

function isTrackableUrl(url) {
  if (!url) return false;
  return url.startsWith('http://') || url.startsWith('https://');
}

async function getUserId() {
  const { userId } = await chrome.storage.local.get('userId');
  if (userId) return userId;

  const newId = crypto.randomUUID();
  await chrome.storage.local.set({ userId: newId });

  try {
    await fetch(`${API_BASE}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: newId })
    });
  } catch (err) {
    console.warn('Could not register user with backend:', err.message);
  }

  return newId;
}

function savePendingEntry() {
  if (!currentTab || !sessionStart || isIdle) return;

  const durationSeconds = Math.floor((Date.now() - sessionStart) / 1000);
  if (durationSeconds < 1) return;

  const domain = extractDomain(currentTab.url);
  if (!domain) return;

  pendingEntries.push({
    domain,
    url: currentTab.url,
    title: currentTab.title,
    durationSeconds,
    category: classifyDomain(domain),
    recordedAt: new Date(sessionStart).toISOString()
  });

  sessionStart = Date.now();
}

async function syncToBackend() {
  if (pendingEntries.length === 0) return;

  const userId = await getUserId();
  const entriesToSync = [...pendingEntries];
  pendingEntries = [];

  try {
    const response = await fetch(`${API_BASE}/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, entries: entriesToSync })
    });

    if (!response.ok) {
      pendingEntries = [...entriesToSync, ...pendingEntries];
    }
  } catch {
    pendingEntries = [...entriesToSync, ...pendingEntries];
  }
}

function startTracking(tab) {
  if (!isTrackableUrl(tab?.url)) {
    currentTab = null;
    sessionStart = null;
    return;
  }

  currentTab = { url: tab.url, title: tab.title || tab.url };
  sessionStart = Date.now();
}

function handleTabChange(tab) {
  savePendingEntry();
  startTracking(tab);
}

chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    handleTabChange(tab);
  } catch {
    savePendingEntry();
    currentTab = null;
    sessionStart = null;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active && isTrackableUrl(tab.url)) {
    handleTabChange(tab);
  }
});

chrome.windows.onFocusChanged.addListener(async (windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    savePendingEntry();
    currentTab = null;
    sessionStart = null;
    return;
  }

  try {
    const [tab] = await chrome.tabs.query({ active: true, windowId });
    if (tab) handleTabChange(tab);
  } catch {
    /* ignore */
  }
});

chrome.idle.onStateChanged.addListener((state) => {
  if (state === 'idle' || state === 'locked') {
    isIdle = true;
    savePendingEntry();
    currentTab = null;
    sessionStart = null;
  } else if (state === 'active') {
    isIdle = false;
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
      if (tab) startTracking(tab);
    });
  }
});

chrome.alarms.create(SYNC_ALARM, { periodInMinutes: SYNC_INTERVAL_MINUTES });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === SYNC_ALARM) {
    savePendingEntry();
    syncToBackend();
  }
});

chrome.runtime.onStartup.addListener(async () => {
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) startTracking(tab);
});

chrome.runtime.onInstalled.addListener(async () => {
  chrome.idle.setDetectionInterval(IDLE_THRESHOLD_SECONDS);
  await getUserId();
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) startTracking(tab);
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_STATUS') {
    savePendingEntry();
    const todayStats = { productive: 0, unproductive: 0, neutral: 0 };

    for (const entry of pendingEntries) {
      todayStats[entry.category] += entry.durationSeconds;
    }

    sendResponse({
      currentSite: currentTab ? extractDomain(currentTab.url) : null,
      currentCategory: currentTab ? classifyDomain(extractDomain(currentTab.url)) : null,
      pendingCount: pendingEntries.length,
      todayStats
    });
    return true;
  }

  if (message.type === 'SYNC_NOW') {
    savePendingEntry();
    syncToBackend().then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.type === 'GET_USER_ID') {
    getUserId().then((userId) => sendResponse({ userId }));
    return true;
  }
});
