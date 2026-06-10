# Research Project

**Title:** *Multilingual Misinformation and Narrative Detection: Transformer- and Retrieval-Augmented Methods under a Responsible-AI Lens*
**Area:** National PhD in AI — "AI & Society" (University of Pisa, KDD Lab)
**Intended supervision:** Prof. Dino Pedreschi / Prof. Salvatore Ruggieri *(verify specific advisor on call PDF)*
**Applicant:** Nauval Zulfikar, MSc Business Analytics (Aston University, 2024, 1:1 First Class)

---

## 1. Motivation and problem

Misinformation does not spread as isolated false claims; it spreads as *narratives* — coherent, evolving framings that recur across communities and languages and that detection systems trained on single-language, claim-level data routinely miss. Two gaps are especially acute for the "AI & Society" agenda. First, most misinformation classifiers are evaluated on English and degrade sharply on lower-resource languages, leaving large electorates (e.g. Indonesian-speaking populations) comparatively unprotected. Second, the detectors that *do* work are typically opaque, which is untenable when their outputs feed moderation or electoral-integrity decisions that demand contestability and auditability.

This project asks: **can transformer- and retrieval-augmented methods detect cross-lingual misinformation narratives accurately *and* transparently, in a way that is auditable enough to be deployed responsibly?**

## 2. Research questions

- **RQ1 (Multilingual detection):** How well do aspect- and stance-aware transformer models transfer across languages for narrative-level misinformation detection, and where does transfer fail?
- **RQ2 (Narrative grounding via RAG):** Can retrieval-augmented generation, grounded in a curated evidence base, improve detection *and* yield traceable justifications rather than free-form claims?
- **RQ3 (Responsible-AI lens):** What governance instruments — bias auditing across languages/communities, explanation faithfulness, and post-deployment drift monitoring — are needed before such a system can be trusted in a civic context?

## 3. Approach and methods

**Foundation in prior work.** This builds directly on completed projects. For the **2024 Indonesia Election Aspect-Based Sentiment Analyser** (Indonesia AI), I worked on aspect-based sentiment over electoral discourse — the same modelling primitive that, reframed as *stance and narrative*, underpins misinformation detection. My **MSc dissertation** fine-tuned **DeBERTa-v3** for multi-aspect classification on review text and evaluated emergent biases against literature baselines. The **Pfizer Public Sentiment Analysis** project (Qarir Generator), where I led sentiment-analysis development, and the **NLP-based competitor app-review analysis** at Bank Muamalat both exercised production sentiment pipelines on noisy real-world text. The **CV–JD Suitability Checker** and **LLM-Shipper-Profiles** projects gave me a working transformer + RAG stack (DeBERTa-v3, sentence-transformers, an LLM augmented with retrieval over a curated knowledge base, with a traceable rule-based fallback) — the exact architecture this proposal extends.

**Workstream A — Multilingual narrative representation (RQ1).** Fine-tune transformer encoders for stance/aspect labelling on misinformation narratives, then probe cross-lingual transfer (English → Indonesian and other languages, subject to data availability). Aspect-based framing lets a model say *which* element of a narrative is contested, not merely true/false. Use controlled, literature-anchored evaluation — a methodology I have already practised in a 450-run agent-based parameter sweep — rather than single split-point reporting.

**Workstream B — Retrieval-augmented justification (RQ2).** Pair the detector with a retrieval layer over a curated evidence base (fact-checks, prior debunks, source provenance) so that a flag is accompanied by retrieved, inspectable evidence. Retain a transparent fallback when retrieval confidence is low — the reproducible-and-ablatable design principle I applied in LLM-Shipper-Profiles — so the system fails *legibly*.

**Workstream C — Responsible-AI evaluation (RQ3).** Measure disparate error rates across languages and communities; assess explanation faithfulness (do retrieved justifications reflect the model's actual decision?); and specify drift/staleness monitoring for deployment. This draws on my Bank Muamalat experience maintaining model reliability under regulatory and audit frameworks — validation cycles, staleness monitoring, audit-grade documentation — i.e. the *technical preconditions* of responsible AI, treated here as first-class research objects rather than afterthoughts.

## 4. Indicative three-year plan

- **Year 1:** Literature synthesis (misinformation, computational social science, multilingual NLP, XAI); assemble/curate multilingual narrative datasets; reproduce strong baselines; establish the evaluation harness.
- **Year 2:** Develop the multilingual narrative detector (A) and the RAG justification layer (B); run cross-lingual transfer and ablation studies; first publication.
- **Year 3:** Responsible-AI evaluation (C) — bias auditing, explanation faithfulness, drift monitoring; consolidate into a deployable, auditable pipeline; thesis and dissemination.

## 5. Fit with the "AI & Society" area

The proposal sits squarely on the area's stated themes — misinformation, disinformation, social impact of AI, responsible AI, computational social science, explainable AI — and on KDD Lab's tradition of explainable and socially-aware data mining. My contribution is a candidate who has *already* built transformer + RAG misinformation-adjacent systems on real electoral and public-health text, and who has operated ML under audit/governance constraints. The methodological notes (datasets, baselines, exact metrics) are deliberately framed to be refined with the supervisor against the official research-project template.

---

*No results, citations, or affiliations beyond the applicant's verified portfolio are claimed. Specific datasets, baselines, and supervisor are to be finalised against the official XLII call and in discussion with KDD Lab. `[TODO: verify with user]` where the call PDF dictates section/length requirements.*
