# Final Submission Checklist

Generated: 2026-05-22T10:56:21.490895Z by `tools/complete_forms.py`

Lists, per app, what's done autonomously vs what BLOCKS submission and requires you (Nauval) personally.

## Per-app status

### UKP Darmstadt  · `ukp-intertext`
**Deadline:** 31 May 2026

**Done (autonomous):**
- ✅ All docs merged into UKP_combined_application.pdf
- ✅ Form autofilled (10/16 fields)

**Blockers (need you):**
- ❌ Date of birth — gua butuh data lo
- ❌ Postal code Bandung — gua butuh data lo
- ❌ Gender — gua butuh data lo
- ❌ Full street address — gua butuh data lo
- ⚠️ Gender dropdown selection on portal
- ⚠️ ukpPosition dropdown — pilih 'InterText'
- 🚧 Eligibility risk: posting says 'PhD completed'. Email Iryna duluan.

### Copenhagen Mech Interp  · `copenhagen-mechinterp`
**Deadline:** 31 May 2026

**Done (autonomous):**
- ✅ CV, cover letter, project description ready

**Blockers (need you):**
- ❌ Bikin akun KU jobs portal (email verify)
- ❌ Login + upload semua PDF manual
- ❌ Publication list — tulis 'no publications yet, see github.com/nauvalZulfikar'

### Aarhus TTA  · `aarhus-tta`
**Deadline:** 1 Jun 2026

**Done (autonomous):**
- ✅ CV, cover letter, statement of interest ready

**Blockers (need you):**
- ❌ Bikin akun di au.dk Oracle HCM
- ❌ Login + upload semua PDF manual

### Chalmers  · `chalmers-agentic-monitoring`
**Deadline:** 12 Jun 2026

**Done (autonomous):**
- ✅ All 7 docs ready in app folder

**Blockers (need you):**
- ❌ Klik 'Apply on company website' di academicpositions
- ❌ Bikin akun Chalmers Varbi recruitment
- ❌ Login + upload manual

### PoliMi  · `polimi-pierri`
**Deadline:** TBD ~ Jun 2026

**Done (autonomous):**
- ✅ All docs ready

**Blockers (need you):**
- ⏸️ Call cycle 41 belom buka — tunggu Juni 2026
- 🚧 Email Pierri duluan (task #52)

### Cambridge LLM Safety  · `cambridge-llm-safety`
**Deadline:** 30 Jul 2026

**Done (autonomous):**
- ✅ Stage 1 docs: CV (2pp) + research proposal (2pp) ready

**Blockers (need you):**
- ❌ Login Google Forms dengan account lo
- ❌ Stage 2 (jika shortlisted): bayar £20 di Cambridge Graduate Portal

### Aalborg ⭐ ANCHOR  · `aalborg-llm-security`
**Deadline:** 31 Aug 2026

**Done (autonomous):**
- ✅ All 6 docs ready

**Blockers (need you):**
- ❌ Bikin akun AAU recruitment portal (stillinger.aau.dk)
- ❌ Login + upload manual

### Leiden  · `leiden-formal-nlp`
**Deadline:** 26 Jun 2026

**Done (autonomous):**
- ✅ All 8 docs ready including publication list + writing sample

**Blockers (need you):**
- ❌ Bikin akun Leiden careers portal
- ❌ Login + upload manual

### Tel Aviv  · `tel-aviv-cs`
**Deadline:** 31 May 2026

**Done (autonomous):**

**Blockers (need you):**
- 🚧 VPN required: en-exact-sciences.tau.ac.il diblokir di koneksi lo
- ❌ TAU 'Letter of Purpose' template — gak ketemu auto (gua coba 3 URL, semua gagal)
- ❌ TAU 'Application Form' template — gak ketemu auto
- ❌ Supervisor Consent Form — butuh Berant/Wolf tanda tangan (task #66 belum)
- 🚧 KIRIM EMAIL BERANT/WOLF DULUAN sebelum form filling

### Saarland  · `saarland-hahn`
**Deadline:** Rolling

**Done (autonomous):**
- ✅ CV + cover letter + transcripts ready

**Blockers (need you):**
- 🚧 No portal — kirim email ke michael.hahn@uni-saarland.de

### Tübingen  · `tubingen-andriushchenko`
**Deadline:** Rolling

**Done (autonomous):**
- ✅ All docs ready

**Blockers (need you):**
- 🚧 No portal — kirim email ke maksym.andriushchenko@uni-tuebingen.de

### Bar-Ilan Goldberg  · `bar-ilan-goldberg`
**Deadline:** Rolling

**Done (autonomous):**
- ✅ All docs ready

**Blockers (need you):**
- 🚧 VPN required (Israel domain diblokir)
- 🚧 No portal — kirim email ke yoav.goldberg@biu.ac.il

---

## What you (Nauval) need to do — bucket-organised

### 🔴 BLOCK 1 — Send 3 inquiry emails THIS WEEK (impact: convert risk gates)
- Email Iryna Gurevych (UKP) — `drafts/supervisor_inquiry_email.md` in ukp-intertext
- Email Jonathan Berant or Yoav Wolf (Tel Aviv) — drafts in tel-aviv-cs
- Email Francesco Pierri (PoliMi) — drafts in polimi-pierri

### 🟡 BLOCK 2 — Give me 4 PII items (unlocks UKP form completion)
```yaml
date_of_birth: "YYYY-MM-DD"
address_street: "Jl. ... No. XX, RT/RW, Kelurahan, Kecamatan"
address_postcode: "40XXX"
gender: "Male" | "Female" | "Diverse" | "Prefer not to say"
```

### 🟢 BLOCK 3 — Create 6 portal accounts (~15 min each)
- Aalborg AAU recruitment — https://www.stillinger.aau.dk/vis-stilling/?vacancy=1410023
- Copenhagen KU jobs — https://employment.ku.dk/phd/?show=160571
- Aarhus AU candidate — https://phd.tech.au.dk/
- Chalmers Varbi — link from academicpositions.com 'Apply on company website'
- Leiden careers — https://careers.universiteitleiden.nl/
- Cambridge Google Form — login with Gmail

### 🟣 BLOCK 4 — VPN for Israel apps
- Aktifin VPN apa aja (ProtonVPN free / Surfshark)
- Buka Tel Aviv + Bar-Ilan portal manual untuk download TAU form templates

---

## Honest assessment

**Autonomous filling tidak mungkin tuntas** untuk 11 dari 12 portal karena:
1. **Account creation walls** (6 portals) — CAPTCHA + email OTP, gak bisa diakal bot
2. **Email-only workflow** (3 portals: Saarland, Tübingen, Bar-Ilan) — lo personal yang harus kirim
3. **Israel DNS block** (Tel Aviv, Bar-Ilan) — butuh VPN dari lo
4. **Supervisor consent dependency** (Tel Aviv) — Berant/Wolf yang isi & tanda tangan, bukan gua

**Yang gua bisa kerjakan habis-habisan**: UKP — 10/16 fields autofilled + PDF merged. Tinggal kasih 4 PII items dari lo, gua finish + screenshot pre-submit state, lo klik Submit.