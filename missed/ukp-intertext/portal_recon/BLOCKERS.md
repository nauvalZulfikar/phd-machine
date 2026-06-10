# Portal Recon — ukp-intertext

**URL:** https://careers.ukp.informatik.tu-darmstadt.de/ukprecruitment
**Final URL:** https://careers.ukp.informatik.tu-darmstadt.de/
**Page title:** UKP Application
**Cookie banner:** none / not dismissed

## Signals
- Login-wall indicators: **0**
- CAPTCHA indicators: **0**
- Form fields visible: **15**
- File-upload inputs: **1**

## Blockers
- ✅ No automated blockers detected. Form may be fillable headed.

## Recommended next step
Open the URL above in a normal browser (logged in as Nauval), and use `phd-applications/<opp>/documents/*.pdf` to upload.
Screenshots: `01_landing.png` (+ `02_after_cookies.png` if cookies present).

## Deep recon (after Apply-link follow)
- **landing**: UKP Application
- **after-apply**: UKP Application
  - from `https://careers.ukp.informatik.tu-darmstadt.de/`
  - to `https://careers.ukp.informatik.tu-darmstadt.de/`
  - clicked: submit application (button)

**Form snapshot after apply-link:** 16 fields total, 14 required, 1 file-upload inputs.

### No automated blockers detected at this depth

### Form fields visible
| Name/ID | Type | Label | Required |
|---|---|---|---|
| `givenName` | text | Given name * | ✓ |
| `familyName` | text | Family name * | ✓ |
| `birthDate` | date | Date of birth * | ✓ |
| `address` | text | Address * | ✓ |
| `postalCode` | text | Postal code * | ✓ |
| `city` | text | City * | ✓ |
| `residenceCountry` | text | Country of residence * | ✓ |
| `citizenshipCountry` | text | Country of citizenship * | ✓ |
| `email` | text | E-Mail * | ✓ |
| `phone` | text | Phone |  |
| `mscTitle` | text | PhD Thesis / Master Thesis / Diploma Title * | ✓ |
| `mscUniversity` | text | I graduated from this university * | ✓ |
| `mscYear` | text | Graduation year * | ✓ |
| `gender` | select-one |  | ✓ |
| `ukpPosition` | select-one | I apply for the following position at UKP * | ✓ |
| `attachments` | file | Attach files containing the following information (max. 50MB | ✓ |
