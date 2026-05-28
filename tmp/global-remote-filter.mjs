/**
 * Strict filter: from existing candidates, pick ONLY truly global-remote roles
 * (no geographic restriction → Indonesia-friendly).
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';

if (!existsSync('tmp/candidates.json')) {
  console.error('Run tmp/prefilter.mjs first.');
  process.exit(1);
}
const cands = JSON.parse(readFileSync('tmp/candidates.json', 'utf-8'));

// GLOBAL-OK location keywords (substring, case-insensitive)
const TRULY_GLOBAL = /\b(anywhere|worldwide|global|remote.{0,20}global|remote.?first|fully remote|any timezone|any time zone|async.{0,20}friendly|distributed|wherever|no time zone|location.?independent|remote.?only)\b/i;

// GEO-RESTRICTED location keywords (excludes truly-global match)
const GEO_PATTERNS = [
  /remote\s*\(\s*(united states|us|us only|north america|na|emea|europe|eu only|uk only|canada|americas|united kingdom)\s*\)/i,
  /\bnam(er)?\b/i,
  /\bamer\b/i,
  /us\s*&\s*canada/i,
  /us\s*\/\s*canada/i,
  /US-based|US based/i,
  /EU-based|EU based/i,
  /UK-based|UK based/i,
];
const isGeoRestricted = (s) => GEO_PATTERNS.some(re => re.test(s));

// JD-content restrictions that imply geo lock
const JD_GEO_LOCK = /(must (be|reside|live|be located) (in|within) (the )?(US|United States|UK|United Kingdom|EU|EEA|EMEA|Europe|Canada|North America|NA|Australia|Singapore|India|Japan|Brazil)|(only|exclusively) (hire|employ|considering|recruiting) (in|from|within) (the )?(US|UK|EU|EMEA|EEA|Canada|North America|Singapore|India|Japan)|US (only|residents)|EU (only|residents)|UK (only|residents)|valid work authorization in (the )?(US|UK|EU|Canada|United States|United Kingdom)|right to work in (the )?(US|UK|EU|Canada|United States|United Kingdom|Australia|Singapore)|legal (right|authorization) to work in (the )?(US|UK|EU)|live within (the |a )(US|UK|EU|EMEA|Europe|North America|NA|Australia|Canada|EEA|Singapore|Japan|India))/i;

// "Timezone-friendly to Asia" hints (good signal)
const ASIA_FRIENDLY = /(asia|asia-pacific|apac|jakarta|bangkok|singapore|tokyo|seoul|kuala lumpur|hong kong|sydney|melbourne|all time zones|across time zones|distributed across|async|any timezone|any time zone|UTC[+-])/i;

// City/country names that, if present in location, indicate the role is tied to that place
const CITY_OR_COUNTRY = /\b(London|Berlin|Munich|Hamburg|Paris|Lyon|Marseille|Amsterdam|Rotterdam|Madrid|Barcelona|Lisbon|Porto|Stockholm|Copenhagen|Helsinki|Oslo|Warsaw|Prague|Vienna|Zurich|Geneva|Dublin|Belfast|Edinburgh|Manchester|Cambridge|Birmingham|Athens|Brussels|Heidelberg|Frankfurt|Tampere|Bandung|Jakarta|Bangkok|Tokyo|Seoul|Singapore|Sydney|Melbourne|Toronto|Vancouver|Montreal|New York|San Francisco|Mountain View|Palo Alto|Sunnyvale|Seattle|Boston|Chicago|Austin|Washington|Atlanta|Los Angeles|São Paulo|Rio de Janeiro|Mexico City|Dubai|Tel Aviv|Bangalore|Bengaluru|Mumbai|Hyderabad|Belgrade|Casablanca|Istanbul|Buenos Aires|Santiago|Lima)\b|(United States|United Kingdom|Germany|France|Italy|Spain|Sweden|Denmark|Finland|Norway|Poland|Czechia|Czech Republic|Austria|Switzerland|Ireland|Greece|Belgium|Netherlands|Portugal|Greece|Indonesia|Thailand|Japan|Korea|South Korea|Singapore|Australia|Canada|Brazil|Mexico|UAE|Israel|India|Serbia|Morocco|Turkey|Argentina|Chile|Peru)/i;

function passLocation(e) {
  const allLoc = [e.jd.location, ...(e.jd.secondaryLocations || []).map(s => s.location || '')].join(' ');
  // Reject if has any city/country name (means tied to a place)
  if (CITY_OR_COUNTRY.test(allLoc)) return false;
  // Reject restricted regions
  if (isGeoRestricted(allLoc)) return false;
  // Reject if JD content locks to a country
  if (JD_GEO_LOCK.test((e.jd.descriptionPlain || '').slice(0, 4000))) return false;
  // Accept only if location explicitly says global/anywhere/worldwide/etc.
  if (TRULY_GLOBAL.test(allLoc)) return true;
  // OR bare "Remote" + isRemote=true AND JD body indicates global hiring
  const isBareRemote = /^(remote|fully remote)$/i.test(allLoc.trim());
  if (isBareRemote && e.jd.isRemote) {
    const jdBody = (e.jd.descriptionPlain || '').slice(0, 6000);
    if (TRULY_GLOBAL.test(jdBody)) return true;
  }
  return false;
}

const survivors = cands.filter(passLocation);

// Sort by Asia-friendliness signal (more matches in JD = more async-ready)
function asiaSignal(e) {
  const text = (e.jd.descriptionPlain || '').slice(0, 5000);
  const matches = text.match(new RegExp(ASIA_FRIENDLY, 'gi')) || [];
  return matches.length;
}

survivors.sort((a, b) => asiaSignal(b) - asiaSignal(a));

writeFileSync('tmp/global-remote.json', JSON.stringify(survivors, null, 2));

console.log(`Started with ${cands.length} candidates.`);
console.log(`After strict global-remote filter: ${survivors.length}\n`);
console.log('TOP 20 (sorted by async/Asia-friendly signal):\n');
survivors.slice(0, 20).forEach((e, i) => {
  const loc = (e.jd.location || '(no loc)').padEnd(36);
  const asia = asiaSignal(e);
  console.log(`${String(i + 1).padStart(2)}. [${String(asia).padStart(2)}] ${e.company.padEnd(18)} ${e.title.padEnd(55)} ${loc}`);
});
