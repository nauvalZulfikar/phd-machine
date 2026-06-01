# Research Statement

**Project:** *A Digital Twin Framework for Behaviourally-Responsive Integrated Passenger-Freight Transport with Crowd-Shipping*
**FindAPhD reference:** p196342
**Host:** Aston Business School, Operations & Supply Chain Management Department
**Supervisors:** Dr. Seyed Mojtaba Sajadi · Dr. Ammar Al-Bazi
**Applicant:** Nauval Zulfikar, MSc Business Analytics (Aston, 2024, 1:1 First Class)

---

## Abstract

Urban transport networks face compounding pressure from urbanisation, e-commerce growth, and
the imperative to decarbonise (Cleophas et al., 2019). Integrated passenger-freight transport
(IPFT) through crowd-shipping offers a tractable response, using passenger capacity to deliver
parcels. Yet long-term viability depends on **behavioural** rather than purely operational
factors, trust, willingness, and response to disruption (Punel & Stathopoulos, 2017; Le et al.,
2019). Recent literature has advanced Digital Twin (DT) frameworks for city logistics (Belfadel
et al., 2023; Tapia & Tavasszy, 2024) and large language model (LLM) applications to transport
behaviour (Liu et al., 2024; Nishida et al., 2025; Xu et al., 2025), but no existing work
integrates **LLM-generated behavioural decision rules** into a **hybrid agent-based plus
discrete-event simulation pipeline** with **explicit longitudinal trust-dynamics modelling under
repeated disruption**. This proposal addresses that integration gap. The methodology combines
agent-based modelling (ABM) and discrete-event simulation (DES) following the hybrid pattern
demonstrated by the proposed supervisors (Sardarzehi, Sajadi & Esmaelnezhad, 2025; Madi,
Al-Bazi et al., 2024), with a Mixed-Integer Linear Programming optimisation layer based on the
foundational VRPOD formulation (Archetti, Savelsbergh & Speranza, 2016). A cross-context
comparative case spanning Birmingham and Bandung is proposed to extend the literature's largely
Global-North focus.

---

## 1. Introduction and Problem Statement

Cleophas, Cottrill, Ehmke & Tierney (2019) document, in their landscape survey of collaborative
urban transportation, that the central obstacles to such systems are not purely technical but
*organisational and behavioural*: collaborative initiatives stall on trust, willingness, and the
management of shared risk. Crowd-shipping, formalised in the canonical Vehicle Routing Problem
with Occasional Drivers (VRPOD) of Archetti, Savelsbergh & Speranza (2016) and further reviewed
in Sampaio, Savelsbergh, Veelenturf & Van Woensel (2020), is increasingly proposed as a leverage
point for emission and congestion reduction. Tapia, Kourounioti, Thoen & de Bok (2023) develop
disaggregate passenger-freight matching models that operationalise this vision.

In parallel, two methodological streams have rapidly matured. First, Digital Twin frameworks for
city logistics, Belfadel et al. (2023) propose a conceptual DT framework with 75 citations to
date; Tapia & Tavasszy (2024) extend this to freight planning under uncertainty. Second, large
language models have been applied to transport behaviour modelling, Liu et al. (2024) and
Nishida, Ishigaki & Onishi (2025) test whether LLMs can predict traveller mode choice, while
Alsaleh & Farooq (2025) develop locally-deployable fine-tuned LLMs for mode-choice behaviour and
Xu et al. (2025) demonstrate an agentic LLM-driven DT for intermodal freight optimisation.

Despite these advances, four problems remain. **First**, existing DT frameworks are largely
static representations of operational state, none explicitly model behavioural variables
(trust, willingness) as first-class state variables that evolve over time. **Second**, current
LLM applications in transport are one-shot prediction tasks; none integrate LLM-generated rules
into a longitudinal simulation pipeline. **Third**, trust dynamics under *repeated* disruption
events is under-researched in crowd-shipping (only Le et al., 2019 partially addresses this).
**Fourth**, the literature is overwhelmingly Western, no comparative analysis spans Global
North and Global South crowd-shipping markets.

---

## 2. Research Questions

Three connected research questions structure the work:

