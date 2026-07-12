const fs = require('fs');
const path = 'assets/map.svg';
let svg = fs.readFileSync(path, 'utf8');

function hideById(id) {
  const re = new RegExp('id="' + id + '"(?! display)');
  const before = svg;
  svg = svg.replace(re, 'id="' + id + '" display="none"');
  if (svg === before) console.warn('NOT FOUND / already done:', id);
}

function hideByUniquePoints(points) {
  const before = svg;
  svg = svg.replace('points="' + points + '"', 'points="' + points + '" display="none"');
  if (svg === before) console.warn('NOT FOUND points:', points);
}

const ids = JSON.parse(fs.readFileSync('.scratch/ids_to_hide.json', 'utf8'));
ids.forEach(hideById);

const pointsList = JSON.parse(fs.readFileSync('.scratch/points_to_hide.json', 'utf8'));
pointsList.forEach(hideByUniquePoints);

fs.writeFileSync(path, svg);
console.log('done');
