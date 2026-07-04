const API_BASE = '/api';

let userId = new URLSearchParams(window.location.search).get('userId');
let pieChart = null;
let barChart = null;
let weeklyChart = null;

function formatDuration(seconds) {
  if (!seconds) return '0m';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });
}

async function ensureUser() {
  if (userId) return userId;

  userId = localStorage.getItem('trackerUserId');
  if (userId) return userId;

  const res = await fetch(`${API_BASE}/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  const data = await res.json();
  userId = data.userId;
  localStorage.setItem('trackerUserId', userId);
  return userId;
}

async function fetchAnalytics(days) {
  const res = await fetch(`${API_BASE}/analytics/${userId}?days=${days}`);
  if (!res.ok) throw new Error('Failed to load analytics');
  return res.json();
}

async function fetchWeeklyReport() {
  const res = await fetch(`${API_BASE}/reports/weekly/${userId}`);
  if (!res.ok) throw new Error('Failed to load weekly report');
  return res.json();
}

async function fetchClassifications() {
  const res = await fetch(`${API_BASE}/classifications/${userId}`);
  if (!res.ok) throw new Error('Failed to load classifications');
  return res.json();
}

function updateScoreRing(score) {
  const circle = document.getElementById('score-circle');
  const circumference = 2 * Math.PI * 52;
  const offset = circumference - (score / 100) * circumference;
  circle.style.strokeDashoffset = offset;

  let color = '#34d399';
  if (score < 40) color = '#f87171';
  else if (score < 70) color = '#fbbf24';
  circle.style.stroke = color;

  document.getElementById('productivity-score').textContent = score;
}

function renderOverview(data) {
  const { summary, productivityScore, topSites } = data;

  updateScoreRing(productivityScore);
  document.getElementById('total-productive').textContent = formatDuration(summary.productive);
  document.getElementById('total-unproductive').textContent = formatDuration(summary.unproductive);
  document.getElementById('total-neutral').textContent = formatDuration(summary.neutral);
  document.getElementById('total-all').textContent = formatDuration(summary.total);

  if (pieChart) pieChart.destroy();
  pieChart = new Chart(document.getElementById('pie-chart'), {
    type: 'doughnut',
    data: {
      labels: ['Productive', 'Unproductive', 'Neutral'],
      datasets: [{
        data: [summary.productive, summary.unproductive, summary.neutral],
        backgroundColor: ['#34d399', '#f87171', '#64748b'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom', labels: { color: '#94a3b8' } } }
    }
  });

  const siteMap = {};
  for (const site of topSites) {
    if (!siteMap[site.domain]) {
      siteMap[site.domain] = { productive: 0, unproductive: 0, neutral: 0 };
    }
    siteMap[site.domain][site.category] += site.total_seconds;
  }

  const domains = Object.keys(siteMap).slice(0, 8);
  if (barChart) barChart.destroy();
  barChart = new Chart(document.getElementById('bar-chart'), {
    type: 'bar',
    data: {
      labels: domains,
      datasets: [
        { label: 'Productive', data: domains.map(d => siteMap[d].productive), backgroundColor: '#34d399' },
        { label: 'Unproductive', data: domains.map(d => siteMap[d].unproductive), backgroundColor: '#f87171' },
        { label: 'Neutral', data: domains.map(d => siteMap[d].neutral), backgroundColor: '#64748b' }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: { stacked: true, ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { stacked: true, ticks: { color: '#94a3b8', callback: v => formatDuration(v) }, grid: { color: '#334155' } }
      },
      plugins: { legend: { labels: { color: '#94a3b8' } } }
    }
  });

  const tbody = document.getElementById('sites-table-body');
  tbody.innerHTML = topSites.map(site => `
    <tr>
      <td>${site.domain}</td>
      <td><span class="category-tag ${site.category}">${site.category}</span></td>
      <td>${formatDuration(site.total_seconds)}</td>
      <td>${site.visit_count}</td>
    </tr>
  `).join('');
}

function renderWeeklyReport(data) {
  document.getElementById('report-period').textContent =
    `${formatDate(data.weekStart)} — ${formatDate(data.weekEnd)}`;
  document.getElementById('weekly-score').textContent = `${data.productivityScore}%`;

  const renderList = (id, sites) => {
    const el = document.getElementById(id);
    if (!sites.length) {
      el.innerHTML = '<li><span>No data yet</span></li>';
      return;
    }
    el.innerHTML = sites.map(s => `
      <li><span>${s.domain}</span><span>${formatDuration(s.total_seconds)}</span></li>
    `).join('');
  };

  renderList('top-productive-list', data.topProductiveSites);
  renderList('top-unproductive-list', data.topUnproductiveSites);

  const days = Object.keys(data.dailyBreakdown).sort();
  if (weeklyChart) weeklyChart.destroy();
  weeklyChart = new Chart(document.getElementById('weekly-chart'), {
    type: 'line',
    data: {
      labels: days.map(d => new Date(d + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })),
      datasets: [
        { label: 'Productive', data: days.map(d => data.dailyBreakdown[d].productive), borderColor: '#34d399', backgroundColor: 'rgba(52,211,153,0.1)', fill: true, tension: 0.3 },
        { label: 'Unproductive', data: days.map(d => data.dailyBreakdown[d].unproductive), borderColor: '#f87171', backgroundColor: 'rgba(248,113,113,0.1)', fill: true, tension: 0.3 }
      ]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { color: '#94a3b8' }, grid: { color: '#334155' } },
        y: { ticks: { color: '#94a3b8', callback: v => formatDuration(v) }, grid: { color: '#334155' } }
      },
      plugins: { legend: { labels: { color: '#94a3b8' } } }
    }
  });
}

async function renderClassifications(classifications) {
  const list = document.getElementById('classifications-list');
  if (!classifications.length) {
    list.innerHTML = '<li><span>No custom classifications yet</span></li>';
    return;
  }
  list.innerHTML = classifications.map(c => `
    <li>
      <span>${c.domain}</span>
      <span class="category-tag ${c.category}">${c.category}</span>
    </li>
  `).join('');
}

function showView(viewName) {
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${viewName}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelector(`[data-view="${viewName}"]`).classList.add('active');

  const titles = {
    overview: 'Overview',
    weekly: 'Weekly Report',
    sites: 'Top Sites',
    settings: 'Settings'
  };
  document.getElementById('page-title').textContent = titles[viewName];
}

async function loadData() {
  const loading = document.getElementById('loading');
  const error = document.getElementById('error');
  loading.classList.remove('hidden');
  error.classList.add('hidden');

  try {
    await ensureUser();
    document.getElementById('user-id-display').textContent = userId;

    const days = document.getElementById('period-select').value;
    const [analytics, weekly, classifications] = await Promise.all([
      fetchAnalytics(days),
      fetchWeeklyReport(),
      fetchClassifications()
    ]);

    renderOverview(analytics);
    renderWeeklyReport(weekly);
    renderClassifications(classifications);
  } catch (err) {
    error.textContent = err.message;
    error.classList.remove('hidden');
  } finally {
    loading.classList.add('hidden');
  }
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', (e) => {
    e.preventDefault();
    showView(item.dataset.view);
  });
});

document.getElementById('refresh-btn').addEventListener('click', loadData);
document.getElementById('period-select').addEventListener('change', loadData);

document.getElementById('classification-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const domain = document.getElementById('domain-input').value.trim();
  const category = document.getElementById('category-select').value;

  await fetch(`${API_BASE}/classifications/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ domain, category })
  });

  document.getElementById('domain-input').value = '';
  const classifications = await fetchClassifications();
  renderClassifications(classifications);
});

loadData();
