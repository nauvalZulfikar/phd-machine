import { readFileSync, writeFileSync } from 'fs';

const shortlist = JSON.parse(readFileSync('tmp/shortlist.json', 'utf8'));

// Hard JD filters that slipped through (check description content)
const JD_HARD_BLOCK = [
  /\b(security clearance|SC clearance|UK SC|AI Safety|alignment)\b/i,
  /\bdefence\b/i,
  /\bUS Government\b/i,
  /\b(must be|requires?) (a |an )?US (citizen|resident)/i,
  /\beligibility for SC\b/i,
  /\b(India|Bangalore|Bengaluru|Mumbai|Hyderabad)\b/i,
  /\bNAMER\s*only\b/i,
  /\bRemote \(United States\)\b/i,
  /\bUS only\b/i,
];

// Title strict-block (still too senior or wrong type)
const TITLE_STRICT_BLOCK = /\b(Principal|Staff|Director|VP|Head of|Manager,|Architect|Software Engineer)\b/i;
const TITLE_RESEARCH_BLOCK = /\b(Research (Engineer|Scientist)|AI Researcher|Foundation Model|Pre[ -]Training|Pre[ -]training)\b/i;

let cleaned = shortlist.filter(e => {
  // Title checks
  if (TITLE_STRICT_BLOCK.test(e.title)) return false;
  if (TITLE_RESEARCH_BLOCK.test(e.title)) return false;
  // JD content
  const text = (e.jd.descriptionPlain || '').slice(0, 5000);
  for (const re of JD_HARD_BLOCK) {
    if (re.test(text) || re.test(e.jd.location || '')) return false;
  }
  return true;
});

console.log(`After strict cleanup: ${cleaned.length}`);

// Cap: max 2 per company (best-scoring two)
const byCo = new Map();
for (const e of cleaned) {
  if (!byCo.has(e.company)) byCo.set(e.company, []);
  byCo.get(e.company).push(e);
}
const capped = [];
for (const [, arr] of byCo) {
  arr.sort((a, b) => b.score - a.score);
  capped.push(...arr.slice(0, 2));
}
capped.sort((a, b) => b.score - a.score);

console.log(`After per-company cap (max 2): ${capped.length}\n`);

writeFileSync('tmp/batch.json', JSON.stringify(capped, null, 2));

console.log('FINAL BATCH for tailoring + apply:\n');
capped.forEach((e, i) => {
  const loc = (e.jd.location || '').padEnd(40);
  const sc = e.score >= 40 ? 'A ' : e.score >= 35 ? 'A-' : e.score >= 28 ? 'B+' : 'B ';
  console.log(`${String(i+1).padStart(2)}. ${sc} [${String(e.score).padStart(3)}] ${e.company.padEnd(18)} ${e.title.padEnd(55)} ${loc}`);
});
