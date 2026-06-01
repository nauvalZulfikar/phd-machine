# Personal Statement

**Applicant:** Nauval Zulfikar
**Programme:** PhD, Operations & Supply Chain Management, Aston Business School (p196342)
**Contact:** zulfikar.nauval1998@gmail.com
**LinkedIn:** linkedin.com/in/nauval-zulfikar · **GitHub:** github.com/nauvalZulfikar

---

I learned the cost of an unbehavioural transport system the slow way. Growing up in Bandung,
I watched a city of three million people negotiate two-lane streets designed for a third of
that. Each administration proposed the same technical answer (more flyovers, more toll roads),
and each time the data showed the new capacity absorbed within five years, a textbook example
of induced travel demand that classical four-step traffic-engineering models routinely
under-specify. When I joined Aston Business School for an MSc in Business Analytics under
Dr. Ammar Al-Bazi, the Decision Models, Software Analytics, and Effective Management Consultancy
modules formalised an intuition I had carried for a decade: that the most consequential decisions
in a transport and logistics system are made by its people, not by its planners. This PhD is
the logical extension of that intuition.

## Academic foundations in operations research

My academic journey began with a Bachelor of Business Administration in Marketing at
Ritsumeikan Asia Pacific University, Japan, where I held the JASSO Scholarship and the APU
50% Tuition Reduction Scholarship. APU laid my foundation in consumer behaviour, marketing
research, and business data analysis, three disciplines that quietly anchor the behavioural
side of this PhD proposal. I then moved to Aston University on the **Aston Enterprise Scholarship
2023**, a full-tuition competitive award, and completed my MSc in Business Analytics with a
**First Class (1:1)** classification. Distinctions in Decision Models (mathematical programming,
mixed-integer linear programming, multinomial logit discrete-choice modelling, scheduling),
Software Analytics (system design, simulation), and Effective Management Consultancy shaped my
quantitative toolkit and primed me for the optimisation-plus-simulation backbone this PhD
requires.

## Logistics and transportation modelling expertise

Logistics and transportation modelling, in the specific senses of mathematical optimisation
(mixed-integer linear programming for vehicle-routing variants), behavioural simulation
(agent-based and discrete-event), discrete-choice modelling, Digital Twin architecture, and
AI/LLM augmentation of decision rules, is the methodological anchor of this application. The
work below is mapped one-to-one against the methods named in the project posting.

**Supply-chain modelling under Dr. Al-Bazi (MSc dissertation, 2023-2024).** My MSc dissertation,
*Enhancing Supply Chain Information Sharing Systems Through Blockchain: Integrated Customer
Reviews LLM Analysis: A Smart Contract Approach*, supervised by Dr. Ammar Al-Bazi over twelve
months, applied DeBERTa-v3 transformer NLP and an Ethereum smart-contract architecture to
asymmetric information across three-tier supplier networks. The project required formalising
information flows across logistics tiers, modelling supplier behaviour under transparency
mechanisms, and validating findings against the supply-chain visibility and bullwhip-mitigation
literature. The dissertation's methodological core, an LLM grounded in domain literature
combined with a behavioural decision layer, is the direct precursor of the LLM-augmented
shipper-decision-rule component proposed in my Research Statement.

**Vehicle Routing with Occasional Drivers (VRPOD): MILP formulation.** I have implemented
the foundational VRPOD model from Archetti, Savelsbergh & Speranza (2016) in
`scipy.optimize.milp` with the HiGHS branch-and-bound solver: binary truck-routing and
crowd-shipper-assignment variables, capacity and detour-budget constraints, and pre-computed
Euclidean cost matrices. On a Birmingham-inspired toy instance (8 customers, 2 trucks,
3 crowd-shippers), enabling occasional-driver assignment **reduces total truck cost by 38.5%**,
replicating the savings band reported by Archetti et al. and by Sampaio et al.'s (2019) survey
of crowdsourced freight formulations. The implementation, route plots, and detour heatmaps are
at github.com/nauvalZulfikar/VRP-MILP.

**Crowd-shipping agent-based simulation with behavioural parameter sweep.** Using the mesa
framework, I built an agent-based model of crowd-shipper acceptance behaviour parameterised on
the willingness-to-detour and reward-elasticity estimates of Punel & Stathopoulos (2017). A
systematic 450-run sweep across nine reward levels (£10 to £50) and five supply densities
(n = 20 to 100 commuters) characterises the response surface and locates the reward-saturation
inflection in the £25 to £30 range, consistent with the stated-preference findings of Punel &
Stathopoulos in their Chicago and Singapore samples. Acceptance ranges from 45.3% (n = 20) to
79.8% (n = 100): a 34-percentage-point supply-density gradient that quantifies the urban-density
effect highlighted by Le, Stathopoulos, Van Woensel & Ukkusuri (2019). Repository:
github.com/nauvalZulfikar/Crowd-Shipping-ABM.