**RQ1, Architecture.** What is the minimum viable architecture for a Digital Twin that
integrates the *technical* operations of an IPFT system (vehicle dispatch, parcel matching,
terminal queueing) with the *social-behavioural* state of its users (trust, willingness,
disruption response)? This question extends Belfadel et al. (2023) by adding an explicit
behavioural state layer absent from existing conceptual frameworks.

**RQ2, LLM-driven behavioural rules.** Can large language models generate adaptive,
context-conditioned crowd-shipper decision rules that match or outperform fixed-utility
discrete choice baselines (Multinomial Logit, Mixed Logit) under disruption scenarios? This
question extends the one-shot LLM mode-choice work (Liu et al., 2024; Nishida et al., 2025;
Alsaleh & Farooq, 2025) by embedding LLM-generated rules inside a longitudinal ABM simulation.

**RQ3, Disruption resilience and longitudinal trust.** How do crowd-shipper trust scores and
acceptance elasticities evolve across *repeated* disruption events, and which intervention
designs most effectively preserve participation? Le et al. (2019) flag this gap in their
supply-side review; no subsequent work has systematically addressed it.

---

## 3. Literature Review

**Crowd-shipping and integrated passenger-freight transport.** Archetti, Savelsbergh & Speranza
(2016) introduced the canonical Vehicle Routing Problem with Occasional Drivers (VRPOD),
demonstrating that integrating non-employee drivers yields significant cost reductions. Tapia,
Kourounioti, Thoen & de Bok (2023) extended this with disaggregate behavioural matching
mechanisms. Sampaio et al. (2020) surveyed the broader crowdshipping literature and identified
gaps in behavioural heterogeneity modelling. Mohri (2024), in a recent University of Melbourne
PhD thesis, examined the behavioural aspects of crowd-shipping by public transport passengers
specifically. None of these works integrates an explicit Digital Twin layer or longitudinal
disruption-response modelling.

**Digital Twin and LLM applications in transport.** The Digital Twin concept, formalised by
Grieves & Vickers (2017) in manufacturing, has been extended to city logistics by Belfadel et
al. (2023) with a conceptual framework now widely cited. Tapia & Tavasszy (2024) survey
Digital Twins for freight planning. In parallel, LLM-based transport behaviour modelling has
become an active stream: Liu et al. (2024) assess whether LLMs can capture stated-preference
mode choice; Nishida et al. (2025) test LLM mode-choice prediction across alternative sets;
Alsaleh & Farooq (2025) develop fine-tuned causal LLMs for mode choice; Xu et al. (2025)
demonstrate an agentic LLM-driven DT for intermodal freight. These works are predominantly
*single-method*, LLM-as-predictor or LLM-as-orchestrator, without an integrated ABM-DES-MILP
simulation pipeline.

**Behavioural and discrete-choice foundations.** Ben-Akiva & Lerman (1985) and Train (2009)
established the discrete-choice modelling tradition that underpins quantitative behavioural
transport research. Punel & Stathopoulos (2017) applied this tradition to crowdsourced delivery
acceptance and documented reward saturation in the £25–30 range using stated-preference data
from Chicago and Singapore commuters. Le et al. (2019) reviewed crowd-shipping supply-side
modelling and identified longitudinal trust dynamics under repeated disruption as an
under-researched area. The supervisory pair at Aston has produced exactly the methodological
combination this proposal requires: Sardarzehi, Sajadi & Esmaelnezhad (2025) demonstrate Lean
Six Sigma integrated with hybrid DES + ABM simulation in the *Journal of Simulation*; Madi,
Al-Bazi et al. (2024) develop agent-based heuristics coupled with optimisation in *Soft
Computing*.

---

## 4. Methodology

### 4.1 Overview

The research proceeds through six interconnected phases. A conceptual DT framework (Phase 1)
extends Grieves & Vickers (2017) and Belfadel et al. (2023) by adding an explicit behavioural
state layer. Empirical behavioural data is collected through a stated-preference (SP) survey
(Phase 2). LLM-generated decision rules (Phase 3) and agent-based plus discrete-event
simulation (Phase 4) compose the behaviourally-responsive simulation engine. An MILP
optimisation layer (Phase 5) follows the Archetti et al. (2016) VRPOD formulation. Cross-context
validation and policy synthesis (Phase 6) closes the cycle. The full workflow and inter-phase
data flow are summarised in Figure 1.

