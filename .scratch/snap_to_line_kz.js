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

const lines = data.projects
  .filter(p => p.type === 'line' && p.points && p.points.length >= 2)
  .map(p => ({ id: p.id, pts: p.points }));

const MAX_ASSOC_DIST = 200; // tight - only snap labels genuinely meant to sit on one of these specific highlighted lines
const SNAP_THRESHOLD = 45;
const TARGET_OFFSET = 20;

let moved = 0, checked = 0;
let sideToggle = 0;

for (const project of data.projects) {
  if (project.type !== 'label') continue;
  if (!Number.isFinite(project.x) || !Number.isFinite(project.y)) continue;
  checked++;

  let best = null;
  for (const line of lines) {
    const r = nearestOnPolyline([project.x, project.y], line.pts);
    if (!best || r.dist < best.dist) best = r;
  }
  if (!best || best.dist > MAX_ASSOC_DIST || best.dist <= SNAP_THRESHOLD) continue;

  sideToggle = (sideToggle + 1) % 2;
  const perp = best.angle + Math.PI / 2;
  const sign = sideToggle === 0 ? 1 : -1;
  project.x = Math.round((best.x + Math.cos(perp) * TARGET_OFFSET * sign) * 100) / 100;
  project.y = Math.round((best.y + Math.sin(perp) * TARGET_OFFSET * sign) * 100) / 100;
  project.labelRotate = Math.round((best.angle * 180 / Math.PI) % 360);
  moved++;
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log(`checked ${checked} labels, moved ${moved} onto a nearby highlighted project line (within ${MAX_ASSOC_DIST}u)`);
