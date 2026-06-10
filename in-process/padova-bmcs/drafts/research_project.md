# Research Project (Draft)

**Working title:** Do fine-tuned transformers represent *aspect* and *sentiment* the way people do? A cognitively-grounded interpretability study of language-model internal representations

**Candidate:** Nauval Zulfikar
**Program:** PhD in Brain, Mind and Computer Science (BMCS), University of Padova

> ⚠️ Draft for the BMCS interdisciplinary call. Target length ~2000 words once the official cap is verified (this draft is a ~700-word skeleton to be expanded). Built strictly on the candidate's verified record; the cognitive-science framing is an honest interdisciplinary *stretch*, not a claim of prior neuroscience research. Faculty-specific references to be added once the deadline is confirmed and the project is pursued.

## 1. Motivation and problem

Large language models are now used to make and explain judgements that were until recently the preserve of human readers — what a review is *about* (its *aspect*) and how it *evaluates* that aspect (its *sentiment*). When such a model disagrees with a person, we usually cannot say *why*, because the decision lives in distributed internal representations rather than in inspectable rules. This is precisely the gap the BMCS program is positioned to address: it sits between computer science, cognitive science and the study of human-AI interaction.

My proposal is to treat a fine-tuned transformer as an object of *cognitive* as well as *computational* enquiry. The central question is empirical and falsifiable: **how does a fine-tuned transformer internally represent aspect and sentiment, and where do those representations align with — or diverge from — human judgement?** Interpretability supplies the methods (probing, mechanistic analysis of model internals); cognitive science supplies the comparison target (human aspect/sentiment annotation and the disagreement structure within it).

## 2. Background and the experience it builds on

This project is a direct extension of work I have already done. My MSc dissertation at Aston University fine-tuned **DeBERTa-v3** for multi-aspect classification of multi-tier supplier reviews and **evaluated emergent biases against literature baselines** — i.e. I have already asked not just *whether* a transformer classifies correctly but *what regularities it has internalised*. I have built complementary applied systems — a RAG pipeline over a curated behavioural-literature knowledge base (LLM-Shipper-Profiles) designed for reproducibility and ablation, and a transformer-based semantic matcher (CV-JD Suitability Checker) — and I have a record of treating behaviour as the object of study: a 450-run Crowd-Shipping agent-based-modelling parameter sweep, and discrete-choice modelling (MNL, Mixed Logit). My banking-sector experience in **post-deployment model behaviour, validation and staleness monitoring** is the source of a durable interest in *what models actually do once deployed*, not just their headline accuracy.

The interdisciplinary stretch I am candid about: I have applied-ML and behavioural-modelling depth, but no prior neuroscience or experimental-psychology research record. The project is scoped so that the cognitive-science contribution is a *measurement and comparison* contribution I can credibly make, with the program's faculty supplying the deeper cognitive theory.

## 3. Research questions

- **RQ1 (representation).** Where in a fine-tuned DeBERTa-v3 are aspect and sentiment *linearly decodable*? Are they encoded in separable subspaces, or entangled?
- **RQ2 (human alignment).** Do the model's internal confidence and its error structure track *human inter-annotator disagreement* — i.e. does the model find "hard" the same items people find hard?
- **RQ3 (mechanism).** Using mechanistic-interpretability methods (attention/activation analysis, causal interventions on identified components), can specific model components be tied to aspect vs sentiment behaviour, and does ablating them change predictions in cognitively interpretable ways?

## 4. Method (high level)

1. **Datasets.** Public aspect-based sentiment datasets that retain *per-annotator* labels (so human disagreement is recoverable), supplemented with my existing review-classification pipelines.
2. **Probing.** Train linear/MLP probes on frozen hidden states across layers to locate where aspect and sentiment become decodable (RQ1).
3. **Human-alignment analysis.** Correlate model uncertainty and error with human inter-annotator entropy; test whether model "difficulty" predicts human "difficulty" (RQ2).
4. **Mechanistic intervention.** Apply activation patching / causal mediation on candidate components and measure behavioural effects (RQ3).
5. **Rigour.** Pre-registered hypotheses, ablations, and reproducible code — continuing the reproducibility/ablation discipline already in my projects.

## 5. Contribution and fit with BMCS

The deliverable is an empirical, reproducible account of *how* a transformer's internal representation of evaluative language relates to human judgement — a result that is simultaneously a computer-science result (interpretability of model internals) and a cognitive-science result (a model of where machine and human evaluative judgement converge and diverge). This is the kind of bridge BMCS exists to support, and it builds on demonstrable, verifiable strengths of mine in transformer fine-tuning, bias/representation evaluation, and behavioural modelling.

## 6. Feasibility and timeline (indicative)

- **Year 1:** literature grounding in cognitive science of evaluative judgement + interpretability methods; reproduce probing baselines; assemble per-annotator datasets (RQ1).
- **Year 2:** human-alignment study (RQ2); begin mechanistic interventions (RQ3).
- **Year 3:** consolidate mechanistic findings, write-up, dissemination.

## References
[TODO: add 6-10 references — interpretability/probing + aspect-based sentiment + cognitive science of evaluative judgement + BMCS-faculty work — once the call is confirmed and the project is pursued. No references fabricated here.]
