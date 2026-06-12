#!/bin/bash
# PhD application portals — opens each live application as a browser tab.
# RUN THIS ON YOUR OWN LAPTOP (not the headless Mac Mini).
#   macOS: double-click this file, or `bash open_apply_tabs.command`
#   Linux: replace `open` with `xdg-open`
# Tabs open in deadline order. Pair with APPLY_FILLSHEET.md.

urls=(
  # Bologna — deadline 2026-06-15
  "https://www.unibo.it/en/study/phd-professional-masters-specialisation-schools-and-other-programmes/phd/2026-2027"
  # Sapienza CS — 2026-06-17
  "https://phd.uniroma1.it/web/COMPUTER-SCIENCE_nD3507_EN.aspx"
  # Sapienza National-AI — 2026-06-17
  "https://phd.uniroma1.it/web/ARTIFICIAL-INTELLIGENCE_nD3764_EN.aspx"
  # Sapienza admissions hub (account/registration entry)
  "https://www.uniroma1.it/en/pagina/admissions-2026-2027-phd-programmes"
  # Leiden — 2026-06-26
  "https://careers.universiteitleiden.nl/job/PhD-Candidate,-Formal-methods-in-Natural-Language-Processing/16571-en_US"
  # PoliMi (email Pierri first) — 2026-07-01
  "https://www.polimi.it/dottorato/futuri-dottorandi/ammissione/bandi-e-posizioni-aperte/ciclo-42/1-bando"
  # Cambridge — 2026-07-30 (rolling)
  "https://www.cam.ac.uk/jobs/phd-studentship-in-monitoring-and-increasing-llm-safety-nm49585"
  # Aalborg (verify live first) — ~2026-08-31
  "https://www.vacancies.aau.dk/phd-positions"
  # Chalmers (Ctrl+F "Agentic" — probably closed)
  "https://www.chalmers.se/en/about-chalmers/work-with-us/vacancies/"
)

opener="open"; command -v open >/dev/null 2>&1 || opener="xdg-open"
for u in "${urls[@]}"; do "$opener" "$u"; sleep 0.4; done
echo "Opened ${#urls[@]} application tabs. Follow APPLY_FILLSHEET.md per tab."
