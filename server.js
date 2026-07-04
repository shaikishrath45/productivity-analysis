const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { initDatabase } = require('./database');
const { createRoutes } = require('./routes');

const PORT = process.env.PORT || 3000;
const dataDir = path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = initDatabase();
const app = express();

app.use(cors());
app.use(express.json());

app.use('/api', createRoutes(db));

const dashboardPath = path.join(__dirname, '..', '..', 'dashboard');
app.use(express.static(dashboardPath));

app.get('/', (_req, res) => {
  res.sendFile(path.join(dashboardPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Productivity Tracker API running at http://localhost:${PORT}`);
  console.log(`Dashboard available at http://localhost:${PORT}`);
});
