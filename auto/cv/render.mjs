/**
 * CV + Cover Letter rendering.
 *
 * Takes profile + tailoring directives → returns full HTML.
 * If LLM available, uses it to produce tailoring directives. Otherwise uses
 * heuristic defaults (top JD keywords pulled, summary mildly tweaked, all
 * jobs kept verbatim from profile).
 */
import { readFileSync } from 'fs';
import { complete, isBaseline } from '../ai/client.mjs';
import { SYSTEM_JOB_AGENT, tailorCvPrompt, tailorClPrompt } from '../ai/prompts.mjs';

const BASE_CV_PROFILE = {
  jobs: [
    {
      company: 'Public Works & Spatial Planning Dept. (PUTR)',
      role: 'Data Scientist & Project Manager',
      period: 'Sep 2022 – Present',
      location: 'Bandung, Indonesia (hybrid)',
      bullets_default: [
        "Owned end-to-end data products from problem definition with non-technical stakeholders through deployed pipelines.",
        "Designed and deployed automated ETL pipelines (Python, PySpark, AWS) replacing manual data entry across multiple bureaus — <strong>45% faster delivery</strong> and <strong>20% data efficiency gain</strong>.",
        "Embedded model governance, audit trails, and reproducibility standards into government data workflows — production mindset under regulatory scrutiny.",
        "Translated ambiguous policy questions into measurable Power BI dashboards used by senior leadership.",
      ],
    },
    {
      company: 'Syncwell',
      role: 'Marketing Data Scientist (Contract)',
      period: 'Jul 2024 – Sep 2024',
      location: 'Birmingham, UK (remote)',
      bullets_default: [
        "Built predictive ML models for customer engagement and campaign targeting; designed and ran A/B tests to validate uplift before scaling.",
        "Implemented automated campaign trigger logic; delivered <strong>+40% CTR</strong> and <strong>+22% follower growth</strong> on owned channels.",
        "Partnered with marketing/sales stakeholders to translate fuzzy commercial questions into measurable model targets.",
        "Stack: Python, SQL, Tableau, Salesforce.",
      ],
    },
    {
      company: 'PCOS Challenge',
      role: 'Strategic Data Scientist Specialist (Contract)',
      period: 'Jun 2024 – Aug 2024',
      location: 'Birmingham, UK (remote)',
      bullets_default: [
        "Developed <strong>customer attribution model</strong> linking donor touchpoints to conversions — output integrated into reporting dashboards.",
        "Automated report extraction pipeline — <strong>80% reduction in manual workload</strong>.",
        "Stack: Python, Streamlit, Power BI, PySpark, Hadoop.",
      ],
    },
    {
      company: 'Bank Muamalat Indonesia',
      role: 'Lead Data Scientist (Leadership Development Program)',
      period: 'Nov 2019 – Aug 2022',
      location: 'Jakarta, Indonesia',
      bullets_default: [
        "Built and deployed <strong>NLP credit-analysis models</strong> on Sharia-compliant lending — performance monitoring, retraining, and regulatory-grade documentation.",
        "Designed market segmentation clustering models and ran A/B testing programme across digital channels.",
        "Delivered <strong>+5.3% investment return</strong> on AI-recommended portfolio adjustments.",
        "Stack: AWS, NLP, SQL, PySpark, Docker, NoSQL.",
      ],
    },
  ],
  projects: [
    { name: 'CV-Job Description Suitability Checker', desc: 'End-to-end ML pipeline using DeBERTa-v3 with RAG retrieval; reasons over CV vs. JD semantics rather than keyword match. Outperforms traditional ATS benchmarks on a curated test set.', tech: 'DeBERTa, RAG, Python, NLP — github.com/NauvalZulfikar' },
    { name: 'Machine Scheduler Automation', desc: 'Streamlit-based production scheduling system with interactive Gantt charts and real-time utilisation dashboards. Optimised production planning by 63%.', tech: 'Python, Streamlit, workflow orchestration' },
    { name: 'Sport Footwear Sales Prediction', desc: 'Comparative analysis of ML models for sales forecasting (published Jan 2025).', tech: 'ML, forecasting, Python' },
  ],
  education: [
    { title: 'MSc Business Analytics — 1:1 First Class', org: 'Aston University', year: '2023 – 2024 · Birmingham, UK', desc: 'Full-tuition Aston Enterprise Scholarship 2023; Pitching Contest 2024 runner-up. Distinctions in Effective Management Consultancy, Decision Models, Software Analytics.' },
    { title: 'BBA Innovation & Economics', org: 'Ritsumeikan Asia Pacific University', year: '2016 – 2019 · Beppu, Japan', desc: 'APU 50% Tuition Reduction Scholarship + JASSO Scholarship. Distinctions in Business Data Analysis, Consumer Behaviour, Marketing Research.' },
  ],
  default_competencies: [
    'Production ML & Monitoring', 'NLP / LLM', 'A/B Testing & Experimentation', 'Causal Inference',
    'Customer Segmentation', 'Credit Risk Modelling', 'Python & SQL', 'PySpark & AWS',
    'Stakeholder Communication', 'End-to-End Ownership', 'Model Governance', 'Agile Delivery',
  ],
  default_skills: {
    'AI / ML': 'Machine Learning, NLP, LLM, RAG, DeBERTa, PyTorch, Bayesian Statistics, Time Series, Fraud Detection, Credit Risk, Causal Inference, A/B Testing',
    'Data & Infra': 'Python, SQL, PySpark, AWS, Docker, ETL Pipelines, NoSQL, Hadoop (transferable to Snowflake / dbt / Airflow)',
    'Analytics & Viz': 'Power BI, Tableau, Streamlit, Salesforce',
    'Delivery': 'Stakeholder communication, model governance, regulatory compliance, autonomy-first delivery',
    'Languages': 'English (UK MSc, professional fluency), Indonesian (native), Japanese (basic)',
  },
};

