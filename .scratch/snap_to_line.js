const fs = require('fs');
const path = './data/projects.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

function nearestOnSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = a[0] + t * dx, cy = a[1] + t * dy;
  return { x: cx, y: cy, dist: Math.hypot(p[0] - cx, p[1] - cy), angle: Math.atan2(dy, dx) };
}

function nearestOnPolyline(p, pts) {
  let best = null;
  for (let i = 0; i < pts.length - 1; i++) {
    const r = nearestOnSegment(p, pts[i], pts[i + 1]);
    if (!best || r.dist < best.dist) best = r;
  }
  return best;
}

// [lineId, region filter, points, max snap distance]
const lines = [
  { name: 'uz-bukhara-khiva', region: 'uzbekistan', pts: [[9925.1,17464.3],[9849.5,17448.4],[9766,17269.4],[9262.9,16893.5],[9213.2,16768.2],[9151.5,16728.5],[9060.1,16718.5],[9018.3,16730.5],[8992.4,16756.3],[8825.4,16621.1]] },
  { name: 'uz-angren-andijan', region: 'uzbekistan', pts: [[11715.3,17091.6],[11737.2,17043.5],[11790.8,17024.9],[11846.6,17032.5],[11886,17054.4],[11934.1,17021.6],[11996.4,17019.4],[12050,17031.4],[12068.6,17021.6],[12055.5,17041.3],[12032.5,17097.1],[12128.8,17121.1],[12166,17100.3],[12217.4,17101.4],[12268.8,17063.2],[12274.2,17041.3]] }
];

const MAX_ASSOC_DIST = 700; // only associate a label with a line if within this range
const SNAP_THRESHOLD = 45;  // only move it if farther than this from the line
const TARGET_OFFSET = 20;   // how close to place it next to the line after snapping

let moved = 0, skipped = 0, sideToggle = 0;

for (const project of data.projects) {
  if (project.type !== 'label' || project.region !== 'uzbekistan') continue;
  if (!Number.isFinite(project.x) || !Number.isFinite(project.y)) continue;

  let best = null, bestLine = null;
  for (const line of lines) {
    const r = nearestOnPolyline([project.x, project.y], line.pts);
    if (!best || r.dist < best.dist) { best = r; bestLine = line; }
  }
  if (!best || best.dist > MAX_ASSOC_DIST) { skipped++; continue; }
  if (best.dist <= SNAP_THRESHOLD) continue; // already close enough

  sideToggle = (sideToggle + 1) % 2;
  const perp = best.angle + Math.PI / 2;
  const sign = sideToggle === 0 ? 1 : -1;
  const nx = Math.round((best.x + Math.cos(perp) * TARGET_OFFSET * sign) * 100) / 100;
  const ny = Math.round((best.y + Math.sin(perp) * TARGET_OFFSET * sign) * 100) / 100;
  project.x = nx;
  project.y = ny;
  project.labelRotate = Math.round((best.angle * 180 / Math.PI) % 360);
  moved++;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log(`moved ${moved} labels closer to their project line, skipped ${skipped} (too far from either line / not associated)`);
