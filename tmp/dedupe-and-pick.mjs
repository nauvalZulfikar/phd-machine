import { readFileSync, writeFileSync } from 'fs';

const ranked = JSON.parse(readFileSync('tmp/ranked.json', 'utf8'));

// Drop already-applied (Synthesia Commercial DS)
const APPLIED_IDS = ['a40cbbc3-6be7-48a2-b8c7-1f09a1c5aa43'];
const notApplied = ranked.filter(e => !APPLIED_IDS.some(id => e.url.includes(id)));

// Dedup: keep highest-scored per (company, normalized-title)
function normTitle(t) {
  return t.toLowerCase()
    .replace(/[(,].*$/, '')           // drop " (Italian Speaking)" etc.
    .replace(/[ \-]+(I{1,3}|IV|V)\b/, '') // drop level suffixes "II" "III"
    .replace(/[^a-z]+/g, ' ')
    .trim();
}

const seen = new Map();
for (const e of notApplied) {
  const key = `${e.company}::${normTitle(e.title)}`;
  if (!seen.has(key)) seen.set(key, e);
}
const deduped = [...seen.values()].sort((a, b) => b.score - a.score);
console.log(`After dedup: ${deduped.length}`);

// Also drop US-only and Belgrade/Asia-only that slipped through location filter
const STRICT_US_OR_ASIA = /(^United States$|^USA$|^San Francisco|^New York|^Belgrade|^Singapore|^Tokyo|^Mountain View|^Palo Alto|^Sunnyvale)/i;
const usOrAsia = deduped.filter(e => STRICT_US_OR_ASIA.test(e.jd.location || ''));
const eligible = deduped.filter(e => !STRICT_US_OR_ASIA.test(e.jd.location || ''));
console.log(`Dropped US/Asia-only: ${usOrAsia.length}`);
console.log(`Final eligible pool: ${eligible.length}`);

// Above B threshold = score >= 22
const aboveB = eligible.filter(e => e.score >= 22);
console.log(`Above B threshold (score >= 22): ${aboveB.length}`);

writeFileSync('tmp/shortlist.json', JSON.stringify(aboveB, null, 2));

console.log('\nFINAL SHORTLIST (≥B):\n');
aboveB.forEach((e, i) => {
  const loc = (e.jd.location || '(no loc)').padEnd(40);
  const sc = e.score >= 40 ? 'A ' : e.score >= 35 ? 'A-' : e.score >= 28 ? 'B+' : 'B ';
  console.log(`${String(i+1).padStart(2)}. ${sc} [${String(e.score).padStart(3)}] ${e.company.padEnd(18)} ${e.title.padEnd(55)} ${loc}`);
});

console.log(`\n📊 Final by tier:`);
console.log(`  A : ${aboveB.filter(r => r.score >= 40).length}`);
console.log(`  A-: ${aboveB.filter(r => r.score >= 35 && r.score < 40).length}`);
console.log(`  B+: ${aboveB.filter(r => r.score >= 28 && r.score < 35).length}`);
console.log(`  B : ${aboveB.filter(r => r.score >= 22 && r.score < 28).length}`);
console.log(`  Total: ${aboveB.length}`);
