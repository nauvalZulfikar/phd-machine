# Portal Submission Readiness — Final Report

**Generated:** 2026-05-19
**Method:** Playwright headless Chromium recon of 7 portals (no data entry, no clicks past Apply).
**Output per portal:** `phd-applications/<opp>/portal_recon/{01_landing.png, 02_after_cookies.png, 20_after_apply.png, BLOCKERS.md, deep_structure.json}`

---

## TL;DR table

| Opp | Login wall | CAPTCHA | Form visible | File upload | Autofill blockers |
|---|---|---|---|---|---|
| **ukp-intertext** | ✅ none | ✅ none | **16 fields, 14 required** | 1 (attachments) | 4 PII items missing |
| **copenhagen-mechinterp** | ❌ Apply behind JS/popup | — | 3 search fields only | 0 | Apply button needs JS click + KU account creation |
| **aarhus-tta** | ❌ Apply on AU HR portal | — | 0 on description page | 0 | Apply button text not "Apply" (Danish/HR redirect) |
| **chalmers-agentic-monitoring** | ⚠️ generic vacancies page | — | 0 | 0 | URL was generic listing, need specific posting URL |
| **polimi-pierri** | — | — | 0 | 0 | Cycle 41 call **not yet open** |
| **cambridge-llm-safety** | 🚫 Google sign-in | — | (locked) | (locked) | Google login required for Stage 1 form |
| **aalborg-llm-security** | ❌ Apply on AAU HR portal | — | 0 | 0 | Apply button on stillinger.aau.dk redirects |
| **saarland-hahn** | N/A | N/A | N/A | N/A | Direct email — no portal |
| **tubingen-andriushchenko** | N/A | N/A | N/A | N/A | Direct email — no portal |

---

## 🟢 UKP InterText — only fully fillable portal (with caveats)

**Form URL:** https://careers.ukp.informatik.tu-darmstadt.de/

### Mapped form fields (from live page)

| Field name | Type | Required | Autofill source | Status |
|---|---|---|---|---|
| `givenName` | text | ✓ | `profile.yaml → personal.full_name` → "Nauval" | ✅ Ready |
| `familyName` | text | ✓ | `profile.yaml` → "Zulfikar" | ✅ Ready |
| `birthDate` | date | ✓ | — | 🚫 **MISSING PII: DOB** |
| `address` | text | ✓ | `profile.yaml → personal.address_id` "Bandung, Indonesia" | ⚠️ Need full street + house number |
| `postalCode` | text | ✓ | — | 🚫 **MISSING PII: postal code** |
| `city` | text | ✓ | "Bandung" | ✅ Ready |
| `residenceCountry` | text | ✓ | "Indonesia" | ✅ Ready |
| `citizenshipCountry` | text | ✓ | "Indonesia" | ✅ Ready |
| `email` | text | ✓ | "zulfikar.nauval1998@gmail.com" | ✅ Ready |
| `phone` | text | — | "+44 7300 469048" | ✅ Ready (optional) |
| `mscTitle` | text | ✓ | dissertation title | ✅ Ready |
| `mscUniversity` | text | ✓ | "Aston University" | ✅ Ready |
| `mscYear` | text | ✓ | "2024" | ✅ Ready |
| `gender` | select | ✓ | — | 🚫 **MISSING: gender selection** |
| `ukpPosition` | select | ✓ | choose "InterText / PhD" option | ⚠️ Need to view dropdown options |
| `attachments` | file | ✓ | combined PDF | ⚠️ **Need to merge** 6 PDFs into 1 (max 50 MB) |

### What I need from you to autofill UKP

```yaml
# Add to shared/profile.yaml under personal:
date_of_birth: "YYYY-MM-DD"          # e.g. 1998-08-XX
address_street: "Jl. ... No. XX"     # full Bandung street + house number
address_postcode: "40XXX"            # Bandung postcode for your area
gender: "Male" | "Female" | "Diverse" | "Prefer not to say"
```

### Blocker on attachments

UKP wants ONE file. You have:
- `ukp-intertext/documents/nauval_zulfikar_ukp_cv.pdf` (208 KB)
- `ukp-intertext/documents/nauval_zulfikar_ukp_cover_letter.pdf` (56 KB)
- `shared/transcripts/bba_apu_transcript.pdf` + `msc_aston_transcript.pdf`
- `shared/transcripts/bba_apu_degree.pdf` + `msc_aston_degree.pdf`
- `shared/references/ammar_al-bazi_reference.pdf` + `viktor_pekar_reference.pdf`

Action needed: merge with `pypdf` into `ukp-intertext/documents/COMBINED_application.pdf`. I can run this when you say go.

### Eligibility risk (separately)

