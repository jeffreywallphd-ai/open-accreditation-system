# 03 Bounded Contexts

This document defines the target bounded contexts for the core platform, how they map to the repository, and the aggregate ownership rules that future implementation should preserve. Use it with the [architecture overview](./README.md#architecture-reference), the [integration architecture](./04-integration-architecture.md#04-integration-architecture), and the [entity model reference](./data-model/README.md#entity-model-reference).

## Table of contents

- [Purpose](#purpose)
- [Core context map](#core-context-map)
- [Ownership matrix](#ownership-matrix)
  - [`identity-access`](#identity-access)
  - [`organization-registry`](#organization-registry)
  - [`accreditation-frameworks`](#accreditation-frameworks)
  - [`evidence-management`](#evidence-management)
  - [`assessment-improvement`](#assessment-improvement)
  - [`workflow-approvals`](#workflow-approvals)
  - [`narratives-reporting`](#narratives-reporting)
  - [`faculty-intelligence`](#faculty-intelligence)
  - [`curriculum-mapping`](#curriculum-mapping)
  - [`compliance-audit`](#compliance-audit)
  - [`shared`](#shared)
- [Context interaction rules](#context-interaction-rules)
- [Internal layering standard per context](#internal-layering-standard-per-context)
- [Fit guidance for new work](#fit-guidance-for-new-work)

## Purpose

This is the reference for deciding where new domain behavior belongs. It makes aggregate ownership explicit so data-model decisions in [the entity model reference](./data-model/README.md#bounded-context-entity-baseline) do not drift during implementation or AI-assisted code generation.

## Core Context Map

Primary module root: `services/core-api/src/modules`

Defined contexts:

- `identity-access`
- `organization-registry`
- `accreditation-frameworks`
- `evidence-management`
- `assessment-improvement`
- `workflow-approvals`
- `narratives-reporting`
- `faculty-intelligence`
- `curriculum-mapping`
- `compliance-audit`
- `shared` (limited shared kernel only)

## Ownership Matrix

### `identity-access`

**Owns**

- authenticated platform identities (`User`) and non-human workload identities (`ServicePrincipal`)
- roles, permissions, and scoped role assignments
- access attributes used for policy evaluation

**Depends on**

- canonical `Person` and institutional scope references from `organization-registry`
- cycle/review-team scope references from `accreditation-frameworks`
- external identity providers via infrastructure adapters

**Aggregate model**

- Aggregate roots: `User`, `Role`, `ServicePrincipal`
- Owned children:
  - `Role` owns `RolePermissionGrant` records
  - `User` owns `UserRoleAssignment` records
- External referencing rules:
  - `RolePermissionGrant` and `UserRoleAssignment` may be referenced by audit/event records but should not be treated as independent write targets from other contexts
- Mutability rules:
  - `User` is mutable in place for current account status and access attributes
  - `UserRoleAssignment` is supersedable/effective-dated; do not rewrite past scope periods
  - `RolePermissionGrant` is mutable by governed administration but changes must be audit logged
  - `ServicePrincipal` is mutable in place for credential rotation metadata, never for impersonating humans

### `organization-registry`

**Owns**

- tenant institutions and canonical people (`Person`)
- institutional hierarchy (`OrganizationUnit`) and governance bodies (`Committee`)
- stable organization/person references used by every other context

**Depends on**

- integration-fed canonical person/organization data from mapping boundaries

**Aggregate model**

- Aggregate roots: `Institution`, `Person`, `OrganizationUnit`, `Committee`
- Owned children: none in this phase beyond hierarchy self-references and aliases managed internally
- External referencing rules:
  - all four roots may be referenced externally by stable IDs
  - hierarchy links are not independent aggregates and are managed only through `OrganizationUnit`
- Mutability rules:
  - `Institution`, `Person`, `OrganizationUnit`, and `Committee` are mutable in place for current state
  - important identity, status, and hierarchy changes should remain audit visible

**Aggregate notes**

- `Person` is the canonical human entity. Other contexts may project it into `User`, `ReviewerProfile`, or `FacultyProfile`, but must not redefine the canonical person record.
- Committee roster governance is anticipated but deferred; see the deferred entity notes in the [entity model reference](./data-model/README.md#deferred-later-phase-entities).

### `accreditation-frameworks`

**Owns**

- accreditors, frameworks, framework versions, standards, criteria, and `CriterionElement`
- accreditation engagements: `AccreditationCycle`, `AccreditationScope`, `CycleMilestone`, `ReportingPeriod`, `ReviewEvent`, and `DecisionRecord`
- reviewer operations: `ReviewerProfile`, `ReviewTeam`, and `ReviewTeamMembership`
- framework-defined `EvidenceRequirement` metadata and extension points

**Depends on**

- canonical program and organization references from `curriculum-mapping` and `organization-registry`
- rule-pack definitions and mapping metadata

**Aggregate model**

- Aggregate roots: `Accreditor`, `AccreditationFramework`, `FrameworkVersion`, `AccreditationCycle`, `ReviewTeam`, `ReviewerProfile`
- Owned children:
  - `FrameworkVersion` owns `Standard`, `Criterion`, `CriterionElement`, and `EvidenceRequirement`
  - `AccreditationCycle` owns `AccreditationScope`, `CycleMilestone`, `ReportingPeriod`, `ReviewEvent`, and cycle-level `DecisionRecord`
  - `AccreditationScope` owns `AccreditationScopeProgram` and `AccreditationScopeOrganizationUnit`
  - `ReviewTeam` owns `ReviewTeamMembership`
  - `ReviewEvent` may own event-scoped `DecisionRecord` entries
- External referencing rules:
  - `Standard`, `Criterion`, `CriterionElement`, `EvidenceRequirement`, `AccreditationScope`, `CycleMilestone`, `ReviewEvent`, and `DecisionRecord` may be referenced externally by ID for alignment, evidence, workflow, and reporting
  - only the owning root context may mutate them
  - program/organization scope IDs are validated through published `curriculum-mapping` and `organization-registry` application interfaces, never by direct cross-context persistence access
- Mutability rules:
  - framework structure under `FrameworkVersion` is supersedable/versioned, not overwritten in place once published for active use
  - `AccreditationCycle` is mutable in place for current operational state
  - `CycleMilestone`, `ReportingPeriod`, `ReviewEvent`, and `ReviewTeamMembership` are effective-dated/supersedable with audit history
  - `DecisionRecord` is append-only after issuance except for explicit superseding or correction links

**Aggregate notes**

- `ReviewTeamMembership` is sufficient in v1 for team roster, responsibility scope, and primary reviewer-role semantics. Finer-grained event participation or task assignment is deferred to `ReviewEventParticipant` and `ReviewerAssignment` if needed later.
- `ReviewEvent` references a participating `ReviewTeam`, but the team remains the authority for roster membership; event-specific participation beyond the team roster is a later-phase extension.

### `evidence-management`

**Owns**

- governed evidence metadata, artifacts, provenance, requests, reviews, and retention policies
- `EvidenceReference` citation/linking rules into other bounded contexts
- references to artifacts in `storage/evidence` and `storage/quarantined`

**Depends on**

- object storage adapters
- integration import provenance
- allowed target aggregate contracts from other bounded contexts

**Aggregate model**

- Aggregate roots: `EvidenceItem`, `EvidenceCollection`, `EvidenceRequest`, `EvidenceRetentionPolicy`
- Owned children:
  - `EvidenceItem` owns `EvidenceArtifact`, `EvidenceReference`, and `EvidenceReview`
- External referencing rules:
  - `EvidenceItem` and `EvidenceCollection` may be referenced across contexts
  - `EvidenceReference` and `EvidenceReview` may be read externally for traceability but are not independent write targets outside this context
- Mutability rules:
  - `EvidenceItem` is mutable in place for current metadata and lifecycle state
  - `EvidenceArtifact` is append-only per stored artifact/version
  - `EvidenceReference` is append-only/supersedable, never silently rewritten
  - `EvidenceReview` is append-only for completed review actions
  - `EvidenceRequest` is mutable in place for open/fulfilled/cancelled state, with immutable status-change history captured by events
  - `EvidenceRetentionPolicy` is supersedable/versioned

**Current implementation note (Epic 2 Phase 1 foundation)**

- `EvidenceItem` is implemented as a first-class aggregate in `services/core-api`.
- `EvidenceItem` classification is constrained to canonical evidence types (`document`, `metric`, `narrative`, `dataset`, `assessment-artifact`) and provenance types (`manual`, `upload`, `integration`).
- `EvidenceItem` lifecycle status (`draft`, `active`, `superseded`, `incomplete`, `archived`) is separate from workflow approval state.
- Lifecycle transitions are explicit and enforced in the aggregate:
  - `draft -> incomplete | active | archived`
  - `incomplete -> draft | archived`
  - `active -> incomplete | superseded | archived`
  - `superseded` and `archived` are terminal in Phase 1.
- Usability is modeled explicitly from evidence lifecycle + completeness + artifact requirements + available artifacts.
- The aggregate enforces artifact ownership (`EvidenceArtifact.evidenceItemId` must match owning `EvidenceItem.id`) and exposes a computed "current artifact" as the most recent `available` artifact.
- Binary/file storage metadata is modeled in `EvidenceArtifact`, not in `EvidenceItem`.
- Activation is gated by required evidence metadata (`description` and at least one of `reportingPeriodId`/`reviewCycleId`), completeness, and artifact requirements.
- Artifact requirements are domain-driven: `upload` sources and evidence types `document`, `dataset`, `assessment-artifact` require an available artifact for activation; `metric`/`narrative` may activate without an artifact when sourced by `manual`/`integration`.
- Artifact registration is limited to editable statuses (`draft`, `incomplete`) in this phase; `active`, `superseded`, and `archived` do not allow artifact mutation.
- `superseded` and `archived` statuses are terminal for lifecycle transitions in this phase.
- Supersession orchestration validates successor existence and institution alignment before calling aggregate transitions.
- Supersession orchestration now enforces lineage-consistent successor linkage (`same evidenceLineageId`, `successor.supersedesEvidenceItemId = predecessor.id`, and `successor.versionNumber = predecessor.versionNumber + 1`).
- `EvidenceItem` now carries version-lineage semantics (`evidenceLineageId`, `versionNumber`, `supersedesEvidenceItemId`, `supersededByEvidenceItemId`) so superseding revisions can preserve historical records.
- Application-layer use cases include explicit superseding-version creation (`createSupersedingEvidenceVersion`) in addition to governed status transitions.
- `EvidenceReference` is implemented as an append-only owned child on `EvidenceItem`, with accreditation-centered target types (`criterion`, `criterion-element`, `learning-outcome`, `narrative-section`) and governed relationship semantics.
- `EvidenceReference` target admissibility is validated centrally in the evidence-management application layer through target-type validator contracts, with target existence checks delegated to owning bounded-context application interfaces.
- `EvidenceReference` input normalization is governed (`targetType`, `targetEntityId`, `relationshipType`, `rationale`, `anchorPath`) with target-specific anchor rules (for example, `narrative-section` requires `anchorPath`).
- Persistence and repository boundaries enforce append-only behavior for artifacts and references and reject in-place mutation of evidence identity/version-anchor fields.
- Repository save paths rehydrate/validate aggregate snapshots before persistence so invalid in-memory mutation cannot bypass domain invariants.
- Application-layer retrieval now supports lineage/current-version queries and reference-target queries (criterion/subcriterion/outcome retrieval foundations) without introducing a reporting-engine abstraction.
- Application-layer retrieval now includes explicit query/use-case foundations for:
  - reference-target retrieval (`criterion`, `criterion-element`, `learning-outcome`, `narrative-section`)
  - `current` vs `historical` lineage-aware retrieval
  - linkage-context projection (evidence + matching reference subset)
  - governed usability filters (`isUsable`, `hasAvailableArtifact`, `requiresArtifactForActivation`)
  - cycle-anchor filters (`reviewCycleId`, `reportingPeriodId`) and lineage cycle-readiness summaries for cross-cycle evolution, including within-cycle vs cross-cycle supersession classification.

### `assessment-improvement`

**Owns**

- `AssessmentPlan`, `AssessmentMeasure`, `AssessmentInstrument`, `BenchmarkTarget`, and `AssessmentResult`
- findings, action plans, action-plan tasks, and `ImprovementClosureReview`
- continuous-improvement rules that trace outcomes back to measures and targets

**Depends on**

- curriculum mappings and canonical academic structures
- evidence references and accreditation alignment targets

**Aggregate model**

- Aggregate roots: `AssessmentPlan`, `AssessmentInstrument`, `AssessmentResult`, `Finding`, `ActionPlan`
- Owned children:
  - `AssessmentPlan` owns `AssessmentMeasure` and plan-scoped `BenchmarkTarget`
  - `ActionPlan` owns `ActionPlanTask` and `ImprovementClosureReview`
- External referencing rules:
  - `AssessmentPlan`, `AssessmentMeasure`, `BenchmarkTarget`, `AssessmentResult`, `Finding`, and `ActionPlan` may be referenced externally by ID
  - `ActionPlanTask` and `ImprovementClosureReview` are read externally for traceability, but written only via `ActionPlan`
- Mutability rules:
  - `AssessmentPlan`, `AssessmentMeasure`, and `BenchmarkTarget` are supersedable/version-aware
  - `AssessmentInstrument` is mutable in place for working drafts, versioned when reused materially across governed periods
  - `AssessmentResult` and `Finding` are append-only after finalization, with correction via superseding records
  - `ImprovementClosureReview` is append-only

**Aggregate notes**

- `AssessmentMeasure` is not a top-level ownership root in the write model even if it is frequently queried independently. It remains owned by `AssessmentPlan` so scope and outcome alignment cannot drift.

### `workflow-approvals`

**Owns**

- workflow templates, runtime submissions, assignments, and decisions
- workflow comments, delegations, escalation events, and immutable submission snapshots/packages
- approval routing and review auditability

**Depends on**

- identity and organization scoping
- evidence, reporting, assessment, and accreditation-cycle targets

**Aggregate model**

- Aggregate roots: `WorkflowTemplate`, `Submission`
- Owned children:
  - `WorkflowTemplate` owns `WorkflowStep`
  - `Submission` owns `WorkflowAssignment`, `WorkflowDecision`, `WorkflowComment`, `WorkflowDelegation`, `WorkflowEscalationEvent`, and `SubmissionSnapshot`
  - `SubmissionSnapshot` owns `SubmissionPackageItem`
- External referencing rules:
  - `Submission` and `SubmissionSnapshot` may be referenced externally by ID
  - child records may be cited for auditability but are not independent write targets
- Mutability rules:
  - `WorkflowTemplate` and `WorkflowStep` are mutable draft definitions, versioned when published for runtime use
  - `WorkflowAssignment` is append-only for reassignment history
  - `WorkflowDecision`, `WorkflowComment`, `WorkflowDelegation`, and `WorkflowEscalationEvent` are append-only facts
  - `SubmissionSnapshot` and `SubmissionPackageItem` are immutable after creation

**Current implementation note (Phase 3 inner-layer foundation)**

- `workflow-approvals` now includes a dedicated `ReviewCycle` aggregate for workflow-governed cycle orchestration (`not-started`, `active`, `completed`, `archived`) that is separate from evidence lifecycle state.
- `ReviewCycle` enforces strict date ordering (`startDate < endDate`) and scoped active-cycle uniqueness (`institution + canonicalized scope`).
- `ReviewCycle` critical governance fields (`startDate`, `endDate`, `programIds`, `organizationUnitIds`, `evidenceSetIds`) are immutable once status is `completed` or `archived`; repository save boundaries enforce this to prevent in-memory mutation bypass.
- `workflow-approvals` now includes a `ReviewWorkflow` aggregate tied to a `ReviewCycle` and a target context (for example report section or evidence grouping), with explicit workflow states:
  - `draft`
  - `in-review`
  - `revision-required`
  - `approved`
  - `submitted`
- Workflow transitions are governed by explicit domain transition maps and role policy (`faculty`, `reviewer`, `admin`) with append-only transition history.
- `ReviewWorkflow` exposes explicit transition methods (`submitForReview`, `requestRevision`, `returnToDraft`, `approve`, `submitFinal`) and preserves a compatibility transition entrypoint for orchestrated use-case routing.
- Transition history is sequence-backed and reconstruction-validated (`transition_sequence` persistence + aggregate checks for contiguous state-chain progression and terminal state consistency), and stores actor role plus optional actor identity (`actorId`) with timestamp/reason/evidence-readiness summary.
- Workflow transition-history persistence is append-only at both repository and storage boundaries (immutable transition records; no in-place mutation/deletion).
- Evidence integration is reference-based (`evidenceItemIds`, `evidenceCollectionId`) and evaluated through an evidence-management application contract (`evaluateWorkflowEvidenceReadiness`) with explicit readiness policy input; workflow state is not embedded in `EvidenceItem`.
- `ReviewWorkflow.evidenceCollectionId` must reference a collection/set key declared on `ReviewCycle.evidenceSetIds`, preserving cycle-level container ownership while delegating evidence readiness/usability evaluation to evidence-management.
- `EvidenceItem.evidenceSetIds` is evidence-owned metadata used for collection/set readiness evaluation; workflow references set keys but does not own evidence membership semantics.
- Approval/submission readiness policies now evaluate: referenced evidence presence/usability/currentness, superseded evidence exclusion, and target-scoped collection sufficiency (for example report-section scoped readiness) without duplicating evidence lifecycle rules in workflow.
- Governed decision transitions (`approved`, `submitted`) require a positive readiness evaluation and require evidence presence via referenced items and/or collection-scoped usable evidence.
- `ReviewWorkflow` is unique per (`reviewCycleId`, `targetType`, `targetId`) so cycle-target state retrieval remains deterministic.
- The `workflow-approvals` application layer exposes explicit use cases:
  - `createReviewCycle`
  - `startReviewCycle`
  - `completeReviewCycle`
  - `createWorkflowInstance`
  - `transitionWorkflowState`
  - `getWorkflowState` (cycle-wide and cycle-target variants)
- The workflow application service requires the evidence-readiness contract and does not allow governed transitions (`approved`, `submitted`) to bypass evidence evaluation.
- Persistence and application/integration tests now cover round-trip reconstruction for cycle/workflow state, minimal transition history, evidence integration references, role policy enforcement, and evidence-gated transition behavior (missing/incomplete/unusable/superseded vs sufficient/current evidence).

### `narratives-reporting`

**Owns**

- narrative sections, report assembly state, export packages, and rendering jobs
- section-level alignment to standards, criteria, or criterion elements

**Depends on**

- approved evidence and workflow package state
- optional AI draft suggestions (advisory only)

**Aggregate model**

- Aggregate roots: `Narrative`, `ReportPackage`, `ExportJob`
- Owned children:
  - `Narrative` owns `NarrativeSection`
- External referencing rules:
  - `Narrative` and `NarrativeSection` may be targeted by evidence references and workflow packages
  - `NarrativeSection` is externally referencable by stable ID but remains owned by `Narrative`
- Mutability rules:
  - `Narrative` is mutable in place for current authoring state
  - `NarrativeSection` is mutable while drafting and supersedable/version-captured once submitted or snapshot-bound
  - `ReportPackage` is mutable until finalized
  - `ExportJob` is append-only per execution attempt

### `faculty-intelligence`

**Owns**

- accreditation-oriented faculty profiles and activities
- faculty appointments, deployments, qualification basis, qualification status, and qualification reviews
- faculty analytics surfaces used for accreditation sufficiency/qualification analysis

**Depends on**

- canonical faculty/person/activity feeds from the integration boundary
- curriculum, evidence, and framework references

**Aggregate model**

- Aggregate roots: `FacultyProfile`, `FacultyQualification`
- Owned children:
  - `FacultyProfile` owns `FacultyAppointment`, `FacultyDeployment`, and `FacultyActivity`
  - `FacultyQualification` owns `QualificationBasis` and `QualificationReview`
- External referencing rules:
  - `FacultyProfile`, `FacultyQualification`, `FacultyDeployment`, and `QualificationBasis` may be referenced externally for evidence, workflow, and analytics
  - child records are still written only via their owning aggregate
- Mutability rules:
  - `FacultyProfile` is mutable in place for current projection state
  - `FacultyAppointment` and `FacultyDeployment` are effective-dated/supersedable
  - `FacultyActivity` is append-only by activity occurrence
  - `FacultyQualification` is supersedable
  - `QualificationBasis` and `QualificationReview` are append-only

### `curriculum-mapping`

**Owns**

- canonical academic structure: `Program`, `Course`, `AcademicTerm`, `CourseSection`, `LearningOutcome`, and `Competency`
- program/course/outcome mappings and standards alignments
- mapping review status and traceability

**Depends on**

- canonical course/program/person data
- accreditor-framework mappings

**Aggregate model**

- Aggregate roots: `Program`, `Course`, `AcademicTerm`, `CourseSection`, `LearningOutcome`, `Competency`
- Owned children:
  - `Program` owns `ProgramOutcomeMap`
  - `Course` owns `CourseOutcomeMap`
  - `StandardsAlignment` is owned by the aligning aggregate that publishes it
- External referencing rules:
  - all roots may be referenced externally by stable ID
  - mapping children may be referenced externally for traceability, but are not written outside this context
- Mutability rules:
  - `Program`, `Course`, `AcademicTerm`, `CourseSection`, `LearningOutcome`, and `Competency` are mutable in place for current canonical state
  - outcome maps and alignments are supersedable/version-aware

**Aggregate notes**

- `CourseSection` is treated as a root because many other contexts need stable delivery-level references without traversing course internals.
- `AcademicTerm` is also a root because it serves as a shared temporal scope for curriculum, assessment, and faculty deployment.
- Current `core-api` phase-0 groundwork includes minimal assessment linkage anchors (`Assessment`, `AssessmentOutcomeLink`, `AssessmentArtifact`) in this context to support evidence-traceable relationships prior to the full `assessment-improvement` implementation. Treat these as transitional ownership for implementation continuity.

### `compliance-audit`

**Owns**

- audit query views, immutable audit events, control attestations, and policy exception records
- compliance monitoring views spanning other contexts

**Depends on**

- event and state signals from all contexts

**Aggregate model**

- Aggregate roots: `AuditEvent`, `ControlAttestation`, `PolicyException`
- Owned children: none in this phase
- External referencing rules:
  - all roots may be referenced for governance and reporting
- Mutability rules:
  - `AuditEvent` is append-only
  - `ControlAttestation` and `PolicyException` are append-only with superseding records for renewals or revisions

### `shared`

**Owns**

- stable cross-cutting primitives only (no business policy ownership)

**Depends on**

- nothing that introduces domain leakage

**Aggregate model**

- Aggregate roots: none; shared is not a business domain
- Owned children: none
- External referencing rules:
  - shared types may be imported only when they are generic primitives or transport-neutral helper constructs
- Mutability rules:
  - shared contracts should be low-volatility and versioned deliberately

## Context Interaction Rules

- dependencies flow through application interfaces and published contracts
- contexts do not import each other's infrastructure internals
- vendor/system payloads stay outside core domain contexts and follow the [integration architecture canonical-contract rules](./04-integration-architecture.md#canonical-contracts)
- cross-context coordination is explicit in use cases, events, or orchestration layers
- `Person` remains the canonical human concept; `User`, `ReviewerProfile`, and `FacultyProfile` are context-specific projections
- aggregate children may be referenced externally by stable IDs for traceability, but ownership and mutation stay with the defining bounded context

## Internal Layering Standard Per Context

Each context follows:

```text
<context>/
  domain/
  application/
  infrastructure/
  api/
```

Rules:

- `domain` has business invariants only
- `application` orchestrates use cases and ports
- `infrastructure` implements adapters and persistence
- `api` handles transport mapping only

## Fit Guidance for New Work

Put work in an existing context unless a new bounded context is justified by:

- distinct language and ownership
- cohesive invariants
- low coupling to current contexts

Do not create contexts based only on ticket size or team convenience. When uncertain, anchor the decision to the aggregate ownership described here and the entity semantics in the [entity model reference](./data-model/README.md#modeling-decisions-and-tradeoffs).
