function formatDuration(seconds) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins}m`;
}

function updateUI(data) {
  const siteEl = document.getElementById('current-site');
  const badgeEl = document.getElementById('category-badge');

  if (data.currentSite) {
    siteEl.textContent = data.currentSite;
    badgeEl.textContent = data.currentCategory;
    badgeEl.className = `badge ${data.currentCategory}`;
  } else {
    siteEl.textContent = 'No active tab';
    badgeEl.textContent = '—';
    badgeEl.className = 'badge neutral';
  }

  document.getElementById('productive-time').textContent =
    formatDuration(data.todayStats.productive);
  document.getElementById('unproductive-time').textContent =
    formatDuration(data.todayStats.unproductive);
  document.getElementById('neutral-time').textContent =
    formatDuration(data.todayStats.neutral);
}

chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
  if (response) updateUI(response);
});

document.getElementById('sync-btn').addEventListener('click', () => {
  const statusEl = document.getElementById('sync-status');
  statusEl.textContent = 'Syncing...';

  chrome.runtime.sendMessage({ type: 'SYNC_NOW' }, () => {
    statusEl.textContent = 'Synced successfully!';
    setTimeout(() => { statusEl.textContent = ''; }, 2000);
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
      if (response) updateUI(response);
    });
  });
});

document.getElementById('dashboard-btn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'GET_USER_ID' }, (response) => {
    const userId = response?.userId || '';
    chrome.tabs.create({ url: `http://localhost:3000/?userId=${userId}` });
  });
});

setInterval(() => {
  chrome.runtime.sendMessage({ type: 'GET_STATUS' }, (response) => {
    if (response) updateUI(response);
  });
}, 5000);