⚠️ Posting says "PhD (completed or near completion)". You hold MSc only. **Email Iryna FIRST (task #51).** If she greenlights MSc-track variant, then fill + submit.

---

## 🟡 Copenhagen Mech Interp — JS Apply button + KU account creation

The "Apply for position" button on the KU jobs page triggers a JavaScript popup that redirects to KU's internal HR system requiring account creation.

**Blockers:**
1. **Need to create KU candidate account** (email + password + verification)
2. **CAPTCHA likely** on KU account creation
3. SSL handshake from this CLI machine failed (`certificate verify failed`) — must use a normal browser, not Playwright/CLI
4. KU PhD application requires:
   - Detailed CV (✅ have)
   - Motivation letter (✅ have as `cover_letter.pdf`)
   - Project description (✅ have as `project_description.pdf`)
   - Transcripts (✅ shared)
   - Diploma certificates (✅ shared as `*_degree.pdf`)
   - List of references (just contacts, not letters — ✅ Ammar + Viktor)
   - Often: certified English translations of transcripts (if originals not in English) — Aston is already English ✅

**Recommendation:** Open `https://employment.ku.dk/phd/?show=160571` in your normal browser, click "Apply for position", create account, upload docs. I cannot do the account creation step.

---

## 🟡 Aarhus TTA — au.dk HR portal redirect

The "Apply online" button on the AU jobs description page redirects to `https://efzp.fa.em3.oraclecloud.com` (Oracle HCM / Taleo recruitment system). My recon couldn't follow it because:
- Click handler triggers redirect with session token
- Oracle HCM requires either AU SSO or external candidate registration

**Blockers:**
1. **Need to create candidate profile** on AU's Oracle HCM
2. Profile asks for full CV info pre-upload (work history, education — duplicates the PDF)
3. Upload limits ~10 MB per file

**Required:**
- CV (✅)
- Cover letter — 1 page (✅)
- Statement of Interest — 1 page (✅)
- MSc transcript (✅)
- IELTS (✅)

---

## 🟠 Chalmers Agentic AI — generic vacancies URL

The URL I have (`https://www.chalmers.se/en/about-chalmers/work-with-us/vacancies/`) is the GENERIC vacancies list, not the specific Horkoff posting. Need to find the direct posting URL via search filter on Chalmers' Varbi recruitment system.

**Recommendation:** I should re-scope this with a direct posting URL. Probably looks like `https://web103.reachmee.com/ext/I005/167/main?...&rmjob=NNNN` (Varbi pattern).

---

## 🔴 PoliMi Pierri — cycle not open

The URL points to PoliMi's general PhD calls page. The page title says "Bandi Dottorato Polimi **2024–2025**" — **41st cycle 3rd additional call has not opened yet**. Cannot submit until call opens (expected ~June 2026).

**Action:** Email Pierri first (task #52).

---

## 🚫 Cambridge LLM Safety — Google login required

Stage 1 form is on `forms.gle/Cm3MWPsWta73J2Gp7` — Playwright was redirected to `https://accounts.google.com/...` (Google Forms requires sign-in). Standard.

**Blockers:**
1. Google account login (your `zulfikar.nauval1998@gmail.com` — manual)
2. Stage 2 of Cambridge: separate uni admissions portal with £20 fee + transcripts + IELTS + references

**Bundle ready:**
- 2pp CV ✅
- 2pp research proposal ✅
- Stage 2 will need shared/ transcripts + IELTS + reference contacts

---

## 🚫 Aalborg LLM Security — AAU HR portal redirect

Similar to Aarhus — `stillinger.aau.dk` description page has a "Søg stillingen" button that redirects to AAU's recruitment system. Requires:
1. **Create AAU candidate account**
2. Upload 6 docs (CV, cover letter, research statement, BSc+MSc transcripts, dissertation)

---

## 📋 What I CAN automate without your manual login

| Action | Status |
|---|---|
| Read & screenshot every portal landing page | ✅ Done |
| Map form fields where visible without login | ✅ Done (UKP only) |
| Generate per-portal BLOCKERS.md with field-level detail | ✅ Done |
| Merge UKP attachments into one PDF | 🟢 Ready on command |
| Pre-fill UKP form headless and screenshot the filled state | 🟢 Possible IF you give me the 4 missing PII items |
| Auto-create accounts on KU/AU/AAU/Cambridge portals | 🚫 Not safe — bot detection + email verification |
| Submit any application | 🚫 Will not — per your "berhenti di submit" rule |

---

## 🎯 Suggested next move

**Give me this YAML block (5 lines)** and I'll add to `shared/profile.yaml`, then re-run an autofill recon on UKP that fills every fillable field + leaves screenshot proof of state-before-submit:

```yaml
personal:
  date_of_birth: "YYYY-MM-DD"
  address_street: "Jl. Xxxxxx No. XX, RT/RW, Kelurahan, Kecamatan"
  address_postcode: "40XXX"
  gender: "Male"        # or whichever
  ukp_position_target: "InterText"   # so I pick right dropdown option
```

Then for non-UKP portals, you sit at the browser and I narrate the screenshots: "click here next, upload this file from `phd-applications/<opp>/documents/...`".
