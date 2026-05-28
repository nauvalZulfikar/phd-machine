import { searchLinkedIn } from '../auto/sources/linkedin.mjs';

const QUERIES = [
  { keywords: 'Senior Data Scientist', location: 'Indonesia', remote: 'remote' },
  { keywords: 'Machine Learning Engineer', location: 'Indonesia', remote: 'remote' },
  { keywords: 'Data Scientist', location: 'Worldwide', remote: 'remote' },
  { keywords: 'Data Scientist', location: 'Singapore', remote: 'remote' },
];

for (const q of QUERIES) {
  console.log(`\n━━━ ${q.keywords} | ${q.location} | ${q.remote} ━━━`);
  const jobs = await searchLinkedIn({ ...q, limit: 25, timeFilter: 'r2592000', experience: '4,5,6' });
  console.log(`  ${jobs.length} jobs`);
  jobs.slice(0, 8).forEach((j, i) => {
    console.log(`  ${i + 1}. ${j.title.slice(0, 50).padEnd(52)} | ${j.company.slice(0, 24).padEnd(26)} | ${j.location.slice(0, 30)}`);
  });
}
