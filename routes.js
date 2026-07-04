const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { extractDomain, classifyDomain } = require('./classifier');

function createRoutes(db) {
  const router = express.Router();

  router.post('/users', (req, res) => {
    const { userId } = req.body;
    const id = userId || uuidv4();
    const store = db.read();

    if (!store.users.find(u => u.id === id)) {
      store.users.push({ id, createdAt: new Date().toISOString() });
      db.write(store);
    }

    res.json({ userId: id });
  });

  router.post('/sync', (req, res) => {
    const { userId, entries } = req.body;

    if (!userId || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'userId and entries array required' });
    }

    const store = db.read();

    if (!store.users.find(u => u.id === userId)) {
      store.users.push({ id: userId, createdAt: new Date().toISOString() });
    }

    const customClassifications = store.siteClassifications.filter(
      c => c.userId === userId || c.userId === null
    );

    let count = 0;
    for (const entry of entries) {
      const domain = entry.domain || extractDomain(entry.url);
      if (!domain || !entry.durationSeconds) continue;

      const category = entry.category || classifyDomain(domain, customClassifications);
      store.timeEntries.push({
        id: store.timeEntries.length + 1,
        userId,
        domain,
        url: entry.url || null,
        title: entry.title || null,
        durationSeconds: entry.durationSeconds,
        category,
        recordedAt: entry.recordedAt || new Date().toISOString()
      });
      count++;
    }

    db.write(store);
    res.json({ synced: count, message: 'Data synced successfully' });
  });

  router.get('/analytics/:userId', (req, res) => {
    const { userId } = req.params;
    const { days = 7 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - parseInt(days, 10));

    const store = db.read();
    const entries = store.timeEntries.filter(
      e => e.userId === userId && new Date(e.recordedAt) >= since
    );

    const siteMap = {};
    const totals = { productive: 0, unproductive: 0, neutral: 0, total: 0 };

    for (const entry of entries) {
      totals[entry.category] = (totals[entry.category] || 0) + entry.durationSeconds;
      totals.total += entry.durationSeconds;

      const key = `${entry.domain}:${entry.category}`;
      if (!siteMap[key]) {
        siteMap[key] = { domain: entry.domain, category: entry.category, totalSeconds: 0, visitCount: 0 };
      }
      siteMap[key].totalSeconds += entry.durationSeconds;
      siteMap[key].visitCount++;
    }

    const topSites = Object.values(siteMap)
      .sort((a, b) => b.totalSeconds - a.totalSeconds)
      .slice(0, 20)
      .map(s => ({
        domain: s.domain,
        category: s.category,
        total_seconds: s.totalSeconds,
        visit_count: s.visitCount
      }));

    const productivityScore = totals.total > 0
      ? Math.round((totals.productive / totals.total) * 100)
      : 0;

    res.json({
      period: { days: parseInt(days, 10), since: since.toISOString() },
      summary: totals,
      productivityScore,
      topSites
    });
  });

  router.get('/reports/weekly/:userId', (req, res) => {
    const { userId } = req.params;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);

    const store = db.read();
    const entries = store.timeEntries.filter(
      e => e.userId === userId && new Date(e.recordedAt) >= weekStart
    );

    const totals = { productive: 0, unproductive: 0, neutral: 0, total: 0 };
    const days = {};
    const productiveSites = {};
    const unproductiveSites = {};

    for (const entry of entries) {
      totals[entry.category] = (totals[entry.category] || 0) + entry.durationSeconds;
      totals.total += entry.durationSeconds;

      const day = entry.recordedAt.slice(0, 10);
      if (!days[day]) days[day] = { productive: 0, unproductive: 0, neutral: 0 };
      days[day][entry.category] += entry.durationSeconds;

      if (entry.category === 'productive') {
        productiveSites[entry.domain] = (productiveSites[entry.domain] || 0) + entry.durationSeconds;
      } else if (entry.category === 'unproductive') {
        unproductiveSites[entry.domain] = (unproductiveSites[entry.domain] || 0) + entry.durationSeconds;
      }
    }

    const topProductive = Object.entries(productiveSites)
      .map(([domain, totalSeconds]) => ({ domain, total_seconds: totalSeconds }))
      .sort((a, b) => b.total_seconds - a.total_seconds)
      .slice(0, 5);

    const topUnproductive = Object.entries(unproductiveSites)
      .map(([domain, totalSeconds]) => ({ domain, total_seconds: totalSeconds }))
      .sort((a, b) => b.total_seconds - a.total_seconds)
      .slice(0, 5);

    const productivityScore = totals.total > 0
      ? Math.round((totals.productive / totals.total) * 100)
      : 0;

    res.json({
      weekStart: weekStart.toISOString(),
      weekEnd: now.toISOString(),
      productivityScore,
      totals,
      dailyBreakdown: days,
      topProductiveSites: topProductive,
      topUnproductiveSites: topUnproductive
    });
  });

  router.get('/classifications/:userId', (req, res) => {
    const { userId } = req.params;
    const store = db.read();
    const classifications = store.siteClassifications
      .filter(c => c.userId === userId || c.userId === null)
      .map(c => ({ domain: c.domain, category: c.category }));
    res.json(classifications);
  });

  router.put('/classifications/:userId', (req, res) => {
    const { userId } = req.params;
    const { domain, category } = req.body;

    if (!domain || !['productive', 'unproductive', 'neutral'].includes(category)) {
      return res.status(400).json({ error: 'Valid domain and category required' });
    }

    const store = db.read();
    const existing = store.siteClassifications.find(
      c => c.userId === userId && c.domain === domain
    );

    if (existing) {
      existing.category = category;
    } else {
      store.siteClassifications.push({ userId, domain, category });
    }

    db.write(store);
    res.json({ domain, category });
  });

  return router;
}

module.exports = { createRoutes };