![Six-phase methodology workflow](methodology_diagram.svg)

### 4.2 Quantitative Methods

Quantitative methods include stated-preference survey design and deployment via Prolific
(n = 200–500 Birmingham commuters), Multinomial Logit and Mixed Logit estimation in Biogeme
following Train (2009), and Mixed-Integer Linear Programming optimisation for
shipment–shipper matching following Archetti, Savelsbergh & Speranza (2016). The agent-based
simulation will be implemented in AnyLogic Multimethod combined with discrete-event modules,
following the hybrid methodology demonstrated by Sardarzehi, Sajadi & Esmaelnezhad (2025) and
Madi, Al-Bazi et al. (2024). A 450-run parameter sweep prototype (already implemented, see
Section 6) demonstrates the saturation pattern Punel & Stathopoulos (2017) report.

### 4.3 Qualitative Methods

Qualitative methods focus on LLM-driven analysis of crowd-shipper decision-making. Building on
Liu et al. (2024), Nishida et al. (2025), and Alsaleh & Farooq (2025), but moving beyond
one-shot prediction, this work will use retrieval-augmented generation (RAG) over a curated
behavioural-literature knowledge base to produce *adaptive*, context-conditioned decision
rules per traveller profile. This methodology continues the LLM-blockchain-supply-chain work
of my MSc dissertation, supervised by Dr. Al-Bazi (2024).

### 4.4 Interplay Between Quantitative and Qualitative Methods

The integration of quantitative and qualitative methods is the project's central
methodological contribution. LLM-generated decision rules (qualitative) parametrise agent
heterogeneity in the ABM (quantitative). SP-survey-estimated Mixed Logit baselines
(quantitative) provide a falsifiable benchmark for LLM-generated rules (qualitative).
Disruption-induced trust changes (qualitative narrative) are quantitatively measured through
acceptance-rate decay across repeated scenarios. This synergy distinguishes the project from
LLM-as-predictor work (Liu et al., 2024; Nishida et al., 2025) and from agentic-LLM-as-orchestrator
work (Xu et al., 2025).

---

## 5. Expected Outcomes and Significance

The project will deliver three primary contributions. **Theoretically**, a behaviourally-enriched
Digital Twin architecture for IPFT crowd-shipping that explicitly models trust dynamics under
repeated disruption, addressing the gap identified by Le et al. (2019). **Methodologically**, a
demonstrated integration of LLM-generated adaptive decision rules into a hybrid ABM-DES-MILP
simulation pipeline, extending the one-shot LLM mode-choice work of Liu et al. (2024), Nishida
et al. (2025), and Alsaleh & Farooq (2025), and complementing the agentic-LLM-DT freight
optimisation of Xu et al. (2025) with a passenger-freight crowd-shipping focus. **Practically**,
deployable policy tools for crowd-shipping operators (Transport for West Midlands, Transport for
London, Indonesian municipal authorities) that quantify the cost-effective reward threshold,
disruption resilience envelope, and intervention efficacy. The cross-context Birmingham–Bandung
comparative analysis extends the literature beyond its current Western-centric focus
(Cleophas et al., 2019; Punel & Stathopoulos, 2017).

---

## 6. Fit with Existing Background

Four pre-application prototypes demonstrate methodological readiness, each available publicly:

- **Mini Digital Twin** (`github.com/nauvalZulfikar/Mini-Digital-Twin`): three-layer FastAPI
  + mesa + simpy + Streamlit DT prototype with interactive disruption injection. This is the
  architectural skeleton of Phase 1.
- **LLM Shipper Profiles** (`github.com/nauvalZulfikar/LLM-Shipper-Profiles-`): end-to-end
  RAG + gpt-4o-mini decision-rule generator producing literature-grounded DecisionRule
  objects. Direct continuation of my November 2024 CV-Job Suitability LLM work and my MSc
  dissertation under Dr. Al-Bazi.
- **VRPOD MILP** (`github.com/nauvalZulfikar/VRP-MILP`): Archetti et al. (2016) replication
  solved with scipy.optimize.milp. Crowd-shipping integration reduces cost by **38.5%** on a
  toy 8-customer instance.
