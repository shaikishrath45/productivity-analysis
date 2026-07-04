const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data');
const dbPath = path.join(dataDir, 'store.json');

const DEFAULT_DATA = {
  users: [],
  timeEntries: [],
  siteClassifications: []
};

function ensureDataFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, JSON.stringify(DEFAULT_DATA, null, 2));
  }
}

function readStore() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(dbPath, 'utf8'));
}

function writeStore(data) {
  ensureDataFile();
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

function initDatabase() {
  ensureDataFile();
  return {
    read: readStore,
    write: writeStore
  };
}

module.exports = { initDatabase };
