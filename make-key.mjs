// Issue a site key: node make-key.mjs <site> <engine>   (engine: liability|property|accident)
import crypto from 'node:crypto'; import fs from 'node:fs'; import path from 'node:path';
const DATA = process.env.DATA_DIR || './data'; const KEYS = path.join(DATA, 'keys.json');
const [site, engine] = process.argv.slice(2);
if (!site || !['liability','property','accident'].includes(engine)) { console.error('usage: node make-key.mjs <site> <liability|property|accident>'); process.exit(1); }
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const key = 'rk_' + site.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '_' + crypto.randomBytes(16).toString('hex');
const keys = fs.existsSync(KEYS) ? JSON.parse(fs.readFileSync(KEYS, 'utf8')) : {};
keys[sha(key)] = {site, engine, created: new Date().toISOString()};
fs.mkdirSync(DATA, {recursive: true}); fs.writeFileSync(KEYS, JSON.stringify(keys, null, 2));
console.log(key); // shown once; only the sha256 is stored