function defaultDirectives(jobMeta) {
  return {
    summary_text: `Senior Data Scientist with 5+ years building production ML end-to-end across regulated banking, government, and remote UK contracts. Delivered measurable commercial impact: +5.3% investment return at Bank Muamalat (NLP credit), +40% CTR at Syncwell (UK marketing), 80% manual-workload reduction at PCOS Challenge (UK attribution). MSc Business Analytics, 1:1 First Class, Aston University. Python, SQL, AWS, PySpark, NLP/LLM, A/B testing, production-grade monitoring.`,
    competencies: BASE_CV_PROFILE.default_competencies,
    job_bullet_overrides: {},
    selected_projects: ['CV-Job Description Suitability Checker', 'Machine Scheduler Automation', 'Sport Footwear Sales Prediction'],
    skills_categories: BASE_CV_PROFILE.default_skills,
  };
}

export async function tailorCv(profile, jobMeta) {
  if (isBaseline()) return defaultDirectives(jobMeta);
  try {
    const directives = await complete({
      system: SYSTEM_JOB_AGENT,
      prompt: tailorCvPrompt(profile, jobMeta.jdText, jobMeta),
      json: true,
      maxTokens: 3000,
    });
    if (directives.__parseError || directives.__baseline) return defaultDirectives(jobMeta);
    // Sanity: merge with defaults so missing keys don't break render
    return { ...defaultDirectives(jobMeta), ...directives };
  } catch (e) {
    console.log(`  ⚠ CV LLM tailor failed (${e.message}) — using baseline`);
    return defaultDirectives(jobMeta);
  }
}

export async function tailorCl(profile, jobMeta) {
  if (isBaseline()) {
    return defaultClBody(profile, jobMeta);
  }
  try {
    const html = await complete({
      system: SYSTEM_JOB_AGENT,
      prompt: tailorClPrompt(profile, jobMeta.jdText, jobMeta),
      json: false,
      maxTokens: 2500,
    });
    if (typeof html === 'object' && html.__baseline) return defaultClBody(profile, jobMeta);
    return html;
  } catch (e) {
    console.log(`  ⚠ CL LLM gen failed (${e.message}) — using baseline`);
    return defaultClBody(profile, jobMeta);
  }
}

function defaultClBody(profile, jobMeta) {
  return `
<p>I'm applying for the <strong>${escape(jobMeta.title)}</strong> role at ${escape(jobMeta.company)}. The combination of end-to-end data science ownership, commercial focus, and a high-autonomy environment maps directly to the way I've worked over the past five years.</p>

<p>Three proof points that map to the role:</p>

<p><strong>Marketing &amp; commercial DS (Syncwell, UK, 2024).</strong> Built predictive models for engagement and campaign targeting; ran A/B tests to validate uplift; shipped automated trigger logic that drove <strong>+40% click-through</strong> and <strong>+22% follower growth</strong>.</p>

<p><strong>Production ML under scrutiny (Bank Muamalat, 2019–2022).</strong> Led NLP credit-analysis and market-segmentation models in production: monitoring, retraining, drift detection, compliance documentation. Portfolio adjustments delivered <strong>+5.3% investment return</strong>.</p>

<p><strong>Attribution &amp; automation (PCOS Challenge, UK, 2024).</strong> Developed customer-attribution model linking donor touchpoints to conversions; automated reporting pipeline cut manual workload by <strong>80%</strong>.</p>

<p>On location: I'm based in Milan with EU work rights and a UK Graduate Visa from my MSc at Aston (1:1 First Class), so I can work across UK and EU without sponsorship complexity.</p>

<p>I'd love to talk about which problems are highest priority on the team right now and where a strong end-to-end data scientist can move the needle in the next two quarters.</p>
`;
}

