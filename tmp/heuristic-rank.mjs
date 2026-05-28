/**
 * Heuristic ranker for Nauval's profile. Reads tmp/candidates.json,
 * scores each by keyword density + signal weighting, outputs top-ranked list.
 */
import { readFileSync, writeFileSync } from 'fs';

const cands = JSON.parse(readFileSync('tmp/candidates.json', 'utf8'));

// Positive signals (weight = relevance to Nauval's profile)
const POS = [
  [/\bdata scientist\b/i, 8],
  [/\bdata engineer\b/i, 5],
  [/\banalytics engineer\b/i, 5],
  [/\b(machine learning|ML)\b/i, 5],
  [/\bNLP\b|\bnatural language\b/i, 5],
  [/\bLLM\b|\blarge language model\b/i, 4],
  [/\b(credit|fintech|lending|banking|finserv)\b/i, 6],         // Bank Muamalat
  [/\b(A\/B test|experimentation|hypothesis test)\b/i, 5],      // Syncwell
  [/\bcausal\b/i, 4],
  [/\battribution\b/i, 5],                                       // PCOS
  [/\b(segmentation|cluster)\b/i, 4],                            // Muamalat
  [/\b(churn|retention|expansion)\b/i, 4],
  [/\b(intent scoring|lead scoring|customer health)\b/i, 5],
  [/\bcommercial\b/i, 4],
  [/\b(marketing|growth|GTM|RevOps)\b/i, 4],                    // Syncwell
  [/\bproduction\b/i, 3],
  [/\bstakeholder|client-facing|cross-functional\b/i, 3],
  [/\bPython\b/i, 2],
  [/\bSQL\b/i, 2],
  [/\bAWS\b|\bSageMaker\b/i, 3],
  [/\bPySpark|\bSpark\b/i, 4],
  [/\bBayesian|\bstatistics\b/i, 3],
  [/\bsenior\b/i, 3],
  [/\bremote\b/i, 3],
  [/\b(europe|EU|EMEA|UK|United Kingdom)\b/i, 3],
  [/\b(model governance|regulatory|compliance)\b/i, 4],          // Muamalat
  [/\b(forecasting|time series)\b/i, 3],
];

// Negative signals (penalize misfits)
const NEG = [
  [/\b(computer vision|CV\/ML|image|video|3D)\b/i, -3],
  [/\b(autonomous|AV|self-driving|robotics)\b/i, -4],
  [/\b(embedded|firmware|hardware|FPGA|chip|silicon)\b/i, -5],
  [/\bPhD (required|preferred|essential)\b/i, -3],
  [/\b(10\+\s*years|15\+\s*years|extensive industry)\b/i, -3],
  [/\b(reinforcement learning|RLHF|RL)\b/i, -2],                 // not Nauval's edge
  [/\b(speech|audio|voice|TTS|ASR)\b/i, -3],
  [/\b(quantitative trading|hedge fund|prop trading)\b/i, -2],
  [/\b(staff\s+engineer|principal engineer)\b/i, -2],            // too senior IC
  [/\b(infrastructure|platform engineering|distributed systems)\b/i, -2],
  [/\b(go|golang|rust|c\+\+|scala)\s+programming/i, -3],
  [/\b(security clearance|polygraph)\b/i, -10],
];

function scoreEntry(e) {
  const text = `${e.title} ${e.jd.descriptionPlain || ''}`;
  let score = 0;
  const hits = [];
  for (const [re, w] of POS) {
    const m = text.match(re);
    if (m) { score += w; hits.push(`+${w} ${re.source.replace(/\\b/g, '')}`); }
  }
  for (const [re, w] of NEG) {
    const m = text.match(re);
    if (m) { score += w; hits.push(`${w} ${re.source.replace(/\\b/g, '')}`); }
  }
  // Location bonus
  const loc = (e.jd.location + ' ' + (e.jd.secondaryLocations || []).map(s => s.location).join(' ')).toLowerCase();
  if (/europe|emea/.test(loc)) score += 4;
  if (/remote/.test(loc) || e.jd.isRemote) score += 3;
  if (/united kingdom|london|england/.test(loc)) score += 3;
  if (/anywhere|worldwide|global/.test(loc)) score += 4;
  // Title-level title bonus
  if (/\bsenior\s+data\s+scientist\b/i.test(e.title)) score += 5;
  if (/\bsenior\s+(machine learning|ML)\s+(engineer|scientist)\b/i.test(e.title)) score += 4;
  if (/\bdata scientist\b/i.test(e.title) && !/^(staff|principal|head)/i.test(e.title)) score += 3;
  return { score, hits };
}

const ranked = cands.map(e => ({ ...e, ...scoreEntry(e) }))
  .sort((a, b) => b.score - a.score);

writeFileSync('tmp/ranked.json', JSON.stringify(ranked, null, 2));

console.log(`Ranked ${ranked.length} candidates.\n`);
console.log('TOP 30 by heuristic score:\n');
ranked.slice(0, 30).forEach((e, i) => {
  const loc = e.jd.location || '(no loc)';
  console.log(`${String(i+1).padStart(2)}. [${String(e.score).padStart(3)}] ${e.company.padEnd(18)} ${e.title.padEnd(60)} ${loc}`);
});

console.log(`\n📊 Score distribution:`);
console.log(`  >= 40 (likely A): ${ranked.filter(r => r.score >= 40).length}`);
console.log(`  35-39 (likely A-): ${ranked.filter(r => r.score >= 35 && r.score < 40).length}`);
console.log(`  28-34 (likely B+): ${ranked.filter(r => r.score >= 28 && r.score < 35).length}`);
console.log(`  22-27 (likely B):  ${ranked.filter(r => r.score >= 22 && r.score < 28).length}`);
console.log(`  15-21 (likely B-): ${ranked.filter(r => r.score >= 15 && r.score < 22).length}`);
console.log(`  < 15 (likely C+):  ${ranked.filter(r => r.score < 15).length}`);
