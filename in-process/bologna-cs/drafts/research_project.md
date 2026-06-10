# Research Project

**Provisional title:** *From Validation to Trust: Rigorous Experimental Evaluation of Reliability and Robustness in Deployed ML and LLM Systems*

**Host:** University of Bologna, DISI — Department of Computer Science and Engineering
**Curriculum:** PhD in Computer Science and Engineering (XLII / AY 2026-27) · trustworthy / responsible AI line *[VERIFY group + supervisor on call PDF]*
**Applicant:** Nauval Zulfikar — MSc Business Analytics (Aston, 2024, 1:1 First Class)

---

## 1. Problem and motivation

Machine-learning and LLM systems are increasingly deployed in settings where a wrong, stale, or unexplained prediction carries regulatory and human cost — credit decisions, public-sector resource allocation, automated content generation. Yet the dominant evaluation practice still reports a single held-out accuracy figure at training time. The hard questions of *trustworthy AI* surface only **after** deployment: does the model stay reliable as the input distribution drifts? How robust is it to small, plausible perturbations of its inputs? Can its behaviour be documented well enough to survive an audit?

I encountered exactly this gap in practice. At Bank Muamalat I maintained NLP models for credit and risk scoring inside a regulated banking environment, where I ran regular validation cycles, **monitored model staleness**, and produced **audit-grade documentation** for compliance. That work convinced me that *post-deployment model behaviour* — not benchmark accuracy — is the technical precondition of Responsible AI. This project turns that operational concern into a research programme.

## 2. Research questions

- **RQ1 — Reliability under drift.** How can we characterise and *predict* the degradation of a deployed ML/LLM model as input distributions shift, and what monitoring signals (calibration drift, staleness indicators, embedding-space movement) give the earliest reliable warning?
- **RQ2 — Robustness evaluation.** What does a *controlled, ablatable* robustness evaluation protocol for LLM-augmented systems look like, and how do retrieval, fallback logic, and prompt design each contribute to (or undermine) robustness?
- **RQ3 — Governance and reproducibility.** Can model-governance artefacts (validation reports, staleness logs, audit documentation) be standardised into machine-checkable, reproducible objects rather than ad-hoc prose?

## 3. Approach and methodology

The methodological commitment of this project is **experimental rigour borrowed from controlled simulation**. In my Crowd-Shipping agent-based model I ran a **450-run controlled parameter sweep** over reward and supply-density grids, with literature-anchored, reproducible results — methodologically the closest thing I have built to a controlled scientific experiment. I propose to apply the same discipline to trustworthy-AI evaluation: treat each robustness/reliability claim as a hypothesis tested across a designed sweep of conditions, with ablations isolating each component's contribution.

- **RQ1.** Build drift/staleness benchmarks by replaying time-ordered data through deployed models and instrumenting calibration, confidence, and embedding-shift metrics. Use **causal inference and Bayesian methods** (from my MSc toolkit) to separate genuine concept drift from sampling noise, and to estimate *when* a model crosses a reliability threshold rather than merely flagging that it has.
- **RQ2.** Construct LLM systems that are **deliberately reproducible and ablatable** — the design principle behind my LLM-Shipper-Profiles RAG system (gpt-4o-mini + retrieval over a curated knowledge base, with a fully-traceable rule-based fallback). Run controlled sweeps perturbing inputs, retrieval corpora, and fallback thresholds to quantify each factor's robustness contribution, reusing my DeBERTa-v3 fine-tuning pipeline for the transformer-classifier strand.
- **RQ3.** Formalise governance artefacts into structured, versioned, machine-checkable schemas (extending model-card / datasheet ideas toward audit-grade staleness and validation logs), evaluated against the documentation standards I worked under in regulated banking.

## 4. Three-year workplan

- **Year 1** — Literature grounding in trustworthy/robust ML; build the drift-and-staleness benchmark harness; first controlled reliability sweep on a public deployed-model dataset.
- **Year 2** — Robustness evaluation protocol for RAG/LLM systems; ablation study; integrate causal/Bayesian drift-detection; first publication.
- **Year 3** — Machine-checkable governance schema; end-to-end case study uniting RQ1–RQ3; thesis and dissemination.

## 5. Fit with DISI and trustworthy-AI at Bologna

DISI's strength in trustworthy, responsible, and distributed AI is the right home for this work: the reliability and governance questions above become sharper, not easier, in distributed and decentralised deployment, which the department is well placed to explore. *[VERIFY specific group and a named potential supervisor on the call PDF / DISI site; I would tailor the project to their line.]*

## 6. Expected contribution

A reproducible, ablation-driven methodology and toolset for evaluating the **reliability and robustness of deployed ML/LLM systems**, plus a standardised, machine-checkable account of model-governance artefacts — bridging the gap between training-time benchmarks and the post-deployment behaviour on which trustworthy AI actually depends.

---

*All projects, methods, and roles cited above are drawn from the applicant's verified record (MSc dissertation, Bank Muamalat model-governance work, Crowd-Shipping ABM, LLM-Shipper-Profiles, DeBERTa-v3 pipeline). Group/supervisor specifics and call constraints are marked for verification. References to be added once the target DISI group is confirmed: [TODO: add 8–12 trustworthy-AI / robustness / model-monitoring references aligned to the chosen group].*
