const fs = require('fs');
const path = './data/projects.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

function byId(id) { return data.projects.find(p => p.id === id); }
function removeIds(ids) {
  const set = new Set(ids);
  const before = data.projects.length;
  data.projects = data.projects.filter(p => !set.has(p.id));
  return before - data.projects.length;
}
function groupIds(prefix) {
  return data.projects.filter(p => p.id.startsWith(prefix + '-s')).map(p => p.id);
}

let log = [];

// 1. Remove duplicate/circle clusters entirely
for (const prefix of ['obj-saryozek-combo-alm7', 'obj-mankent-combo-shy7', 'obj-bigtangle2-zh12']) {
  const ids = groupIds(prefix);
  const removed = removeIds(ids);
  log.push(`removed cluster ${prefix}: ${removed} labels`);
}

// 2. Zhetygen/Almaty area: keep critical, halve rest, rotate vertical
{
  const bbox = { x0: 13500, y0: 15250, x1: 14700, y1: 15900 };
  const keepNames = ['Алтынколь', 'Иинтал', 'Жетыген', 'Капчагай', 'Илийская'];
  const inBox = data.projects.filter(p => p.type === 'label' && p.x >= bbox.x0 && p.x <= bbox.x1 && p.y >= bbox.y0 && p.y <= bbox.y1);
  const critical = inBox.filter(p => keepNames.includes(p.name.ru));
  const rest = inBox.filter(p => !keepNames.includes(p.name.ru));
  // sort rest: keep named stations preferentially over "Раз." ones, then thin by half
  rest.sort((a, b) => {
    const aRaz = /^Раз\./i.test(a.name.ru) ? 1 : 0;
    const bRaz = /^Раз\./i.test(b.name.ru) ? 1 : 0;
    if (aRaz !== bRaz) return aRaz - bRaz;
    return a.id.localeCompare(b.id);
  });
  const toRemove = new Set();
  for (let i = 0; i < rest.length; i++) {
    if (i % 2 === 1) toRemove.add(rest[i].id);
  }
  const removedCount = removeIds([...toRemove]);
  // rotate remaining vertical
  const stillIn = data.projects.filter(p => p.type === 'label' && p.x >= bbox.x0 && p.x <= bbox.x1 && p.y >= bbox.y0 && p.y <= bbox.y1);
  for (const p of stillIn) { p.labelRotate = 90; p.labelDx = 16; p.labelDy = 4; }
  log.push(`Zhetygen area: ${inBox.length} labels -> removed ${removedCount}, remaining ${stillIn.length} rotated vertical`);
}

// 3. Oskemen (east-kz combos)
{
  const prefixes = ['obj-comboA-ek4', 'obj-comboB-ek6', 'obj-comboC-ek7', 'obj-comboE-ek10', 'obj-comboF-ek11', 'obj-comboShar-ek14'];
  let totalBefore = 0, totalRemoved = 0;
  for (const prefix of prefixes) {
    const ids = groupIds(prefix);
    totalBefore += ids.length;
    const items = ids.map(byId).filter(Boolean);
    items.sort((a, b) => a.id.localeCompare(b.id));
    const toRemove = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].name.ru === 'Усть-Каменогорск') continue; // always keep
      if (i % 2 === 1) toRemove.push(items[i].id);
    }
    totalRemoved += removeIds(toRemove);
  }
  log.push(`Oskemen combos: ${totalBefore} labels -> removed ${totalRemoved}`);
}

// 4. West-KZ (Uralsk) 3 circles -> fit line, reduce to ~9, align along line
{
  const prefixes = ['obj-combo1-westkz', 'obj-combo2-westkz', 'obj-combo3-westkz'];
  let all = [];
  for (const prefix of prefixes) all = all.concat(groupIds(prefix).map(byId).filter(Boolean));
  const n = all.length;
  const sx = all.reduce((s, p) => s + p.x, 0) / n;
  const sy = all.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0;
  for (const p of all) { sxx += (p.x - sx) * (p.x - sx); sxy += (p.x - sx) * (p.y - sy); }
  const slope = sxy / sxx;
  const angle = Math.atan2(slope, 1);
  const dirx = Math.cos(angle), diry = Math.sin(angle);
  // project each point onto line through (sx,sy) with direction (dirx,diry)
  for (const p of all) {
    const t = (p.x - sx) * dirx + (p.y - sy) * diry;
    p._t = t;
    p._projx = sx + t * dirx;
    p._projy = sy + t * diry;
  }
  all.sort((a, b) => a._t - b._t);
  // keep ~9 of 22, always keep named (non Раз.) stations preferentially, spread evenly along sorted order
  const named = all.filter(p => !/^Раз\./i.test(p.name.ru));
  const razOnes = all.filter(p => /^Раз\./i.test(p.name.ru));
  const targetCount = 9;
  let keep = [];
  if (named.length <= targetCount) {
    keep = named.slice();
    const extra = targetCount - keep.length;
    for (let i = 0; i < Math.min(extra, razOnes.length); i++) keep.push(razOnes[i]);
  } else {
    // evenly sample from named list
    const step = named.length / targetCount;
    for (let i = 0; i < targetCount; i++) keep.push(named[Math.floor(i * step)]);
  }
  const keepIds = new Set(keep.map(p => p.id));
  const toRemove = all.filter(p => !keepIds.has(p.id)).map(p => p.id);
  const removedCount = removeIds(toRemove);
  // reposition kept points along the fitted line, evenly spaced, rotate label to match line angle
  keep.sort((a, b) => a._t - b._t);
  const spacing = 55;
  const startT = -((keep.length - 1) * spacing) / 2;
  const labelAngleDeg = (angle * 180 / Math.PI);
  for (let i = 0; i < keep.length; i++) {
    const t = startT + i * spacing;
    const p = byId(keep[i].id);
    p.x = Math.round((sx + t * dirx) * 100) / 100;
    p.y = Math.round((sy + t * diry) * 100) / 100;
    p.labelRotate = Math.round(labelAngleDeg);
    p.labelDx = 0;
    p.labelDy = (i % 2 === 0) ? -18 : 18;
    delete p._t; delete p._projx; delete p._projy;
  }
  log.push(`West-KZ (Uralsk): ${n} labels -> removed ${removedCount}, kept ${keep.length} aligned along fitted line (angle ${labelAngleDeg.toFixed(1)} deg)`);
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log(log.join('\n'));
console.log('total projects now:', data.projects.length);
