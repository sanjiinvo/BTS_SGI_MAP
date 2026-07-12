const fs = require('fs');
const path = './data/projects.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));

function makeLabel(id, region, ru, en, kk, x, y, opts) {
  opts = opts || {};
  const item = {
    id, type: 'label', color: opts.color || '#ffc107', zIndex: 0, region,
    status: 'completed', year: 2026, fontSize: opts.fontSize || 20,
    name: { ru, en, kk }, segment: { ru, en, kk }, location: { ru, en, kk },
    description: { ru: '', en: '', kk: '' },
    indicators: [], images: [], additional: null, x, y
  };
  if (opts.labelDx !== undefined) item.labelDx = opts.labelDx;
  if (opts.labelDy !== undefined) item.labelDy = opts.labelDy;
  if (opts.labelRotate !== undefined) item.labelRotate = opts.labelRotate;
  if (opts.labelAnchor !== undefined) item.labelAnchor = opts.labelAnchor;
  return item;
}

function splitCombo(baseId, region, names, cx, cy, opts) {
  opts = opts || {};
  const n = names.length;
  const radius = 16 + 7 * n;
  const items = [];
  for (let i = 0; i < n; i++) {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    const x = Math.round((cx + radius * Math.cos(angle)) * 100) / 100;
    const y = Math.round((cy + radius * Math.sin(angle)) * 100) / 100;
    items.push(makeLabel(`${baseId}-s${i + 1}`, region, names[i], names[i], names[i], x, y, { fontSize: opts.fontSize || 20, color: opts.color }));
  }
  return items;
}

let restored = [];

// Standalone (non-combo) Karakalpakstan/Nukus-area names near the Bukhara-Miskin-Urgench-Khiva line
restored.push(makeLabel('obj-berdakh-mkz1', 'uzbekistan', 'Бердах', 'Berdakh', 'Бердақ', 7965, 15546));
restored.push(makeLabel('obj-ayalbergen-mkz2', 'uzbekistan', 'Аялберген', 'Ayalbergen', 'Аялберген', 8033.5, 15596));
restored.push(makeLabel('obj-zhaslyk-mkz3', 'uzbekistan', 'Жаслык', 'Zhaslyk', 'Жаслық', 8068.5, 15667.5));
restored.push(makeLabel('obj-abadan-mkz4', 'uzbekistan', 'Абадан', 'Abadan', 'Абадан', 8173, 15799));
restored.push(makeLabel('obj-azhiniyaz-mkz5', 'uzbekistan', 'Ажинияз', 'Azhiniyaz', 'Ажинияз', 8223.5, 15858.5));
restored.push(makeLabel('obj-karakalpakstan-mkz6', 'uzbekistan', 'Каракалпакстан', 'Karakalpakstan', 'Қарақалпақстан', 7685.5, 15503.5, { fontSize: 24 }));
restored.push(makeLabel('obj-blokpost2-uz3', 'uzbekistan', 'Блокпост №2', 'Blokpost No.2', 'Блокпост №2', 9124, 16773));
restored.push(makeLabel('obj-dautela-uz4', 'uzbekistan', 'Даутела', 'Dautela', 'Даутела', 9252, 16732));
restored.push(makeLabel('obj-akchuka-uz5', 'uzbekistan', 'Акчука', 'Akchuka', 'Ақшұқа', 9311, 16853));
restored.push(makeLabel('obj-suzakdar-uz7', 'uzbekistan', 'Сузакдар', 'Suzakdar', 'Сузакдар', 9523, 16996));
restored.push(makeLabel('obj-uchachik-uz9', 'uzbekistan', 'Учачик', 'Uchachik', 'Учачик', 9687, 17139));
restored.push(makeLabel('obj-tuztela-uz11', 'uzbekistan', 'Тузтела', 'Tuztela', 'Тұзтела', 9723, 17330, { fontSize: 18 }));
restored.push(makeLabel('obj-yangiabad-uz12', 'uzbekistan', 'Янгиабад', 'Yangiabad', 'Янгиабад', 9731, 17391, { fontSize: 18 }));

