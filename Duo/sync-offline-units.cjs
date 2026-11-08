'use strict';

const fs = require('node:fs');
const path = require('node:path');

// The JSON files are the source. Generate the copy used when index.html is
// opened directly, since browsers restrict fetch() from file:// pages.
const directory = path.join(__dirname, 'units');
const units = fs.readdirSync(directory)
  .filter(name => /^unit-\d{2}\.json$/.test(name))
  .sort()
  .map(name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')));

fs.writeFileSync(path.join(__dirname, 'units-offline.js'),
  '// Generated from units/*.json by sync-offline-units.cjs.\nwindow.duoOfflineUnits = '
  + JSON.stringify(units) + ';\n');
