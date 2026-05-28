/**
 * Filter LinkedIn jobs for Indonesia/Bandung-friendly senior data roles.
 * Score each by Nauval-profile fit + remote signal.
 */
import { readFileSync, writeFileSync } from 'fs';

const all = JSON.parse(readFileSync('tmp/linkedin-jobs.json', 'utf-8'));

// Keep only Indonesia-located jobs
const indo = all.filter(j => /Indonesia|Jakarta|Bandung|Surabaya|Bali|Tangerang|Bekasi|Yogyakarta|West Java|Banten/i.test(j.location));

// --- TITLE FILTERS ---
const TITLE_REJECT = /\b(Junior|Intern|Apprentice|Graduate Program|Trainee|Associate (?!Manager|Director))\b/i;
const TITLE_DATA = /\b(Data Scientist|Data Analyst|Data Engineer|Machine Learning|ML Engineer|AI Engineer|AI\/ML|NLP|MLOps|Applied (Scientist|AI)|Research Engineer|Decision Scientist|Analytics Engineer|Data Science|Quantitative)\b/i;
const TITLE_SOFTWARE = /\b(Software Engineer|Backend Engineer|Platform Engineer|Python|Go Engineer)\b/i;

// --- SCORING ---
function score(j) {
  const title = j.title;
  const loc = j.location;
  let s = 0;
  const hits = [];

  // Title type
  if (TITLE_REJECT.test(title)) return { s: -100, hits: ['REJECT: junior/intern'] };
  if (TITLE_DATA.test(title)) { s += 30; hits.push('+30 data role'); }
  else if (TITLE_SOFTWARE.test(title)) { s += 10; hits.push('+10 software (adjacent)'); }
  else { s -= 20; hits.push('-20 not data/sw'); }

  // Seniority
  if (/\b(Senior|Sr\.?|Lead|Staff|Principal|Head)\b/i.test(title)) { s += 15; hits.push('+15 senior'); }
  if (/\bManager\b|\bDirector\b/i.test(title)) { s += 10; hits.push('+10 manager+'); }

  // Domain bonus matching Nauval's background
  if (/\b(NLP|LLM|GenAI|RAG)\b/i.test(title)) { s += 15; hits.push('+15 NLP/LLM'); }
  if (/\b(Banking|Fintech|Credit|Risk|Finance)\b/i.test(title)) { s += 12; hits.push('+12 fintech/banking'); }
  if (/\b(Marketing|Growth|Commercial|GTM|RevOps)\b/i.test(title)) { s += 10; hits.push('+10 marketing/commercial'); }

  // Location bonus: Jakarta = capital tech hub; Bali/Yogya = often remote/lifestyle
  if (/Jakarta/i.test(loc)) { s += 5; hits.push('+5 Jakarta'); }
  if (/Bandung/i.test(loc)) { s += 20; hits.push('+20 Bandung (Nauval lives)'); }
  if (/Bali|Yogyakarta/i.test(loc)) { s += 3; hits.push('+3 Bali/Yogya'); }

  // Company quality signal (well-known players)
  const co = j.company;
  if (/\b(Kredivo|Krom|tiket|Bibit|Flip|Cove|Speechify|Agoda|Xendit|Halodoc|Ruangguru|Tokopedia|GoTo|Gojek|Traveloka|Shopee|Lazada|Bukalapak|DANA|OVO|Pintu|Reku|Ajaib|Stockbit|Pluang|Pasarpolis|Sayurbox|Carro|Carsome|Sea|Grab|Binance|Revolut|Wise)\b/i.test(co)) {
    s += 15; hits.push('+15 quality company');
  }

  // Recruiter agency flag (lower quality usually)
  if (/\b(Adecco|Glints|House of People|Acclime|Bernhard|Crossing Hurdles|Synapsis|Keywords Studios)\b/i.test(co)) {
    s -= 8; hits.push('-8 agency/recruiter');
  }

  // Remote signal from title or query metadata
  if (j._query?.remote === 'remote') { s += 8; hits.push('+8 remote query'); }
  if (j._query?.remote === 'hybrid') { s += 4; hits.push('+4 hybrid query'); }
  if (/Remote/i.test(title)) { s += 8; hits.push('+8 "remote" in title'); }

  return { s, hits };
}

const scored = indo.map(j => ({ ...j, score: score(j) })).filter(j => j.score.s > 0);
scored.sort((a, b) => b.score.s - a.score.s);

writeFileSync('tmp/indo-shortlist.json', JSON.stringify(scored, null, 2));

console.log(`\n🇮🇩 Indonesia LinkedIn jobs ranked for Nauval (${scored.length} after filter)\n`);

// Tier the output
const A = scored.filter(j => j.score.s >= 60);
const B = scored.filter(j => j.score.s >= 40 && j.score.s < 60);
const C = scored.filter(j => j.score.s >= 25 && j.score.s < 40);

function printTier(tier, name, color) {
  if (!tier.length) return;
  console.log(`\n${color} ━━━ TIER ${name} (${tier.length} jobs) ━━━`);
  tier.forEach((j, i) => {
    const co = j.company.length > 22 ? j.company.slice(0, 20) + '..' : j.company.padEnd(22);
    const t = j.title.length > 50 ? j.title.slice(0, 48) + '..' : j.title.padEnd(50);
    const loc = j.location.length > 32 ? j.location.slice(0, 30) + '..' : j.location;
    console.log(`${String(i + 1).padStart(2)}. [${String(j.score.s).padStart(3)}] ${t} | ${co} | ${loc}`);
  });
}

printTier(A, 'A — must apply', '🟢');
printTier(B, 'B — worth applying', '🟡');
printTier(C, 'C — consider if room', '⚪');

console.log(`\nFull JSON: tmp/indo-shortlist.json`);
