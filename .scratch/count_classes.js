const fs = require('fs');
const svg = fs.readFileSync('assets/map.svg', 'utf8');
const classes = process.argv.slice(2);
classes.forEach(c => {
  const re = new RegExp('class="' + c + '"', 'g');
  console.log(c, (svg.match(re) || []).length);
});
