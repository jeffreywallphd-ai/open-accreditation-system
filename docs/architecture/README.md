# Architecture Reference

This document is the **canonical detailed architecture guide** for the Open Accreditation System repository. It defines the target-state architecture, module boundaries, layering rules, integration principles, AI boundaries, and implementation consistency rules that should govern future changes.

Where the current repository is still scaffolded or partially implemented, treat this document as the intended architecture baseline and use it to drive incremental convergence.

> Follow the architecture guardrails in `README.md` and `docs/architecture/README.md`. Do not introduce architectural patterns that conflict with them.

## Table of contents

- [1. Target-state architecture overview](#1-target-state-architecture-overview)
  - [1.1 Architectural style](#11-architectural-style)
  - [1.2 Why this target state fits the problem](#12-why-this-target-state-fits-the-problem)
  - [1.3 Technology stance](#13-technology-stance)
  - [1.4 Accreditor model](#14-accreditor-model)
- [2. Repository structure overview](#2-repository-structure-overview)
  - [2.1 Intended responsibilities](#21-intended-responsibilities)
  - [2.2 Current-state vs target-state note](#22-current-state-vs-target-state-note)
- [3. Core bounded contexts / modules](#3-core-bounded-contexts-modules)
  - [3.1 identity-access](#31-identity-access)
  - [3.2 organization-registry](#32-organization-registry)
  - [3.3 accreditation-frameworks](#33-accreditation-frameworks)
  - [3.4 evidence-management](#34-evidence-management)
  - [3.5 assessment-improvement](#35-assessment-improvement)
  - [3.6 workflow-approvals](#36-workflow-approvals)
  - [3.7 narratives-reporting](#37-narratives-reporting)
  - [3.8 faculty-intelligence](#38-faculty-intelligence)
  - [3.9 curriculum-mapping](#39-curriculum-mapping)
  - [3.10 compliance-audit](#310-compliance-audit)
  - [3.11 integration-hub](#311-integration-hub)
- [4. Layering rules and dependency rules](#4-layering-rules-and-dependency-rules)
  - [4.1 Layer responsibilities](#41-layer-responsibilities)
  - [4.2 Dependency direction](#42-dependency-direction)
  - [4.3 Correct vs incorrect choices](#43-correct-vs-incorrect-choices)
- [5. Rules for shared code](#5-rules-for-shared-code)
  - [5.1 Shared kernel rule](#51-shared-kernel-rule)
  - [5.2 What must not go into shared packages](#52-what-must-not-go-into-shared-packages)
  - [5.3 Examples](#53-examples)
- [3A. Logical entity model reference](#3a-logical-entity-model-reference)
- [6. How to structure new modules and where new code should go](#6-how-to-structure-new-modules-and-where-new-code-should-go)
  - [6.1 Default location for new business functionality](#61-default-location-for-new-business-functionality)
  - [6.2 Create a new bounded context only when justified](#62-create-a-new-bounded-context-only-when-justified)
  - [6.3 Prefer extending an existing module when](#63-prefer-extending-an-existing-module-when)
  - [6.4 New module checklist](#64-new-module-checklist)
- [7. Integration principles and consistent handling of external systems](#7-integration-principles-and-consistent-handling-of-external-systems)
  - [7.1 Core integration rules](#71-core-integration-rules)
  - [7.2 Canonical model principle](#72-canonical-model-principle)
  - [7.3 Adapter isolation principle](#73-adapter-isolation-principle)
  - [7.4 Correct vs incorrect integration choices](#74-correct-vs-incorrect-integration-choices)
  - [7.5 Integration data flow](#75-integration-data-flow)
- [8. AI service boundaries](#8-ai-service-boundaries)
  - [8.1 Mandatory AI rules](#81-mandatory-ai-rules)
  - [8.2 Acceptable AI use cases](#82-acceptable-ai-use-cases)
  - [8.3 Unacceptable AI use cases](#83-unacceptable-ai-use-cases)
  - [8.4 AI logging and provenance expectations](#84-ai-logging-and-provenance-expectations)
  - [8.5 Python service boundary](#85-python-service-boundary)
- [9. Companion services and their relationship to the core](#9-companion-services-and-their-relationship-to-the-core)
  - [9.1 Good reasons to create or keep a companion service](#91-good-reasons-to-create-or-keep-a-companion-service)
  - [9.2 Poor reasons to create a companion service](#92-poor-reasons-to-create-a-companion-service)
  - [9.3 Expected companion service roles](#93-expected-companion-service-roles)
  - [9.4 Rule of authority](#94-rule-of-authority)
- [10. Compliance, security, accessibility, and quality expectations](#10-compliance-security-accessibility-and-quality-expectations)
  - [10.1 Accessibility-first](#101-accessibility-first)
  - [10.2 Auditability by default](#102-auditability-by-default)
  - [10.3 Traceable evidence lineage](#103-traceable-evidence-lineage)
  - [10.4 Role-based and attribute-aware access control](#104-role-based-and-attribute-aware-access-control)
  - [10.5 Security and privacy expectations](#105-security-and-privacy-expectations)
- [11. ADRs (Architectural Decision Records)](#11-adrs-architectural-decision-records)
  - [11.1 Create an ADR when](#111-create-an-adr-when)
  - [11.2 ADR minimum contents](#112-adr-minimum-contents)
  - [11.3 ADR rule](#113-adr-rule)
- [12. Implementation Consistency Rules](#12-implementation-consistency-rules)
  - [12.1 Core platform rules](#121-core-platform-rules)
  - [12.2 Layering rules](#122-layering-rules)
  - [12.3 Shared-code rules](#123-shared-code-rules)
  - [12.4 Integration rules](#124-integration-rules)
  - [12.5 AI rules](#125-ai-rules)
  - [12.6 Compliance/quality rules](#126-compliancequality-rules)
  - [12.7 Evolution rules](#127-evolution-rules)
  - [12.8 Anti-patterns to reject](#128-anti-patterns-to-reject)
- [13. How to evaluate whether a change is architecturally consistent](#13-how-to-evaluate-whether-a-change-is-architecturally-consistent)
  - [13.1 Architecture consistency checklist](#131-architecture-consistency-checklist)
  - [13.2 Simple evaluation rule](#132-simple-evaluation-rule)
- [14. Quick examples: correct vs incorrect choices](#14-quick-examples-correct-vs-incorrect-choices)
  - [Correct](#correct)
  - [Incorrect](#incorrect)
- [15. Guidance for future prompts and contributors](#15-guidance-for-future-prompts-and-contributors)

---
## 1. Target-state architecture overview

### 1.1 Architectural style

The target state is a **domain-centered modular monolith** for the core institutional platform, implemented primarily in **TypeScript** using **NestJS with Fastify** as the main API foundation.

The modular monolith is the default home for:

- accreditation domain behavior
- workflow and approvals
- evidence governance and traceability
- compliance controls
- institutional reporting orchestration
- role- and attribute-aware access enforcement for core use cases

Specialized **companion services** may exist for concerns that are operationally or technically distinct, such as:

- AI assistance and document processing
- search and indexing
- notification delivery
- integration orchestration

These companion services support the core platform but do not replace it as the system of record.

### 1.2 Why this target state fits the problem

The domain requires strong consistency around:

- evidence lineage
- audit trails
- human approvals
- accreditor-specific rules layered on a shared institutional model
- institution-wide visibility and control

A modular monolith is preferred first because it:

- keeps the domain cohesive
- reduces accidental complexity from distributed transactions and contracts
- improves maintainability for a governed enterprise platform
- enforces a common implementation model across modules
- allows later extraction only when justified by clear domain or operational needs

### 1.3 Technology stance

- **Primary platform language:** TypeScript
- **Primary core API framework:** NestJS with Fastify
- **Python use:** limited to AI, document-processing, search/indexing support, or automation services where its ecosystem is advantageous
- **System of record:** the core TypeScript platform, not Python services

### 1.4 Accreditor model

The core domain must be **accreditor-agnostic**. Support for AACSB, ABET, HLC, and future accreditors should be implemented through:

- framework definitions
- rule packs
- mappings
- configurable workflows
- extension points

The system should not hard-code one accreditor’s concepts as the universal domain language when those concepts are not institutionally general.

---

## 2. Repository structure overview

The repository currently contains scaffolding and early service boundaries. The target repository shape should be understood as follows:

```text
apps/
  web/
  reviewer-portal/
services/
  core-api/
  integration-hub/
  ai-assistant/
  notification-service/
  search-indexer/
packages/
  api-client/
  auth-client/
  design-system/
  ui/
  config/
  events/
  lint-rules/
  tsconfig/
docs/
  architecture/
  decisions/
  product/
  accreditors/
schemas/
  api/
  canonical/
  events/
platform/
  security/
  observability/
  compliance/
deploy/
  docker/
  kubernetes/
  terraform/
tests/
  e2e/
  security/
  compliance/
  accessibility/
  performance/
```

### 2.1 Intended responsibilities

- `services/core-api/` — main modular monolith and system of record
- `services/integration-hub/` — orchestration and adapter isolation for external systems when separated from the core runtime
- `services/ai-assistant/` — assistive AI and document-processing workloads
- `services/notification-service/` — email, in-app, webhook, and queued notifications
- `services/search-indexer/` — indexing and search support workloads
- `apps/` — institution-facing or reviewer-facing clients
- `packages/` — truly shared, low-volatility code and contracts; not a dumping ground for business logic
- `schemas/canonical/` — internal canonical models for integration interchange
- `docs/decisions/` — ADRs and major architecture decisions

### 2.2 Current-state vs target-state note

The repository may not yet fully implement the target structure inside each service. When extending the platform:

- prefer creating code in the target shape
- avoid reinforcing temporary scaffolding as permanent architecture
- document meaningful deviations with ADRs or migration notes

---

## 3. Core bounded contexts / modules

The following bounded contexts define the target module map for the core platform. Each should have explicit ownership, vocabulary, and internal model boundaries.

### 3.1 identity-access

**Purpose**

- users, service principals, institutional roles, permissions, policy evaluation inputs, and access context

**Owns**

- user identity references and account status within the platform
- role assignments
- attribute-aware access metadata relevant to institutional governance
- permission evaluation interfaces used by other modules

**Does not own**

- faculty profile business data beyond what is required for access decisions
- workflow approvals themselves

### 3.2 organization-registry

**Purpose**

- institutional structure: campuses, colleges, schools, departments, programs, units, committees

**Owns**

- canonical organizational hierarchy
- organizational identifiers and lifecycle state
- relationships used by reporting, workflow routing, and access scoping

**Does not own**

- accreditor definitions
- external SIS hierarchy schemas

### 3.3 accreditation-frameworks

**Purpose**

- accreditor-agnostic modeling of standards, criteria, cycles, rule packs, mappings, and accreditor-specific extensions

**Owns**

- framework definitions
- accreditor-specific rule-pack registration
- cycle templates and applicable standard structures
- mappings from institutional artifacts to accreditor expectations

**Does not own**

- institutional evidence files
- source-system adapter logic

### 3.4 evidence-management

**Purpose**

- governed evidence records, lineage, metadata, attachments, references, retention, and traceability

**Owns**

- evidence item registration
- evidence provenance metadata
- evidence-to-standard linkage
- evidence versioning references
- quarantine and validation states for inbound artifacts

**Does not own**

- final approval decisions
- document extraction implementation details beyond evidence governance

### 3.5 assessment-improvement

**Purpose**

- outcomes assessment, findings, action plans, improvement cycles, and closure of the loop

**Owns**

- assessment artifacts and improvement actions
- outcome evaluation records
- structured findings tied to evidence and review cycles

**Does not own**

- core faculty identity management
- LMS adapter payloads

### 3.6 workflow-approvals

**Purpose**

- governed review-cycle and target-workflow state orchestration, approvals, and transition auditability

**Owns**

- `ReviewCycle` lifecycle and scope invariants
- `ReviewWorkflow` state machine, role-governed transitions, and transition history
- evidence-readiness-gated decision transitions (`approved`, `submitted`)

**Does not own**

- evidence content storage
- AI recommendation authority

### 3.7 narratives-reporting

**Purpose**

- narrative/report assembly and governed submission-package composition for accreditation review

**Owns**

- `SubmissionPackage` aggregate with governed item assembly and snapshot/finalization semantics (Phase 4 inner slice)
- thin API transport for package assembly/retrieval operations aligned to the same use cases
- narrative composition records and report section structures (planned outer slices)
- report generation/export orchestration (later slice)

**Does not own**

- direct AI authority over final published claims
- accreditor rule definitions themselves

### 3.8 faculty-intelligence

**Purpose**

- canonical faculty profile aggregation, workload-related accreditation views, qualifications evidence linking, and faculty-related analytics for accreditation use

**Owns**

- accreditation-oriented faculty profile projections
- faculty qualification evidence linkage
- faculty accreditation analytics models

**Does not own**

- HRIS schemas
- payroll or employment-system domain rules

### 3.9 curriculum-mapping

**Purpose**

- program, course, outcome, competency, and standards mapping views needed for accreditation and assessment

**Owns**

- canonical curriculum mappings
- outcome-to-course and standard-to-curriculum relationships
- mapping review status and traceability

**Does not own**

- LMS or SIS vendor-specific course payload models

### 3.10 compliance-audit

**Purpose**

- platform-level compliance evidence, audit event access, control attestations, policy exceptions, and compliance monitoring views

**Owns**

- audit event query surfaces and compliance-oriented views
- control attestation records
- exception logging and review metadata

**Does not own**

- identity provider implementation details
- domain logic already owned by workflow or evidence modules

### 3.11 integration-hub

**Purpose**

- canonical data interchange, source-system synchronization orchestration, adapter management, mapping configurations, import/export pipelines

**Owns**

- adapter interfaces and adapter implementations
- source-system mapping configurations
- synchronization jobs and reconciliation processes
- translation between external payloads and canonical internal models

**Does not own**

- core accreditation decisions
- domain behavior for evidence, approvals, or narratives

---

## 4. Layering rules and dependency rules

Each core module should follow the same internal layering model.

```text
<module>/
  domain/
  application/
  infrastructure/
  api/
```

### 4.1 Layer responsibilities

#### domain

Contains:

- entities
- value objects
- aggregates
- domain policies
- domain services
- invariants
- domain events as business concepts

Rules:

- domain cannot depend on infrastructure
- domain should not depend on NestJS, ORM classes, transport DTOs, or vendor SDKs
- domain should express business language, not technical integration language

#### application

Contains:

- use cases
- command/query handlers
- transaction orchestration
- ports/interfaces
- authorization and policy coordination at use-case level

Rules:

- application orchestrates use cases
- application may depend on domain and declared ports
- application should not contain persistence-specific or transport-specific code

#### infrastructure

Contains:

- repository implementations
- ORM mappings
- event bus integrations
- storage clients
- external adapter implementations
- queue producers/consumers

Rules:

- infrastructure implements ports/adapters
- infrastructure may depend on framework and vendor libraries
- infrastructure must not redefine business rules owned by domain/application

#### api

Contains:

- controllers
- DTOs
- validation
- authentication/authorization context extraction
- serialization and transport mapping

Rules:

- api handles transport concerns only
- api should delegate to application use cases
- controllers should not contain approval logic, evidence policies, or integration mapping logic

### 4.2 Dependency direction

Allowed directional flow should be:

- `api -> application -> domain`
- `infrastructure -> application/domain` through ports and implementations

Disallowed examples:

- `domain -> infrastructure`
- `domain -> api`
- `application -> api`
- domain modules importing ERP SDK clients or ORM entities directly

### 4.3 Correct vs incorrect choices

**Correct**

- `workflow-approvals/application/WorkflowApprovalsService.transitionWorkflowState` orchestrates readiness evaluation, role policy, and append-only transition persistence.
- `evidence-management/infrastructure/PostgresEvidenceRepository` implements an `EvidenceRepository` port.
- `api` maps HTTP payloads into application commands.

**Incorrect**

- `workflow-approvals/api/ApprovalController` directly updates workflow tables and bypasses evidence-readiness policy evaluation.
- `evidence-management/domain/EvidenceItem` imports a storage SDK or ORM decorator.
- `assessment-improvement/application` embeds raw LMS webhook parsing logic.

---

## 5. Rules for shared code

Shared code is necessary, but shared code is also one of the fastest ways to destroy modular boundaries.

### 5.1 Shared kernel rule

Use a **shared kernel sparingly**. Shared code should be limited to things that are genuinely cross-cutting and stable, such as:

- primitive shared types
- common platform abstractions
- event envelope standards
- security utilities
- configuration helpers
- UI primitives and design-system components

### 5.2 What must not go into shared packages

Do not put core business logic into generic places like:

- `packages/utils`
- helper files with vague names
- “common service” folders that mix multiple domain meanings

### 5.3 Examples

**Correct**

- a shared event envelope definition in `packages/events`
- common accessibility-focused UI primitives in `packages/ui`
- cross-service config loading helpers in `packages/config`

**Incorrect**

- accreditor scoring rules in `packages/utils`
- evidence approval policies in a global helper module
- SIS field transformation logic in a general-purpose shared package used by domain modules

---

## 3A. Logical entity model reference

The architecture documents define bounded contexts and ownership rules, but implementation work also needs a shared logical entity model. Use `docs/architecture/data-model/README.md` as the canonical entity reference for:

- logical entities and their fields
- expected data types and relationship shapes
- AI coding context for module and schema generation
- ERD artifacts under `docs/architecture/diagrams/`

The entity model is intentionally logical and accreditor-agnostic. It should evolve with the product vision and bounded-context definitions rather than being treated as a vendor-specific physical schema.

## 6. How to structure new modules and where new code should go

### 6.1 Default location for new business functionality

If the feature belongs to the core institutional platform, add it to the core modular monolith under `services/core-api/` in the appropriate bounded context module.

Example target shape:

```text
services/core-api/src/modules/evidence-management/
  domain/
  application/
  infrastructure/
  api/
```

### 6.2 Create a new bounded context only when justified

A new module is justified when:

- it has a distinct domain vocabulary
- it owns a cohesive set of business invariants
- it can be separated from adjacent concepts without forcing circular dependencies

Do **not** create a new module simply because a ticket is large.

### 6.3 Prefer extending an existing module when

- the new behavior is a natural part of its aggregate or process boundary
- the same records, policies, and workflows are already owned there
- splitting would create duplicate concepts or awkward synchronization

### 6.4 New module checklist

- Define the business capability and owning bounded context.
- Define its aggregates/entities/value objects.
- Define the application use cases and ports.
- Define needed adapters and persistence mappings.
- Define API contracts.
- Define audit, access-control, evidence, and workflow implications.
- Add tests at domain, application, and relevant integration/e2e levels.
- Add or update ADRs if the change affects architectural boundaries.

---

## 7. Integration principles and consistent handling of external systems

Integrations must be designed so that external source-system details do not leak into the accreditation domain.

### 7.1 Core integration rules

- use canonical internal models
- isolate source-system adapters
- avoid direct coupling to specific ERP schemas in domain modules
- perform translation at the edge
- prefer explicit mapping over hidden implicit transformations

### 7.2 Canonical model principle

The platform should define internal canonical concepts for things like:

- person/faculty profile references
- organizational units
- courses/programs
- outcomes/competencies
- evidence references
- document metadata

External systems are mapped into these canonical models before the core domain consumes them.

### 7.3 Adapter isolation principle

Vendor- or institution-specific adapters should live in the integration layer or infrastructure adapter layer, for example:

- Banner adapter
- PeopleSoft adapter
- Workday adapter
- Canvas adapter
- document repository adapter

Those adapters may understand source-system payloads, but the core domain should not.

### 7.4 Correct vs incorrect integration choices

**Correct**

- `integration-hub` translates Banner course payloads into a canonical curriculum model consumed by `curriculum-mapping`.
- `faculty-intelligence` receives normalized faculty qualification data through a port.
- document-system import code marks provenance and quarantine status before creating evidence records.

**Incorrect**

- `faculty-intelligence/domain` includes Workday field names as intrinsic properties.
- `assessment-improvement/domain` depends on Canvas webhook event shapes.
- `accreditation-frameworks` contains ERP synchronization jobs.

### 7.5 Integration data flow

A typical external-data flow should be:

1. external system emits or exposes data
2. adapter ingests data
3. adapter maps data to canonical internal schema
4. reconciliation/validation occurs
5. core application use case consumes canonical command/query input
6. domain state changes are recorded with audit/provenance metadata

---

## 8. AI service boundaries

AI is a supporting capability, not the institutional authority.

### 8.1 Mandatory AI rules

- AI outputs are advisory
- approvals remain human-controlled
- prompts, provenance, and citations should be logged where appropriate
- final institutional claims must come from governed workflows

### 8.2 Acceptable AI use cases

- summarize uploaded evidence for reviewer convenience
- classify or extract document metadata
- suggest narrative drafts
- propose curriculum-to-standard mappings
- identify potentially missing evidence or inconsistent references
- assist search and retrieval over governed content

### 8.3 Unacceptable AI use cases

- auto-approving evidence or submissions without a human workflow step
- publishing accreditor-facing claims directly from model output
- making AI-generated scoring the sole basis for compliance decisions
- bypassing provenance logging for AI-produced content used in reports

### 8.4 AI logging and provenance expectations

Where AI materially influences user-visible artifacts or decisions under review, record as appropriate:

- model/service used
- prompt or prompt template reference
- key inputs and retrieval references, subject to security/privacy rules
- output timestamp and request correlation id
- citations or provenance links when presented to users
- user review/acceptance actions when adopted into governed workflows

### 8.5 Python service boundary

Python may be used for AI/document-processing workloads, but:

- final workflow state remains in the core platform
- domain decisions remain governed by the core platform
- Python services should expose narrow, explicit service contracts
- Python services should not become hidden domain modules

---

## 9. Companion services and their relationship to the core

Companion services are allowed only where they improve the architecture rather than fragment it.

### 9.1 Good reasons to create or keep a companion service

- distinct scaling profile
- heavy asynchronous processing
- specialized libraries or runtime requirements
- operational isolation for failure containment
- clear boundary between system-of-record behavior and support processing

### 9.2 Poor reasons to create a companion service

- avoiding modular design inside the monolith
- personal framework preference
- ticket-based fragmentation
- early optimization without proven need

### 9.3 Expected companion service roles

- `ai-assistant` — advisory AI, extraction, summarization, classification
- `search-indexer` — search projection/index maintenance and retrieval support
- `notification-service` — delivery orchestration for email/SMS/in-app/webhooks
- `integration-hub` — external adapter mediation and synchronization orchestration

### 9.4 Rule of authority

If there is conflict between a companion service’s computed view and the core platform’s governed state, the **core platform wins**.

---

## 10. Compliance, security, accessibility, and quality expectations

These concerns are architectural requirements, not afterthoughts.

### 10.1 Accessibility-first

The platform must be accessibility-first in both web UI and workflow design.

Architectural implications:

- UI components should come from accessible shared design-system primitives where possible
- accessibility checks should be part of CI and repository-level tests
- document workflows should consider accessible export and review experiences

### 10.2 Auditability by default

Core actions should be designed so that material changes are traceable.

Expected audit coverage includes:

- evidence creation, update, replacement, linkage, and disposition
- workflow assignment and approval decisions
- report/narrative publication steps
- integration synchronization and reconciliation outcomes
- privileged administrative changes
- AI-assisted content adoption where relevant

### 10.3 Traceable evidence lineage

Evidence lineage must be preserved across ingestion, transformation, linkage, approval, and export.

The architecture should support:

- provenance metadata
- source references
- version relationships
- chain-of-custody style event traceability where needed
- quarantine and validation states for questionable imports

### 10.4 Role-based and attribute-aware access control

The platform should implement role-based and attribute-aware access control suited to universities.

This includes:

- organizational scoping
- committee/reviewer assignments
- cycle-specific permissions
- least-privilege defaults
- auditable privileged access

### 10.5 Security and privacy expectations

Architecturally, modules should assume:

- secure-by-default API and storage access
- explicit handling of institutional and personnel data
- secrets/config separation from code
- event and integration channel protections
- least privilege between services and adapters

---

## 11. ADRs (Architectural Decision Records)

ADRs should be stored in `docs/decisions/` and used for meaningful architectural choices.

### 11.1 Create an ADR when

- adding or removing a companion service
- changing a bounded context boundary
- changing the NestJS/Fastify platform direction
- introducing a new persistence or messaging strategy
- changing canonical integration models or eventing contracts
- altering AI governance or approval boundaries
- making a deliberate exception to a consistency rule in this document

### 11.2 ADR minimum contents

- title
- status
- date
- context
- decision
- alternatives considered
- consequences
- migration or follow-up actions

### 11.3 ADR rule

If a change is large enough that future contributors will wonder “why is it like this?”, write an ADR.

---

## 12. Implementation Consistency Rules

This section is intentionally explicit. Future implementation work should be evaluated against these rules.

### 12.1 Core platform rules

- New core business capabilities belong in the modular monolith by default.
- Use TypeScript for the main platform implementation.
- Use NestJS with Fastify for primary API composition rather than raw Express foundations.
- Keep modules aligned to bounded contexts, not arbitrary utility groupings.

### 12.2 Layering rules

- domain cannot depend on infrastructure
- application orchestrates use cases
- infrastructure implements ports/adapters
- api handles transport concerns only

### 12.3 Shared-code rules

- use a shared kernel sparingly
- no dumping business logic into generic utils
- do not hide domain rules in cross-cutting helper packages

### 12.4 Integration rules

- use canonical internal models
- isolate source-system adapters
- avoid direct coupling to specific ERP schemas in domain modules
- keep vendor-specific details out of accreditor and evidence domain concepts

### 12.5 AI rules

- AI outputs are advisory
- approvals remain human-controlled
- prompts, provenance, and citations should be logged where appropriate
- final institutional claims must come from governed workflows

### 12.6 Compliance/quality rules

- accessibility-first
- auditability by default
- traceable evidence lineage
- role-based and attribute-aware access control

### 12.7 Evolution rules

- start modular monolith first
- split to companion services only for clear operational or domain reasons
- prefer incremental convergence toward the target architecture over local convenience

### 12.8 Anti-patterns to reject

Reject or refactor changes that:

- add raw framework sprawl instead of following the platform stack
- leak ERP/SIS/HRIS/LMS payload structures into domain entities
- place approval or evidence logic directly in controllers
- use AI output as final authority
- introduce microservices without architectural justification
- bypass audit/compliance requirements because a workflow is “internal only”

---

## 13. How to evaluate whether a change is architecturally consistent

Use this checklist before merging major work.

### 13.1 Architecture consistency checklist

- Does the change fit an existing bounded context? If not, is a new bounded context clearly justified?
- Is the default implementation inside the modular monolith unless there is a strong reason otherwise?
- Does the module preserve `domain`, `application`, `infrastructure`, and `api` boundaries?
- Does the domain remain free of framework, storage, and vendor-specific dependencies?
- Are use cases orchestrated in `application` rather than controllers or repositories?
- Are external systems accessed through adapters and canonical internal models?
- Does the change avoid embedding ERP/SIS/HRIS/LMS schemas in domain modules?
- If AI is involved, are outputs advisory, logged, reviewable, and excluded from automatic institutional authority?
- Are auditability, approvals, evidence lineage, and access control explicitly considered?
- Does the implementation preserve accessibility expectations for user-facing flows?
- Is shared code truly cross-cutting and stable, rather than misplaced domain logic?
- If the change alters architecture or makes an exception, was an ADR added or updated?

### 13.2 Simple evaluation rule

If a change is easier in the short term but weakens module boundaries, leaks integrations into the core domain, bypasses workflow/audit patterns, or treats AI as authoritative, it is **not** architecturally consistent.

---

## 14. Quick examples: correct vs incorrect choices

### Correct

- Add a new accreditor rule pack under `accreditation-frameworks` while preserving the accreditor-agnostic core model.
- Add a new evidence ingestion adapter that maps SharePoint metadata into canonical evidence import commands.
- Add AI-assisted narrative drafting as a companion capability whose outputs must be reviewed and approved in workflow.
- Add a new workflow step in `workflow-approvals` and expose it through thin API controllers.

### Incorrect

- Model ABET terms as universal domain primitives when they do not generalize across accreditors.
- Put Banner-specific curriculum fields directly into `curriculum-mapping/domain` entities.
- Store approval state only in a notification service because it already sends workflow emails.
- Let an LLM publish final narrative text without institutional review and traceability.

---

## 15. Guidance for future prompts and contributors

Future prompts may cite the following directly:

> Follow the architecture guardrails in `README.md` and `docs/architecture/README.md`. Do not introduce architectural patterns that conflict with them.

In practice, that means:

- preserve modular boundaries
- keep integrations outside the core domain
- keep AI in bounded supporting services
- do not introduce raw framework sprawl
- do not bypass audit/compliance patterns
- prefer consistency with existing module/layer patterns over convenience

When current code differs from this target state, the correct response is to move incrementally toward this architecture rather than entrench the inconsistency.
