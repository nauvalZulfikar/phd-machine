# Research Project

**Title:** *Reading the Inside of Multilingual Language Models: Interpreting How Lexical-Semantic Knowledge Is Represented and Transferred Across Languages*
**Host:** Sapienza University of Rome, Department of Computer Science — Sapienza NLP group
**Proposed supervisor:** Prof. Roberto Navigli
**Applicant:** Nauval Zulfikar, MSc Business Analytics (Aston University, 2024, First Class)

---

## Motivation

Large language models now operate fluently across dozens of languages, yet *how* they store and reuse meaning internally remains largely opaque. For a multilingual model, two questions are particularly pressing: does the model represent a concept (e.g. a word sense) in a shared, language-agnostic subspace, or does it maintain parallel per-language machinery? And when it answers correctly in a lower-resource language, is it genuinely transferring semantic knowledge from a higher-resource one, or pattern-matching surface form? These are not only scientific questions about model internals — they bear directly on multilingual reliability, on the equitable performance of models such as Sapienza's **Minerva** Italian-English family, and on lexical-semantic tasks (word-sense disambiguation, concept linking) that the Sapienza NLP group has long advanced.

## Gap

Interpretability research has matured rapidly for English-centric models, but mechanistic and representational analysis of *multilingual* lexical semantics is comparatively underdeveloped. Much existing work probes *whether* cross-lingual alignment exists at the embedding layer; far less localises *where in the network* sense-level meaning becomes language-agnostic, *which components* mediate cross-lingual transfer, and whether those components can be identified and stress-tested reproducibly. Closing this gap requires both the semantic-resource expertise that Sapienza NLP has built (multilingual sense inventories, BabelNet-style knowledge) and a disciplined, ablation-first experimental method.

## Proposed approach

I propose to study, layer by layer, **how a multilingual LLM encodes and transfers lexical-semantic knowledge**, using word-sense disambiguation and concept identification as concrete, well-defined probes grounded in Sapienza NLP's existing multilingual semantic resources.

1. **Representational probing across languages.** Using parallel and sense-annotated multilingual data, train lightweight probes on hidden states to test at which layers a given concept's representation becomes language-agnostic versus language-specific, contrasting higher- and lower-resource languages (including Italian, via Minerva where applicable).
2. **Causal / component-level analysis.** Move beyond correlational probing to *interventional* evidence — activation patching and targeted ablation of attention heads and MLP sub-blocks — to identify the components that causally carry sense information and that mediate cross-lingual transfer.
3. **Transfer diagnosis.** Construct minimal-pair and code-switched stimuli to distinguish genuine semantic transfer from surface-form leakage, quantifying when a correct low-resource answer depends on high-resource representations.

## Methodology

The project is built around **reproducibility and ablation as first-class design goals**, which is how I have run my prior NLP work. Every claim about an internal component will be paired with an ablation that removes or perturbs it and measures the downstream effect on disambiguation accuracy, with controlled baselines and seed-level reporting. I will work primarily in PyTorch and HuggingFace Transformers — my main fine-tuning stack — extending it with established interpretability tooling for activation capture and patching. Evaluation will lean on Sapienza NLP's multilingual sense inventories and standard WSD benchmarks, with per-language and per-sense breakdowns rather than single aggregate scores.

## Expected contributions

(1) A layer- and component-level map of where multilingual lexical-semantic meaning lives in an open multilingual LLM; (2) causal, ablation-backed evidence for the components mediating cross-lingual semantic transfer; (3) a reproducible diagnostic suite that separates real transfer from surface leakage; and (4) practical implications for improving lower-resource and Italian-language performance in models of the Minerva family. All artefacts would be released to be reproducible and ablatable.

## Fit with the Sapienza NLP group

This project sits squarely at the intersection of the group's core strengths — **multilingual NLP, lexical/computational semantics, and large language models, including Minerva** — and the interpretability questions I most want to pursue. My background is a direct on-ramp: my MSc dissertation fine-tuned **DeBERTa-v3** on multi-aspect text and explicitly evaluated emergent biases against literature baselines; my **CV-JD Suitability Checker** used DeBERTa-v3 semantic matching to beat lexical baselines, demonstrating I work natively with transformer representations of meaning; and my **LLM-Shipper-Profiles** RAG system was built deliberately to be reproducible and ablatable. Under Prof. Navigli's supervision, I would extend that transformer and semantic-matching experience from *using* representations to *interpreting* them — turning the group's multilingual-semantic resources into a lens for understanding what multilingual LLMs actually know inside.

---

*Note: this proposal is a research direction, not a finalised plan; scope and the specific model(s) studied would be refined with the supervisor. References to standard interpretability techniques (probing, activation patching, ablation) and to Sapienza NLP resources are to be cited precisely once the official research-project format and length cap are confirmed. [TODO: verify length cap and citation requirements on the call PDF.]*