**Mini Digital Twin for Integrated Passenger-Freight Transport.** A three-layer Digital Twin
prototype implementing the Grieves & Vickers (2017) physical-virtual-data architecture: a
FastAPI mock-IoT layer publishing simulated GPS, demand, and weather telemetry over WebSocket;
a coupled mesa agent-based model (passenger and shipper agents) and simpy discrete-event
simulation engine (terminal operations); and a Streamlit operator dashboard with live folium map,
plotly KPIs, and an interactive disruption-injection lab (rain, vehicle breakdown, demand surge).
Smoke-tested: 45% acceptance under base parameters, 62% terminal utilisation, six disruption
types each producing behaviourally-responsive cascades. The architecture maps almost
line-for-line onto the IPFT Digital Twin description in the project posting. Repository:
github.com/nauvalZulfikar/Mini-Digital-Twin.

**LLM-grounded shipper-decision-rule generator.** An end-to-end system that takes a traveller
profile (commute distance, mode, time budget, baseline trust) and emits a literature-grounded
crowd-shipper decision rule, using OpenAI gpt-4o-mini augmented with retrieval over a curated
behavioural knowledge base of Punel & Stathopoulos (2017), Archetti et al. (2016), and Le et al.
(2019). The system falls back to a fully traceable rule-based decision engine when no LLM key
is available, a useful property for reproducible academic experimentation. Repository:
github.com/nauvalZulfikar/LLM-Shipper-Profiles.

**Operations-research-adjacent professional work.** As Data Scientist and Project Manager at
the Bandung Public Works and Spatial Planning Department (PUTR) since September 2022, I have
led ETL and dashboard automation across spatial-planning, building-permits, and tourism-flow
datasets, working with the same origin-destination and temporal-flow data shapes that underlie
urban transport demand modelling, reducing project delivery time by 45%. I designed and shipped
a production-scheduling system with Gantt visualisation and real-time utilisation analytics that
lifted planning efficiency by 63%, a discrete-resource scheduling problem from the same
combinatorial family as the vehicle-routing problems central to this PhD. I produced a machine
learning feasibility study for an automated dam-and-irrigation-gate control system in
Cibeureum, framed as a proxy Digital Twin for hydraulic infrastructure under exogenous
(rainfall, downstream demand) shocks. Earlier industry work in licensed banking at Bank Muamalat
Indonesia (NLP for credit-risk and portfolio analysis under formal model-governance practice),
in a UK start-up at Syncwell (predictive ML, A/B testing, +40% CTR), and in a UK non-profit at
PCOS Challenge (customer attribution, document automation, -80% manual workload) gave me five
years of applied ML rigour inside regulated environments: transferable preparation for the
model-governance and validation requirements of urban-transport research.

## Why Aston and these supervisors

Aston Business School's positioning of operations research, behavioural management research,
and applied simulation under a single departmental roof is rare among UK business schools.
Dr. Sajadi's recent integration of Lean Six Sigma with hybrid discrete-event and agent-based
simulation in healthcare process optimisation models exactly the methodological combination this
proposal requires. Dr. Al-Bazi's recent work on agent-based heuristics for manufacturing
scheduling demonstrates fluency in the precise seam, agent-based simulation coupled with
classical optimisation, at which the proposed PhD sits. As a returning Aston alumnus with a 1:1
MSc, the Enterprise Scholarship, and an MSc dissertation already supervised by Dr. Al-Bazi on
the LLM-supply-chain methodology now central to this proposal, I bring institutional fluency,
methodological continuity, and a documented track record that few applicants can match.

## What I bring, and what I am still building

I bring **logistics and transportation modelling artefacts** (a VRPOD MILP, a crowd-shipping ABM,
an IPFT Digital Twin, an LLM shipper-decision generator) that map one-to-one against the methods
named in the project posting; **applied rigour from regulated industry** (banking, government,
UK start-up, NPO); and **honest interdisciplinarity** from living and working across Indonesia,
Japan, and the UK. I am clear-eyed about the present gap: formal industrial-tool fluency in
AnyLogic is not yet a demonstrated strength. I have begun closing this with AnyLogic Personal
Learning Edition tutorials and a three-month structured ramp-up plan documented in my Research
Statement. I would rather flag this honestly now than discover it in Year One.

## Career vision

After the PhD I want to bring Digital-Twin-grade logistics analytics to the organisations that
actually move people and parcels: Transport for West Midlands, Transport for London, an
Aston-affiliated research centre, or an analytics function at a UK logistics operator. Beyond
that, I want to be the researcher who carries this thinking back to the Global South. Bandung's
traffic does not have a Digital Twin. By the end of this PhD, I hope to be one of the few
researchers in a position to argue that it should, and to build the framework that proves it.