- **Crowd-Shipping ABM Sweep** (`github.com/nauvalZulfikar/Crowd-Shipping-ABM-`): 450-run
  parameter sweep with auto-generated findings citing Punel & Stathopoulos (2017) and Le et
  al. (2019). Supply effect: 45.34% (n_pax = 20) → 79.80% (n_pax = 100).

The MSc dissertation, *Enhancing Supply Chain Information Sharing Systems Through Blockchain: Integrated Customer Reviews LLM Analysis: A Smart Contract Approach*, supervised by Dr. Al-Bazi at Aston, establishes
my direct methodological lineage to the LLM-driven analysis component of this PhD.

---

## 7. Three-Year Workplan

**Year 1: Foundations.** Structured literature review (extending the 18-reference base
already assembled). SP survey design and deployment via Prolific (n ≈ 250 Birmingham
respondents). MNL and Mixed Logit baseline estimation in Biogeme (Train, 2009). First formal
ABM in AnyLogic on a small Birmingham network, extending the mesa prototype already public.
Target: workshop submission to the UK Transport Study Group (UTSG) or the Operational Research
Society (ORS) annual conference.

**Year 2: Integration and disruption modelling.** Full Birmingham IPFT scenario with GTFS
data and crowd-shipper supply model from Le et al. (2019). LLM decision-rule layer integrated
into the ABM, benchmarked against the Mixed Logit baseline from Year 1. Disruption scenario
library covering weather, breakdown, surge, and *repeated-disruption sequences*, the
longitudinal trust dimension. Target: journal submission to *Transportation Research Part E*
or *Transport Policy*.

**Year 3: Optimisation, comparative analysis, and synthesis.** MILP optimisation layer
integrated with the DT for closed-loop shipment–shipper matching, extending the static
Archetti et al. (2016) formulation. Bandung comparative case study, leveraging field network
from prior employment at the Bandung Public Works and Spatial Planning Department. Synthesis
paper targeting *Transportation Science* or the *Journal of Operations Management*. Thesis
writing.

---

## 8. Challenges and Limitations

Three principal challenges are anticipated, each with a mitigation strategy. **First**, formal
simulation modelling in AnyLogic, an essential requirement of the project, is not yet a
demonstrated strength of my profile. Mitigation: I have begun AnyLogic Personal Learning
Edition tutorials and have planned a three-month structured ramp-up programme; the Python mesa
+ simpy prototype already publicly available demonstrates competence in the underlying ABM and
DES paradigms. **Second**, LLM-generated decision rules carry hallucination risk; the literature
notes opacity in LLM outputs (Liu et al., 2024). Mitigation: rules will be validated against
the Mixed Logit baseline (Year 2), and a deterministic rule-based fallback grounded in the
same behavioural literature is already implemented in the public prototype. **Third**, the
Bandung comparative case raises questions of comparability, different network topology, fare
structures, and cultural norms. Mitigation: the comparison will be framed analytically, not as
parameter transfer, with explicit acknowledgement of scope conditions.

---

## 9. Conclusion and Why Aston

Crowd-shipping cannot be evaluated solely on operational efficiency: it succeeds or fails on
trust, willingness, and behavioural response to disruption. The proposed Digital Twin
framework operationalises this insight by integrating LLM-generated decision rules into a
hybrid ABM-DES-MILP simulation pipeline, with longitudinal trust dynamics under repeated
disruption as its central novel contribution. Aston Business School is the right home for
this work. Dr. Sajadi and Dr. Al-Bazi jointly provide the methodological coverage, hybrid
DES + ABM (Sardarzehi, Sajadi & Esmaelnezhad, 2025) plus agent-based heuristics with
optimisation (Madi, Al-Bazi et al., 2024), that the project requires. As an Aston alumnus
returning with a 1:1 First Class MSc, an Aston Enterprise Scholarship, and a dissertation
directly supervised by Dr. Al-Bazi on the LLM-supply-chain methodology now central to this
proposal, I bring institutional fluency, prior research engagement, and methodological
continuity that few applicants can match.

---

## References

