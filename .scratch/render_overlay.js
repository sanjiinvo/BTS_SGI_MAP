const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');

const svgPath = 'assets/map.svg';
const raw = fs.readFileSync(svgPath, 'utf8');

// args: x y w h outW outFile boxesJsonFile
// boxesJsonFile: [{x,y,w,h,label}]
const args = process.argv.slice(2);
const [x, y, w, h, outW, outFile, boxesFile] = args;
const X=Number(x), Y=Number(y), W=Number(w), H=Number(h), OW=Number(outW);
const boxes = JSON.parse(fs.readFileSync(boxesFile, 'utf8'));

let overlay = '';
for (const b of boxes) {
  overlay += `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="none" stroke="red" stroke-width="4"/>`;
  overlay += `<text x="${b.x}" y="${b.y - 8}" font-size="34" fill="red" font-weight="bold">${b.label}</text>`;
}

let cropped = raw.replace(
  /<svg([^>]*)viewBox="[^"]*"([^>]*)>/,
  `<svg$1viewBox="${X} ${Y} ${W} ${H}"$2>`
);
cropped = cropped.replace('</svg>', overlay + '</svg>');

const outH = Math.round(OW * (H / W));
const r = new Resvg(cropped, { fitTo: { mode: 'width', value: OW } });
const png = r.render();
fs.writeFileSync(outFile, png.asPng());
console.log(outFile, 'done');
