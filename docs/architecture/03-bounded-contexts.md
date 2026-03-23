# 03 Bounded Contexts

## Purpose

This document defines the target bounded contexts for the core platform and how they map to the repository. It is the reference for deciding where new domain behavior belongs.

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

Owns:

- authenticated platform identities (`User`) and non-human workload identities (`ServicePrincipal`)
- roles, permissions, and scoped role assignments
- access attributes used for policy evaluation

Depends on:

- canonical `Person` and institutional scope references from `organization-registry`
- cycle/review-team scope references from `accreditation-frameworks`
- external identity providers via infrastructure adapters

### `organization-registry`

Owns:

- tenant institutions and canonical people (`Person`)
- institutional hierarchy (`OrganizationUnit`) and governance bodies (`Committee`)
- stable organization/person references used by every other context

Depends on:

- integration-fed canonical person/organization data from mapping boundaries

### `accreditation-frameworks`

Owns:

- accreditors, frameworks, framework versions, standards, criteria, and `CriterionElement`
- accreditation engagements: `AccreditationCycle`, `AccreditationScope`, `CycleMilestone`, `ReviewEvent`, and `DecisionRecord`
- reviewer operations: `ReviewerProfile`, `ReviewTeam`, and `ReviewTeamMembership`
- framework-defined `EvidenceRequirement` metadata and extension points

Depends on:

- canonical program and organization references from `curriculum-mapping` and `organization-registry`
- rule-pack definitions and mapping metadata

### `evidence-management`

Owns:

- governed evidence metadata, artifacts, provenance, requests, reviews, and retention policies
- `EvidenceReference` citation/linking rules into other bounded contexts
- references to artifacts in `storage/evidence` and `storage/quarantined`

Depends on:

- object storage adapters
- integration import provenance
- allowed target aggregate contracts from other bounded contexts

### `assessment-improvement`

Owns:

- `AssessmentPlan`, `AssessmentMeasure`, `AssessmentInstrument`, `BenchmarkTarget`, and `AssessmentResult`
- findings, action plans, action-plan tasks, and `ImprovementClosureReview`
- continuous-improvement rules that trace outcomes back to measures and targets

Depends on:

- curriculum mappings and canonical academic structures
- evidence references and accreditation alignment targets

### `workflow-approvals`

Owns:

- workflow templates, runtime submissions, assignments, and decisions
- workflow comments, delegations, escalation events, and immutable submission snapshots/packages
- approval routing and review auditability

Depends on:

- identity and organization scoping
- evidence, reporting, assessment, and accreditation-cycle targets

### `narratives-reporting`

Owns:

- narrative sections, report assembly state, export packages, and rendering jobs
- section-level alignment to standards, criteria, or criterion elements

Depends on:

- approved evidence and workflow package state
- optional AI draft suggestions (advisory only)

### `faculty-intelligence`

Owns:

- accreditation-oriented faculty profiles and activities
- faculty appointments, deployments, qualification basis, qualification status, and qualification reviews
- faculty analytics surfaces used for accreditation sufficiency/qualification analysis

Depends on:

- canonical faculty/person/activity feeds from the integration boundary
- curriculum, evidence, and framework references

### `curriculum-mapping`

Owns:

- canonical academic structure: `Program`, `Course`, `AcademicTerm`, `CourseSection`, `LearningOutcome`, and `Competency`
- program/course/outcome mappings and standards alignments
- mapping review status and traceability

Depends on:

- canonical course/program/person data
- accreditor-framework mappings

### `compliance-audit`

Owns:

- audit query views, immutable audit events, control attestations, and policy exception records
- compliance monitoring views spanning other contexts

Depends on:

- event and state signals from all contexts

### `shared`

Owns:

- stable cross-cutting primitives only (no business policy ownership)

Depends on:

- nothing that introduces domain leakage

## Context Interaction Rules

- dependencies flow through application interfaces and published contracts
- contexts do not import each other's infrastructure internals
- vendor/system payloads stay outside core domain contexts
- cross-context coordination is explicit in use cases, events, or orchestration layers
- `Person` remains the canonical human concept; `User`, `ReviewerProfile`, and `FacultyProfile` are context-specific projections

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

Do not create contexts based only on ticket size or team convenience.
