const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');

const svgPath = 'assets/map.svg';
const raw = fs.readFileSync(svgPath, 'utf8');

function render(x, y, w, h, outW, outFile) {
  const outH = Math.round(outW * (h / w));
  const cropped = raw.replace(
    /<svg([^>]*)viewBox="[^"]*"([^>]*)>/,
    `<svg$1viewBox="${x} ${y} ${w} ${h}"$2>`
  );
  const r = new Resvg(cropped, { fitTo: { mode: 'width', value: outW } });
  const png = r.render();
  fs.writeFileSync(outFile, png.asPng());
  console.log(outFile, r.width, r.height);
}

const args = process.argv.slice(2);
const [x, y, w, h, outW, outFile] = args;
render(Number(x), Number(y), Number(w), Number(h), Number(outW), outFile);
