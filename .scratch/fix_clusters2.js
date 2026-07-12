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
function halveGroup(prefix, alwaysKeepNames) {
  const ids = groupIds(prefix);
  const items = ids.map(byId).filter(Boolean);
  items.sort((a, b) => {
    const aRaz = /^Раз\./i.test(a.name.ru) ? 1 : 0;
    const bRaz = /^Раз\./i.test(b.name.ru) ? 1 : 0;
    if (aRaz !== bRaz) return aRaz - bRaz;
    return a.id.localeCompare(b.id);
  });
  const toRemove = [];
  for (let i = 0; i < items.length; i++) {
    if (alwaysKeepNames && alwaysKeepNames.includes(items[i].name.ru)) continue;
    if (i % 2 === 1) toRemove.push(items[i].id);
  }
  const removed = removeIds(toRemove);
  const remaining = groupIds(prefix).map(byId).filter(Boolean);
  remaining.forEach((p, i) => { p.labelDy = (i % 2 === 0) ? -10 : 16; });
  return { before: items.length, removed, after: remaining.length };
}

let log = [];

// Beyneu cluster reduction
{
  const beyneu = byId('obj-beyneu-mkz38');
  const labels = data.projects.filter(p => p.type === 'label' && p.region === 'mangystau');
  const near = labels.filter(p => Math.hypot(p.x - beyneu.x, p.y - beyneu.y) < 350 && p.id !== beyneu.id);
  near.sort((a, b) => {
    const aRaz = /^Раз\./i.test(a.name.ru) ? 1 : 0;
    const bRaz = /^Раз\./i.test(b.name.ru) ? 1 : 0;
    if (aRaz !== bRaz) return aRaz - bRaz;
    return Math.hypot(a.x - beyneu.x, a.y - beyneu.y) - Math.hypot(b.x - beyneu.x, b.y - beyneu.y);
  });
  const toRemove = [];
  for (let i = 0; i < near.length; i++) { if (i % 2 === 1) toRemove.push(near[i].id); }
  const removed = removeIds(toRemove);
  log.push(`Beyneu: ${near.length + 1} labels -> removed ${removed}`);
}

// Kostanay trim (razalkau-kos16 + basagash-kos17, 5 total -> remove 2)
{
  const ids = [...groupIds('obj-razalkau-kos16'), ...groupIds('obj-basagash-kos17')];
  const removed = removeIds([ids[0], ids[2]]); // drop 2 of the 5
  log.push(`Kostanay combo trim: removed ${removed}`);
}

// General halving for remaining large (>=5) combo groups
const largeGroups = [
  'obj-bigtangle-alm1',
  'obj-karakonyr-combo-shy10',
  'obj-zhosaly-combo-kzo1',
  'obj-belkol-combo-kzo2',
  'obj-sapak-combo-kzo3',
  'obj-toretam-combo-kzo4',
  'obj-combo-shubarkudyk-atyrau'
];
for (const g of largeGroups) {
  const r = halveGroup(g);
  log.push(`${g}: ${r.before} -> removed ${r.removed}, remaining ${r.after}`);
}

// Uzbekistan: keep only big-caps city names (УРГЕНЧ), delete rest of our added station labels
{
  const keepIds = new Set(['obj-urgench-uzk4', 'obj-st-otval-naya-st-kol-cevaya-mrdauxw7']);
  const uzLabels = data.projects.filter(p => p.region === 'uzbekistan' && p.type === 'label' && !keepIds.has(p.id));
  const removed = removeIds(uzLabels.map(p => p.id));
  log.push(`Uzbekistan: removed ${removed} station labels, kept big-caps only`);
}

// Bishkek-Kochkor: remove minor duplicates, stagger the rest
{
  const removeNames = ['Бишкек I', 'Бишкек II', 'О.п. Чимкурган'];
  const kgLabels = data.projects.filter(p => p.region === 'kyrgyzstan' && p.type === 'label');
  const toRemove = kgLabels.filter(p => removeNames.includes(p.name.ru)).map(p => p.id);
  const removed = removeIds(toRemove);
  const remaining = data.projects.filter(p => p.region === 'kyrgyzstan' && p.type === 'label' && !['БИШКЕК', 'Кыргызстан'].includes(p.name.ru));
  remaining.sort((a, b) => a.x - b.x);
  remaining.forEach((p, i) => {
    p.labelRotate = (i % 2 === 0) ? 0 : 35;
    p.labelDy = (i % 2 === 0) ? -10 : 18;
  });
  log.push(`Bishkek-Kochkor: removed ${removed} minor labels, staggered ${remaining.length} remaining`);
}

fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log(log.join('\n'));
console.log('total projects now:', data.projects.length);
console.log('total labels now:', data.projects.filter(p => p.type === 'label').length);