function escape(s) { return String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

const CV_TEMPLATE = readFileSync(new URL('./cv-template.html', import.meta.url), 'utf-8');
const CL_TEMPLATE = readFileSync(new URL('./cl-template.html', import.meta.url), 'utf-8');

export function renderCvHtml(profile, directives) {
  const c = profile.candidate;
  const competencies = (directives.competencies || []).map(t => `<span class="competency-tag">${escape(t)}</span>`).join('\n      ');
  const jobs = BASE_CV_PROFILE.jobs.map(j => {
    const bullets = directives.job_bullet_overrides?.[j.company] || j.bullets_default;
    return `
    <div class="job">
      <div class="job-header">
        <span class="job-company">${escape(j.company)}</span>
        <span class="job-period">${escape(j.period)}</span>
      </div>
      <div class="job-role">${escape(j.role)} <span class="job-location"> · ${escape(j.location)}</span></div>
      <ul>${bullets.map(b => `<li>${b}</li>`).join('')}</ul>
    </div>`;
  }).join('\n');
  const projects = (directives.selected_projects || []).map(name => {
    const p = BASE_CV_PROFILE.projects.find(x => x.name === name);
    if (!p) return '';
    return `
    <div class="project">
      <div class="project-title">${escape(p.name)}</div>
      <div class="project-desc">${escape(p.desc)}</div>
      <div class="project-tech">${escape(p.tech)}</div>
    </div>`;
  }).join('\n');
  const education = BASE_CV_PROFILE.education.map(e => `
    <div class="edu-item">
      <div class="edu-header">
        <span class="edu-title">${escape(e.title)} · <span class="edu-org">${escape(e.org)}</span></span>
        <span class="edu-year">${escape(e.year)}</span>
      </div>
      <div class="edu-desc">${escape(e.desc)}</div>
    </div>`).join('\n');
  const skills = Object.entries(directives.skills_categories || BASE_CV_PROFILE.default_skills)
    .map(([cat, val]) => `<div class="skill-row"><span class="skill-category">${escape(cat)}:</span> ${escape(val)}</div>`).join('\n');

  return CV_TEMPLATE
    .replaceAll('{{NAME}}', escape(c.full_name))
    .replaceAll('{{EMAIL}}', escape(c.email))
    .replaceAll('{{LINKEDIN_URL}}', escape(c.linkedin))
    .replaceAll('{{LINKEDIN_DISPLAY}}', escape(c.linkedin.replace(/^https?:\/\//, '')))
    .replaceAll('{{PORTFOLIO_URL}}', escape(c.portfolio_url))
    .replaceAll('{{PORTFOLIO_DISPLAY}}', escape(c.portfolio_url.replace(/^https?:\/\//, '')))
    .replaceAll('{{GITHUB_URL}}', escape(c.github))
    .replaceAll('{{GITHUB_DISPLAY}}', escape(c.github.replace(/^https?:\/\//, '')))
    .replaceAll('{{LOCATION}}', escape(`${c.address} (EU work rights + UK Graduate Visa)`))
    .replaceAll('{{SUMMARY_TEXT}}', directives.summary_text)
    .replaceAll('{{COMPETENCIES}}', competencies)
    .replaceAll('{{EXPERIENCE}}', jobs)
    .replaceAll('{{PROJECTS}}', projects)
    .replaceAll('{{EDUCATION}}', education)
    .replaceAll('{{SKILLS}}', skills);
}

export function renderClHtml(profile, jobMeta, body) {
  const c = profile.candidate;
  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return CL_TEMPLATE
    .replaceAll('{{NAME}}', escape(c.full_name))
    .replaceAll('{{EMAIL}}', escape(c.email))
    .replaceAll('{{LINKEDIN_URL}}', escape(c.linkedin))
    .replaceAll('{{LINKEDIN_DISPLAY}}', escape(c.linkedin.replace(/^https?:\/\//, '')))
    .replaceAll('{{PORTFOLIO_URL}}', escape(c.portfolio_url))
    .replaceAll('{{PORTFOLIO_DISPLAY}}', escape(c.portfolio_url.replace(/^https?:\/\//, '')))
    .replaceAll('{{ADDRESS}}', escape(c.address))
    .replaceAll('{{DATE}}', today)
    .replaceAll('{{COMPANY}}', escape(jobMeta.company))
    .replaceAll('{{TITLE}}', escape(jobMeta.title))
    .replaceAll('{{LOCATION}}', escape(jobMeta.location || ''))
    .replaceAll('{{DEPARTMENT}}', escape(jobMeta.department || 'Hiring Team'))
    .replaceAll('{{BODY}}', body);
}

export { BASE_CV_PROFILE };
