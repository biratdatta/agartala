#!/usr/bin/env node
/**
 * Downloads the paras round MBB Stadium, Agartala, from OpenStreetMap (Overpass API) and writes a compact extract
 * to data/raw/agartala-osm.json. Coordinates are projected to metres from an origin near
 * Ujjayanta Palace (x east, z south) and rounded to 0.5 m.
 *
 *   npm run map:fetch            # default box
 *   node scripts/fetch-osm.mjs --bbox 23.810,91.274,23.842,91.314
 *
 * Map data © OpenStreetMap contributors, ODbL.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const bboxArg = args[args.indexOf('--bbox') + 1];
const BBOX = (args.includes('--bbox') && bboxArg ? bboxArg : '23.810,91.274,23.842,91.314').split(',').map(Number);
const ENDPOINTS = ['https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
const LAT0 = 23.8368, LON0 = 91.2826;
const KX = Math.cos((LAT0 * Math.PI) / 180) * 111320, KZ = 110574;

const B = `(${BBOX.join(',')})`;
const query = `[out:json][timeout:180][maxsize:200000000];(way["highway"]${B};way["building"]${B};nwr["natural"="water"]${B};way["waterway"]${B};way["landuse"]${B};way["leisure"]${B};way["natural"]${B};way["railway"]${B};way["amenity"]${B};node["name"]${B};relation["natural"="water"]${B};);out geom;`;

async function overpass() {
  for (const url of ENDPOINTS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        process.stdout.write(`Querying ${new URL(url).host}${attempt ? ` (retry ${attempt})` : ''}… `);
        const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'user-agent': 'haora-bari-agartala/1.0 (map bake script)' }, body: 'data=' + encodeURIComponent(query) });
        const text = await r.text();
        if (r.ok && text.trimStart().startsWith('{')) { console.log('ok'); return JSON.parse(text); }
        console.log(`busy (${r.status})`);
      } catch (e) { console.log(`failed: ${e.message}`); }
      await new Promise((res) => setTimeout(res, 5000 * (attempt + 1)));
    }
  }
  throw new Error('Every Overpass server refused. Try again in a few minutes.');
}

const P = (p) => [Math.round((p.lon - LON0) * KX * 2) / 2, Math.round(-(p.lat - LAT0) * KZ * 2) / 2];
const flat = (g) => g.flatMap((p) => P(p));

const raw = await overpass();
const names = [], ni = new Map();
const N = (s) => { if (!s) return -1; if (!ni.has(s)) { ni.set(s, names.length); names.push(s); } return ni.get(s); };
const out = { origin: [LAT0, LON0], bbox: BBOX, fetched: new Date().toISOString(), names, roads: [], bld: [], water: [], river: [], land: [], rail: [], poi: [] };
for (const e of raw.elements) {
  const t = e.tags || {};
  if (e.type === 'node') {
    if (t.name) out.poi.push([...P(e), t.amenity || t.shop || t.tourism || t.historic || t.place || t.leisure || t.office || t.railway || t.highway || t.public_transport || t.building || 'other', N(t.name), t['name:bn'] ? N(t['name:bn']) : -1]);
    continue;
  }
  if (e.type === 'relation') { for (const m of e.members || []) if (m.role === 'outer' && m.geometry) out.water.push([N(t.name), flat(m.geometry)]); continue; }
  if (!e.geometry) continue;
  const g = flat(e.geometry);
  if (t.building) out.bld.push([parseFloat(t['building:levels']) || 0, parseFloat(t.height) || 0, t.name ? N(t.name) : -1, t.amenity || t.building, g]);
  else if (t.highway) out.roads.push([t.highway, N(t.name), t.bridge ? 1 : 0, g]);
  else if (t.natural === 'water' || t.water || t.waterway === 'riverbank') out.water.push([N(t.name), g]);
  else if (t.waterway) out.river.push([t.waterway, N(t.name), g]);
  else if (t.railway) out.rail.push([t.railway, g]);
  else out.land.push([t.landuse || t.leisure || t.natural || t.amenity, N(t.name), g]);
}
const file = path.resolve('data/raw/agartala-osm.json');
await mkdir(path.dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(out));
console.log(`Wrote ${file}: ${out.bld.length} buildings, ${out.roads.length} roads, ${out.water.length} water areas, ${out.poi.length} named places.`);
console.log('Next: npm run map:bake');