1. Alsaleh, T. and Farooq, B. (2025) 'Towards locally deployable fine-tuned causal large language models for mode choice behaviour', *arXiv* preprint arXiv:2507.21432.
2. Archetti, C., Savelsbergh, M. and Speranza, M.G. (2016) 'The vehicle routing problem with occasional drivers', *European Journal of Operational Research*, 254(2), pp. 472–480.
3. Belfadel, A., Hörl, S., Tapia, R.J., Politaki, D., Kureshi, I., Tavasszy, L. and Puchinger, J. (2023) 'A conceptual digital twin framework for city logistics', *Computers, Environment and Urban Systems*, 103, 101989.
4. Ben-Akiva, M. and Lerman, S.R. (1985) *Discrete Choice Analysis: Theory and Application to Travel Demand*. Cambridge, MA: MIT Press.
5. Cleophas, C., Cottrill, C., Ehmke, J.F. and Tierney, K. (2019) 'Collaborative urban transportation: Recent advances in theory and practice', *European Journal of Operational Research*, 273(3), pp. 801–816. doi: 10.1016/j.ejor.2018.04.037.
6. Grieves, M. and Vickers, J. (2017) 'Digital Twin: Mitigating unpredictable, undesirable emergent behavior in complex systems', in Kahlen, F.-J., Flumerfelt, S. and Alves, A. (eds) *Transdisciplinary Perspectives on System Complexity*. Cham: Springer, pp. 85–113. doi: 10.1007/978-3-319-38756-7_4.
7. Le, T.V., Stathopoulos, A., Van Woensel, T. and Ukkusuri, S.V. (2019) 'Supply, demand, operations, and management of crowd-shipping services: A review and empirical evidence', *Transportation Research Part C*, 103, pp. 83–103.
8. Liu, T., Li, M. and Yin, Y. (2024) 'Can large language models capture human travel behavior? Evidence and insights on mode choice', *SSRN* preprint 4937575.
9. Madi, F., Al-Bazi, A., Buckley, S., Smallbone, J. and Foster, K. (2024) 'An agent-based heuristics optimisation model for production scheduling of make-to-stock connector plates manufacturing systems', *Soft Computing*, 28(7–8), pp. 5899–5919.
10. Mohri, S.S. (2024) *Behavioural aspects, operational decisions, and strategic planning for crowd-shipping by public transport passengers*. PhD thesis. University of Melbourne.
11. Nishida, R., Ishigaki, T. and Onishi, M. (2025) 'Large language models predict transportation mode choice behavior for a variety of alternative sets', *Transportation Research Record*, 2679(12), pp. 249–264.
12. Punel, A. and Stathopoulos, A. (2017) 'Modeling the acceptability of crowdsourced goods deliveries: Role of context and experience effects', *Transportation Research Part E*, 105, pp. 18–38.
13. Sampaio, A., Savelsbergh, M., Veelenturf, L. and Van Woensel, T. (2019) 'Crowd-Based City Logistics', in *Sustainable Transportation and Smart Logistics*. Amsterdam: Elsevier, pp. 381–400.
14. Sardarzehi, M., Sajadi, S.M., Esmaelnezhad, D., Taghizadeh-Yazdi, M. and Nazari-Shirkouhi, S. (2025) 'A novel integrated Six Sigma and simulation approach for reducing waiting time in emergency departments', *Journal of Simulation*, pp. 1–24. doi: 10.1080/17477778.2025.2603493.
15. Tapia, R.J., Kourounioti, I., Thoen, S., de Bok, M. and Tavasszy, L. (2023) 'A disaggregate model of passenger-freight matching in crowdshipping services', *Transportation Research Part A: Policy and Practice*, 169, 103587.
16. Tapia, R.J. and Tavasszy, L. (2024) 'Digital twins for freight planning', in Tavasszy, L., Browne, M. and Piecyk, M. (eds) *Freight Transport Planning*. Amsterdam: Elsevier.
17. Train, K.E. (2009) *Discrete Choice Methods with Simulation*. 2nd edn. Cambridge: Cambridge University Press.
18. Xu, H., Sun, Y., Tupayachi, J., Omitaomu, O., Zlatanova, S. and Li, X. (2025) 'Towards the autonomous optimization of urban logistics: Training generative AI with scientific tools via agentic digital twins and Model Context Protocol', *arXiv* preprint arXiv:2506.13068.

---

*Citation style: Harvard (Aston Business School standard).*
*Word count excluding references and headers: ~2200 words.*