// Koybak/Karuzak/Dzhumurtau/Buzaubay/Dungulpuk near Khiva-Urgench
restored.push(makeLabel('obj-koybak-uzk1', 'uzbekistan', 'Койбак', 'Koybak', 'Койбак', 8825, 16340));
restored.push(makeLabel('obj-karuzak-uzk2', 'uzbekistan', 'Карузак', 'Karuzak', 'Карузак', 8860, 16400, { labelDx: 16, labelDy: 14 }));
restored.push(makeLabel('obj-djumurtau-uzk3', 'uzbekistan', 'Джумуртау', 'Dzhumurtau', 'Джумуртау', 8795, 16455, { labelDx: -90, labelDy: -6, labelAnchor: 'end' }));
restored.push(makeLabel('obj-buzaubay-uzk7', 'uzbekistan', 'Бузаубай', 'Buzaubay', 'Бұзаубай', 9347, 16580));
restored.push(makeLabel('obj-dungulpuk-uzk8', 'uzbekistan', 'Дунгулпюк', 'Dungulpuk', 'Дунгулпюк', 9223, 16610));

// Combos - restored via the same circular split used originally, will be re-projected onto the real line below
restored = restored.concat(splitCombo('obj-miskin-combo-uz1', 'uzbekistan', ['Турткуль', 'Мискин', 'Бургутли'], 9080, 16592));
restored = restored.concat(splitCombo('obj-hazarsp-combo-uz2', 'uzbekistan', ['Хазарасп', 'Истикол', 'Питнак'], 8926, 16758));
restored = restored.concat(splitCombo('obj-bukhara2-uz14', 'uzbekistan', ['Бухара II', 'Кызылтепа', 'Кулюмазар'], 9923, 17317, { color: '#60BB46' }));
restored = restored.concat(splitCombo('obj-bukhara1-uz15', 'uzbekistan', ['Бухара I', 'Пролетарабад'], 10022, 17470, { color: '#60BB46' }));
restored = restored.concat(splitCombo('obj-angren-corridor-uz16', 'uzbekistan', [
  'Ангрен', 'Темирюлобод', 'Кошминар', 'Пап', 'Чует', 'Хужанд', 'Туракурган', 'Расутан', 'Наманган', 'Чартак',
  'Уйчи', 'Учкурган', 'Ханкулабад', 'Пайтуг', 'Бувайда', 'Шахрихан', 'Ахунбабаева', 'Маргилан', 'Кува', 'Ассаке', 'Андижан I', 'Грунчмазар'
], 12020, 17082));
restored = restored.concat(splitCombo('obj-shavat-combo-uzk6', 'uzbekistan', ['Шават', 'Ханка', 'Багат', 'Эль-Икала', 'Беруни'], 8930, 16490));
restored = restored.concat(splitCombo('obj-malik-combo-uzk9', 'uzbekistan', ['Малик', 'Бинокор'], 10123, 17386));
restored = restored.concat(splitCombo('obj-yakatut-combo-uzk10', 'uzbekistan', ['Якатут', 'Мургак'], 9822, 17519));
restored = restored.concat(splitCombo('obj-khodjadavlet-combo-uzk11', 'uzbekistan', ['Ходжадавлет', 'Алат', 'Каракуль'], 9651, 17526));
restored = restored.concat(splitCombo('obj-karaulbazar-combo-uzk12', 'uzbekistan', ['Караулбазар'], 9972, 17588));
restored = restored.concat(splitCombo('obj-akhangaran-combo-uzk13', 'uzbekistan', ['Ахангаран', 'Карахтай', 'Бахыт', 'Акалтын'], 11530, 17200));
restored = restored.concat(splitCombo('obj-tentaksay-combo-uzk14', 'uzbekistan', ['Тентаксай', 'Андижан II'], 12420, 17015));

data.projects.push(...restored);
fs.writeFileSync(path, JSON.stringify(data, null, 2));
console.log('restored', restored.length, 'Uzbekistan labels. total projects:', data.projects.length);
