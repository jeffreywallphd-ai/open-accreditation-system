# Entity Model Reference

This document translates the architectural intent in the repository README and `docs/architecture/*` into a logical entity model for the Open Accreditation System.

It is designed for two audiences:

- architects and developers who need a shared domain model before implementation
- AI coding tools that need concrete, normalized entity definitions, field names, data types, and relationship expectations

This is a **logical data model**, not a finalized physical database schema. It is intentionally accreditor-agnostic and maps to the bounded contexts defined in `docs/architecture/03-bounded-contexts.md`.

## Modeling conventions

### Identifier and type conventions

Unless a module has a stronger reason to do otherwise, prefer these platform-wide conventions:

- `uuid`: primary identifiers for governed records
- `text`: human-readable names, titles, summaries, and external identifiers
- `enum`: constrained state, type, channel, or decision values
- `boolean`: policy or status flags
- `date`: cycle boundaries and due dates without time-of-day significance
- `timestamptz`: auditable created/updated/submitted/approved timestamps
- `jsonb`: controlled extensibility for accreditor-specific or integration-specific metadata
- `integer`: counters, ordering, durations, retry counts, and version numbers

### Cross-cutting modeling rules

- Every governed entity should include `id`, `createdAt`, and `updatedAt`.
- Workflow-significant entities should also include actor references and status fields.
- Accreditor-specific concepts must extend the shared model through framework/version/rule entities rather than by hard-coding accreditor-specific fields into unrelated entities.
- External-system identifiers belong in integration mapping entities, not in the core business meaning of domain entities.
- Object storage references should be metadata-only in the core model; binary content lives in storage.

## Diagram artifacts

- Image: `docs/architecture/diagrams/open-accreditation-entity-relationship.svg`
- Structured graph exchange: `docs/architecture/diagrams/open-accreditation-entity-relationship.graphml`
- AI coding context: `docs/architecture/data-model/entities.ai-context.json`

![Open Accreditation System logical ERD](../diagrams/open-accreditation-entity-relationship.svg)

## Coverage summary by bounded context

| Context | Core entities in this document |
| --- | --- |
| `identity-access` | `User`, `Role`, `Permission`, `RolePermissionGrant`, `UserRoleAssignment`, `ServicePrincipal` |
| `organization-registry` | `Institution`, `OrganizationUnit`, `Committee` |
| `accreditation-frameworks` | `Accreditor`, `AccreditationFramework`, `FrameworkVersion`, `Standard`, `Criterion`, `AccreditationCycle` |
| `evidence-management` | `EvidenceItem`, `EvidenceArtifact`, `EvidenceLink`, `EvidenceCollection` |
| `assessment-improvement` | `Program`, `Course`, `LearningOutcome`, `AssessmentResult`, `Finding`, `ActionPlan`, `ActionPlanTask` |
| `workflow-approvals` | `WorkflowTemplate`, `Submission`, `WorkflowStep`, `WorkflowAssignment`, `WorkflowDecision` |
| `narratives-reporting` | `Narrative`, `NarrativeSection`, `ReportPackage`, `ExportJob` |
| `faculty-intelligence` | `FacultyProfile`, `FacultyQualification`, `FacultyActivity` |
| `curriculum-mapping` | `Competency`, `ProgramOutcomeMap`, `CourseOutcomeMap`, `StandardsAlignment` |
| `compliance-audit` | `AuditEvent`, `ControlAttestation`, `PolicyException` |
| companion/supporting concerns | `SourceSystem`, `IntegrationMapping`, `SyncJob`, `Notification`, `AIArtifact` |

## Logical entities

### 1. Identity and access

#### `User`

Represents an authenticated human platform user.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `externalSubjectId` | `text` | Stable subject identifier from the identity provider. |
| `email` | `text` | Normalized login/contact email. |
| `displayName` | `text` | Preferred display name. |
| `status` | `enum(active, invited, suspended, deactivated)` | Platform account state. |
| `lastLoginAt` | `timestamptz` | Most recent successful sign-in. |
| `accessAttributes` | `jsonb` | ABAC claims such as campus scope, cycle scope, delegate flags. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution`
- has many `UserRoleAssignment`
- can author `EvidenceItem`, `NarrativeSection`, `AssessmentResult`, `Submission`, and `WorkflowDecision`
- can receive many `WorkflowAssignment` and `Notification` records

#### `Role`

Represents a reusable role definition such as accreditation administrator, faculty contributor, dean approver, or audit reviewer.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | Nullable for global/system roles; otherwise institution-scoped. |
| `name` | `text` | Unique role name within scope. |
| `description` | `text` | Human-readable purpose. |
| `scopeType` | `enum(global, institution, organization, cycle)` | Where the role may be assigned. |
| `isSystemRole` | `boolean` | Indicates seeded/governed role definitions. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to zero or one `Institution`
- has many `Permission` records through role-to-permission membership
- has many `UserRoleAssignment`

#### `Permission`

Represents an atomic action or policy capability evaluated by application use cases.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `code` | `text` | Stable machine-readable code, e.g. `evidence.approve`. |
| `resourceType` | `text` | Target aggregate or resource family. |
| `action` | `text` | Action verb. |
| `description` | `text` | Human-readable explanation. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- can belong to many `Role` records

#### `RolePermissionGrant`

Represents the governed membership of a permission in a role definition.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `roleId` | `uuid` | FK to `Role`. |
| `permissionId` | `uuid` | FK to `Permission`. |
| `effect` | `enum(allow, deny)` | Supports explicit allow/deny semantics. |
| `constraints` | `jsonb` | Optional conditional scope constraints. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Role`
- belongs to one `Permission`

#### `UserRoleAssignment`

Represents a role binding for a user, optionally scoped to an organization unit, committee, or accreditation cycle.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `userId` | `uuid` | FK to `User`. |
| `roleId` | `uuid` | FK to `Role`. |
| `organizationUnitId` | `uuid` | Nullable FK to `OrganizationUnit`. |
| `committeeId` | `uuid` | Nullable FK to `Committee`. |
| `accreditationCycleId` | `uuid` | Nullable FK to `AccreditationCycle`. |
| `effectiveFrom` | `date` | Start of assignment. |
| `effectiveTo` | `date` | Nullable end of assignment. |
| `assignmentStatus` | `enum(active, expired, revoked)` | Lifecycle status. |
| `grantedByUserId` | `uuid` | FK to `User` for auditability. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `User`
- belongs to one `Role`
- may belong to one `OrganizationUnit`, `Committee`, and/or `AccreditationCycle`

#### `ServicePrincipal`

Represents a non-human workload identity for integrations, search, AI, or notification services.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `name` | `text` | Unique service identity name. |
| `serviceType` | `enum(core, integration, ai, search, notification, batch)` | Workload class. |
| `status` | `enum(active, disabled, rotated)` | Credential status. |
| `allowedScopes` | `jsonb` | Explicitly granted scopes/permissions. |
| `lastRotatedAt` | `timestamptz` | Credential rotation audit timestamp. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- may create `SyncJob`, `Notification`, `AuditEvent`, and `AIArtifact` records

### 2. Organization registry

#### `Institution`

Represents a tenant institution using the platform.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `name` | `text` | Official institution name. |
| `shortName` | `text` | Human-friendly short label. |
| `institutionType` | `enum(public, private, system-office, consortium)` | Governance classification. |
| `status` | `enum(active, onboarding, inactive)` | Tenant lifecycle state. |
| `primaryTimeZone` | `text` | IANA time zone identifier. |
| `metadata` | `jsonb` | Controlled tenant-specific options. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- has many `OrganizationUnit`, `Committee`, `User`, `Role`, `Program`, `AccreditationCycle`, and `ControlAttestation`

#### `OrganizationUnit`

Represents a hierarchical unit such as campus, college, school, department, or program office.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `parentOrganizationUnitId` | `uuid` | Nullable self-reference for hierarchy. |
| `unitType` | `enum(campus, college, school, department, office, program-unit, committee-support)` | Canonical organization kind. |
| `code` | `text` | Institution-stable code. |
| `name` | `text` | Display name. |
| `status` | `enum(active, inactive, archived)` | Lifecycle state. |
| `effectiveFrom` | `date` | Start date for hierarchy validity. |
| `effectiveTo` | `date` | Nullable end date. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution`
- may belong to one parent `OrganizationUnit`
- has many child `OrganizationUnit` records
- has many `Program`, `Committee`, `UserRoleAssignment`, `EvidenceItem`, and `Submission` records in its scope

#### `Committee`

Represents a formal review or approval body such as accreditation committee, dean council, or provost review group.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `organizationUnitId` | `uuid` | Nullable FK to sponsoring `OrganizationUnit`. |
| `name` | `text` | Committee name. |
| `committeeType` | `enum(review, approval, audit, advisory)` | Governing purpose. |
| `status` | `enum(active, inactive)` | Lifecycle status. |
| `charter` | `text` | Short description of responsibilities. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution`
- may belong to one `OrganizationUnit`
- has many `UserRoleAssignment`, `WorkflowAssignment`, and `ControlAttestation` records

### 3. Accreditation frameworks

#### `Accreditor`

Represents an accrediting organization, such as AACSB, ABET, or HLC.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `code` | `text` | Stable short code. |
| `name` | `text` | Accreditor name. |
| `status` | `enum(active, retired, draft)` | Lifecycle state. |
| `websiteUrl` | `text` | Reference URL if needed. |
| `metadata` | `jsonb` | Accreditor-specific settings. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- has many `AccreditationFramework` records
- has many `AccreditationCycle` records

#### `AccreditationFramework`

Represents the accreditor-agnostic framework family used to structure standards and cycles.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `accreditorId` | `uuid` | FK to `Accreditor`. |
| `name` | `text` | Framework name. |
| `frameworkType` | `enum(institutional, programmatic, specialized)` | Scope of accreditation. |
| `description` | `text` | Summary of framework intent. |
| `status` | `enum(active, draft, retired)` | Lifecycle state. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Accreditor`
- has many `FrameworkVersion`, `Program`, and `StandardsAlignment` records

#### `FrameworkVersion`

Represents a versioned release of standards, rule packs, and mappings for a framework.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `frameworkId` | `uuid` | FK to `AccreditationFramework`. |
| `versionLabel` | `text` | Version name such as `2027 Standards`. |
| `effectiveFrom` | `date` | Start of validity. |
| `effectiveTo` | `date` | Nullable end date. |
| `rulePackVersion` | `text` | Version of validation/routing rule pack. |
| `mappingSchemaVersion` | `text` | Version of mapping semantics. |
| `status` | `enum(draft, active, retired)` | Lifecycle state. |
| `extensionConfig` | `jsonb` | Controlled extension point configuration. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `AccreditationFramework`
- has many `Standard`, `Criterion`, and `AccreditationCycle` records

#### `Standard`

Represents a top-level standard or criteria grouping within a framework version.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `frameworkVersionId` | `uuid` | FK to `FrameworkVersion`. |
| `parentStandardId` | `uuid` | Nullable self-reference for hierarchical standards. |
| `code` | `text` | Stable standard identifier. |
| `title` | `text` | Standard title. |
| `description` | `text` | Narrative definition. |
| `displayOrder` | `integer` | Ordering within version. |
| `classification` | `enum(standard, section, theme)` | Logical grouping type. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `FrameworkVersion`
- may belong to one parent `Standard`
- has many `Criterion`, `EvidenceLink`, `NarrativeSection`, and `StandardsAlignment` records

#### `Criterion`

Represents an assessable requirement, rubric item, or sub-criterion under a standard.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `frameworkVersionId` | `uuid` | FK to `FrameworkVersion`. |
| `standardId` | `uuid` | FK to `Standard`. |
| `code` | `text` | Criterion code. |
| `title` | `text` | Criterion title. |
| `description` | `text` | Requirement text summary. |
| `evidenceExpectation` | `text` | Expected evidence type guidance. |
| `displayOrder` | `integer` | Ordering within standard. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `FrameworkVersion`
- belongs to one `Standard`
- has many `EvidenceLink`, `AssessmentResult`, `NarrativeSection`, and `StandardsAlignment` records

#### `AccreditationCycle`

Represents a time-bounded institutional accreditation engagement for a framework version.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `accreditorId` | `uuid` | FK to `Accreditor`. |
| `frameworkVersionId` | `uuid` | FK to `FrameworkVersion`. |
| `organizationUnitId` | `uuid` | Nullable FK for program/unit-scoped cycles. |
| `name` | `text` | Cycle name. |
| `cycleType` | `enum(initial, reaffirmation, interim, annual, focused-visit)` | Review type. |
| `status` | `enum(planning, active, submitted, closed, archived)` | Lifecycle state. |
| `startDate` | `date` | Planning/collection start. |
| `endDate` | `date` | Expected close. |
| `submissionDueDate` | `date` | Required submission date. |
| `metadata` | `jsonb` | Cycle-specific settings, milestones, external refs. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution`, `Accreditor`, and `FrameworkVersion`
- may belong to one `OrganizationUnit`
- has many `EvidenceItem`, `AssessmentResult`, `Submission`, `Narrative`, `ReportPackage`, `WorkflowTemplate`, `Notification`, and `ControlAttestation` records

### 4. Evidence management

#### `EvidenceItem`

Represents a governed evidence record with provenance, classification, and workflow state.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `accreditationCycleId` | `uuid` | FK to `AccreditationCycle`. |
| `organizationUnitId` | `uuid` | Nullable FK to `OrganizationUnit`. |
| `submittedByUserId` | `uuid` | FK to `User` who registered the evidence. |
| `title` | `text` | Evidence title. |
| `description` | `text` | Summary of why the evidence matters. |
| `evidenceType` | `enum(document, metric, link, dataset, narrative-support, faculty-record, assessment-record)` | Canonical evidence category. |
| `classificationLevel` | `enum(public, internal, confidential, restricted)` | Data classification. |
| `status` | `enum(draft, collected, under-review, approved, rejected, archived, quarantined)` | Lifecycle and governance state. |
| `provenanceType` | `enum(manual, imported, generated, synchronized)` | Source origin. |
| `retentionPolicyCode` | `text` | Link to retention/disposition policy. |
| `currentArtifactId` | `uuid` | Nullable FK to latest approved `EvidenceArtifact`. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution` and one `AccreditationCycle`
- may belong to one `OrganizationUnit`
- belongs to one submitting `User`
- has many `EvidenceArtifact`, `EvidenceLink`, `Submission`, `AuditEvent`, and `AIArtifact` records

#### `EvidenceArtifact`

Represents a versioned stored artifact for an evidence item, including object storage metadata and validation state.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `evidenceItemId` | `uuid` | FK to `EvidenceItem`. |
| `versionNumber` | `integer` | Monotonic version per evidence item. |
| `storageBucket` | `text` | Logical storage target. |
| `storagePath` | `text` | Object path/key. |
| `fileName` | `text` | Original file name. |
| `mimeType` | `text` | MIME type. |
| `checksumSha256` | `text` | Integrity hash. |
| `fileSizeBytes` | `integer` | Size in bytes. |
| `validationStatus` | `enum(pending, clean, rejected, quarantined)` | Inbound validation result. |
| `sourceSystemId` | `uuid` | Nullable FK to `SourceSystem` for imported files. |
| `ingestedAt` | `timestamptz` | Ingestion timestamp. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `EvidenceItem`
- may belong to one `SourceSystem`
- can be referenced by many `AIArtifact` records for extraction/summarization provenance

#### `EvidenceLink`

Represents a typed association between evidence and a standard, criterion, finding, narrative section, or report section.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `evidenceItemId` | `uuid` | FK to `EvidenceItem`. |
| `standardId` | `uuid` | Nullable FK to `Standard`. |
| `criterionId` | `uuid` | Nullable FK to `Criterion`. |
| `findingId` | `uuid` | Nullable FK to `Finding`. |
| `narrativeSectionId` | `uuid` | Nullable FK to `NarrativeSection`. |
| `linkType` | `enum(primary-support, supplemental, cited, derived-from)` | Relationship semantics. |
| `rationale` | `text` | Why the evidence supports the target. |
| `confidence` | `enum(low, medium, high, human-confirmed)` | Optional quality indicator, especially for AI suggestions. |
| `createdByUserId` | `uuid` | FK to `User` or workflow actor. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `EvidenceItem`
- may belong to one `Standard`, `Criterion`, `Finding`, or `NarrativeSection`
- belongs to one creating `User`

#### `EvidenceCollection`

Represents an evidence request, import campaign, or collection batch used to gather evidence from people or systems.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `accreditationCycleId` | `uuid` | FK to `AccreditationCycle`. |
| `organizationUnitId` | `uuid` | Nullable FK to `OrganizationUnit`. |
| `sourceSystemId` | `uuid` | Nullable FK to `SourceSystem`. |
| `requestedByUserId` | `uuid` | FK to `User`. |
| `collectionType` | `enum(manual-request, scheduled-import, bulk-upload, survey-ingest)` | Collection mode. |
| `status` | `enum(planned, running, completed, failed, canceled)` | Collection lifecycle. |
| `requestedAt` | `timestamptz` | Request timestamp. |
| `completedAt` | `timestamptz` | Nullable completion time. |
| `notes` | `text` | Operational notes. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `AccreditationCycle`
- may belong to one `OrganizationUnit` and one `SourceSystem`
- belongs to one requesting `User`
- can result in many `EvidenceItem` and `SyncJob` records

### 5. Curriculum, assessment, and improvement

#### `Program`

Represents an accredited academic program or program grouping.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `organizationUnitId` | `uuid` | FK to `OrganizationUnit`. |
| `frameworkId` | `uuid` | Nullable FK to `AccreditationFramework` when programmatically accredited. |
| `code` | `text` | Institution program code. |
| `name` | `text` | Program name. |
| `degreeLevel` | `enum(certificate, associate, bachelor, master, doctorate, other)` | Academic level. |
| `status` | `enum(active, inactive, teach-out, archived)` | Lifecycle state. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution` and one `OrganizationUnit`
- may belong to one `AccreditationFramework`
- has many `Course`, `LearningOutcome`, `FacultyProfile`, `AssessmentResult`, `ProgramOutcomeMap`, and `AccreditationCycle` records in scope

#### `Course`

Represents a canonical course used for curriculum and outcome mappings.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `programId` | `uuid` | FK to `Program`. |
| `sourceSystemId` | `uuid` | Nullable FK to `SourceSystem`. |
| `courseCode` | `text` | Canonical course code. |
| `title` | `text` | Course title. |
| `creditHours` | `integer` | Credit-hour value. |
| `status` | `enum(active, inactive, archived)` | Lifecycle state. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Program`
- may belong to one `SourceSystem`
- has many `CourseOutcomeMap`, `AssessmentResult`, and `FacultyActivity` records

#### `LearningOutcome`

Represents a measurable student learning outcome or program outcome.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `programId` | `uuid` | FK to `Program`. |
| `outcomeType` | `enum(program, course, institutional)` | Outcome level. |
| `code` | `text` | Stable outcome code. |
| `statement` | `text` | Outcome statement. |
| `status` | `enum(active, inactive, archived)` | Lifecycle state. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Program`
- has many `AssessmentResult`, `ProgramOutcomeMap`, `CourseOutcomeMap`, and `StandardsAlignment` records

#### `AssessmentResult`

Represents a measured or reviewed outcome result for a program, course, or standard within an accreditation cycle.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `accreditationCycleId` | `uuid` | FK to `AccreditationCycle`. |
| `programId` | `uuid` | FK to `Program`. |
| `courseId` | `uuid` | Nullable FK to `Course`. |
| `learningOutcomeId` | `uuid` | Nullable FK to `LearningOutcome`. |
| `criterionId` | `uuid` | Nullable FK to `Criterion`. |
| `measuredByUserId` | `uuid` | FK to `User`. |
| `assessmentMethod` | `text` | Human-readable assessment method. |
| `resultValue` | `text` | Canonicalized score or summary value. |
| `resultStatus` | `enum(draft, finalized, superseded)` | Governance state. |
| `measuredAt` | `timestamptz` | Measurement timestamp. |
| `notes` | `text` | Qualitative explanation. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `AccreditationCycle`, one `Program`, and one measuring `User`
- may belong to one `Course`, `LearningOutcome`, and `Criterion`
- has many `Finding` and `EvidenceLink` records

#### `Finding`

Represents a structured interpretation of assessment or review evidence that may require improvement action.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `assessmentResultId` | `uuid` | FK to `AssessmentResult`. |
| `severity` | `enum(info, concern, deficiency, strength)` | Review significance. |
| `title` | `text` | Short finding title. |
| `description` | `text` | Structured explanation. |
| `status` | `enum(open, acknowledged, in-progress, resolved, closed)` | Lifecycle state. |
| `identifiedAt` | `timestamptz` | Finding creation timestamp. |
| `closedAt` | `timestamptz` | Nullable close timestamp. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `AssessmentResult`
- has many `ActionPlan` and `EvidenceLink` records

#### `ActionPlan`

Represents an improvement plan intended to address a finding or assessment gap.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `findingId` | `uuid` | FK to `Finding`. |
| `ownerOrganizationUnitId` | `uuid` | FK to `OrganizationUnit`. |
| `ownerUserId` | `uuid` | Nullable FK to `User`. |
| `title` | `text` | Plan title. |
| `description` | `text` | Plan summary. |
| `status` | `enum(draft, active, blocked, completed, canceled)` | Lifecycle state. |
| `startDate` | `date` | Planned start. |
| `targetDate` | `date` | Planned completion. |
| `successMeasure` | `text` | Expected closure criterion. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Finding`
- belongs to one owning `OrganizationUnit`
- may belong to one owner `User`
- has many `ActionPlanTask`, `Submission`, and `NarrativeSection` records

#### `ActionPlanTask`

Represents a concrete work item within an action plan.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `actionPlanId` | `uuid` | FK to `ActionPlan`. |
| `assignedUserId` | `uuid` | Nullable FK to `User`. |
| `title` | `text` | Task title. |
| `description` | `text` | Work item description. |
| `status` | `enum(todo, in-progress, blocked, done, canceled)` | Task state. |
| `dueDate` | `date` | Planned due date. |
| `completedAt` | `timestamptz` | Nullable completion time. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `ActionPlan`
- may belong to one assigned `User`

### 6. Workflow approvals and reporting

#### `WorkflowTemplate`

Represents a reusable routing and approval definition for submissions, evidence reviews, narrative approvals, or report sign-off.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `accreditationCycleId` | `uuid` | Nullable FK for cycle-specific workflow variants. |
| `name` | `text` | Template name. |
| `workflowType` | `enum(evidence-review, narrative-review, report-approval, action-plan-review, exception-review)` | Governed use case. |
| `status` | `enum(draft, active, retired)` | Lifecycle state. |
| `versionNumber` | `integer` | Monotonic template version. |
| `routingRules` | `jsonb` | Configurable assignment/routing policy. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- may belong to one `AccreditationCycle`
- has many `WorkflowStep` and `Submission` records

#### `Submission`

Represents a governed package sent into review, such as an evidence submission, action-plan update, narrative package, or final report.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `workflowTemplateId` | `uuid` | FK to `WorkflowTemplate`. |
| `accreditationCycleId` | `uuid` | FK to `AccreditationCycle`. |
| `submittedByUserId` | `uuid` | FK to `User`. |
| `organizationUnitId` | `uuid` | Nullable FK to `OrganizationUnit`. |
| `submissionType` | `enum(evidence, narrative, report, action-plan, exception)` | Submission business type. |
| `targetEntityType` | `text` | Aggregate type being reviewed. |
| `targetEntityId` | `uuid` | Identifier of target aggregate. |
| `status` | `enum(draft, submitted, in-review, approved, rejected, returned, canceled)` | Workflow state. |
| `submittedAt` | `timestamptz` | Submission timestamp. |
| `dueAt` | `timestamptz` | Nullable due date/time. |
| `currentStepOrder` | `integer` | Current workflow position. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `WorkflowTemplate`, `AccreditationCycle`, and submitting `User`
- may belong to one `OrganizationUnit`
- has many `WorkflowAssignment`, `WorkflowDecision`, and `AuditEvent` records
- may refer to one `EvidenceItem`, `ActionPlan`, `Narrative`, or `ReportPackage` through `targetEntityType` + `targetEntityId`

#### `WorkflowStep`

Represents an ordered step in a workflow template.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `workflowTemplateId` | `uuid` | FK to `WorkflowTemplate`. |
| `stepOrder` | `integer` | Ordering in template. |
| `name` | `text` | Step label. |
| `assignmentType` | `enum(user, role, committee, organization-scope)` | Resolver strategy. |
| `requiredDecisionCount` | `integer` | Number of approvals/reviews required. |
| `allowDelegation` | `boolean` | Whether assignments may be delegated. |
| `slaDays` | `integer` | Optional service-level expectation. |
| `escalationRule` | `jsonb` | Escalation policy. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `WorkflowTemplate`
- has many `WorkflowAssignment` and `WorkflowDecision` records

#### `WorkflowAssignment`

Represents a concrete assignment of a workflow step to a user, role, or committee.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `submissionId` | `uuid` | FK to `Submission`. |
| `workflowStepId` | `uuid` | FK to `WorkflowStep`. |
| `assignedUserId` | `uuid` | Nullable FK to `User`. |
| `assignedRoleId` | `uuid` | Nullable FK to `Role`. |
| `assignedCommitteeId` | `uuid` | Nullable FK to `Committee`. |
| `status` | `enum(pending, acknowledged, completed, delegated, canceled)` | Assignment state. |
| `assignedAt` | `timestamptz` | Assignment timestamp. |
| `dueAt` | `timestamptz` | Nullable deadline. |
| `completedAt` | `timestamptz` | Nullable completion time. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Submission` and one `WorkflowStep`
- may belong to one `User`, `Role`, or `Committee`
- has many related `Notification` records

#### `WorkflowDecision`

Represents a review, approval, rejection, return, attestation, or exception decision made during workflow.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `submissionId` | `uuid` | FK to `Submission`. |
| `workflowStepId` | `uuid` | FK to `WorkflowStep`. |
| `decidedByUserId` | `uuid` | FK to `User`. |
| `decisionType` | `enum(approve, reject, return, comment, attest, exception-granted)` | Decision outcome. |
| `decisionNote` | `text` | Qualitative explanation. |
| `signatureReference` | `text` | Optional signature/attestation pointer. |
| `decidedAt` | `timestamptz` | Decision timestamp. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Submission`, one `WorkflowStep`, and one deciding `User`
- can trigger `AuditEvent`, `Notification`, and `ControlAttestation` records

#### `Narrative`

Represents a report narrative container for a cycle, program, or institutional submission.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `accreditationCycleId` | `uuid` | FK to `AccreditationCycle`. |
| `organizationUnitId` | `uuid` | Nullable FK to `OrganizationUnit`. |
| `title` | `text` | Narrative title. |
| `status` | `enum(draft, in-review, approved, published, archived)` | Governance state. |
| `currentVersion` | `integer` | Monotonic narrative version. |
| `ownerUserId` | `uuid` | FK to `User`. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `AccreditationCycle`
- may belong to one `OrganizationUnit`
- belongs to one owner `User`
- has many `NarrativeSection`, `Submission`, `ReportPackage`, and `AIArtifact` records

#### `NarrativeSection`

Represents a section of a narrative aligned to standards, criteria, findings, or action plans.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `narrativeId` | `uuid` | FK to `Narrative`. |
| `standardId` | `uuid` | Nullable FK to `Standard`. |
| `criterionId` | `uuid` | Nullable FK to `Criterion`. |
| `actionPlanId` | `uuid` | Nullable FK to `ActionPlan`. |
| `title` | `text` | Section title. |
| `body` | `text` | Governed narrative content. |
| `status` | `enum(draft, in-review, approved, superseded)` | Section state. |
| `displayOrder` | `integer` | Ordering in narrative. |
| `lastEditedByUserId` | `uuid` | FK to `User`. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Narrative`
- may belong to one `Standard`, `Criterion`, and `ActionPlan`
- belongs to one editing `User`
- has many `EvidenceLink` and `AIArtifact` records

#### `ReportPackage`

Represents an assembled institutional or program report package ready for export and submission.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `accreditationCycleId` | `uuid` | FK to `AccreditationCycle`. |
| `narrativeId` | `uuid` | Nullable FK to `Narrative`. |
| `packageType` | `enum(self-study, interim-report, focused-report, evidence-export)` | Package classification. |
| `status` | `enum(draft, assembled, approved, exported, submitted, archived)` | Lifecycle state. |
| `versionNumber` | `integer` | Monotonic package version. |
| `assembledByUserId` | `uuid` | FK to `User`. |
| `storagePath` | `text` | Export package location if built. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `AccreditationCycle`
- may belong to one `Narrative`
- belongs to one assembling `User`
- has many `ExportJob`, `Submission`, and `AuditEvent` records

#### `ExportJob`

Represents a generated export/build job for report or evidence packages.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `reportPackageId` | `uuid` | FK to `ReportPackage`. |
| `requestedByUserId` | `uuid` | FK to `User`. |
| `format` | `enum(pdf, docx, zip, json)` | Output format. |
| `status` | `enum(queued, running, completed, failed, expired)` | Job state. |
| `requestedAt` | `timestamptz` | Request timestamp. |
| `completedAt` | `timestamptz` | Nullable completion time. |
| `artifactPath` | `text` | Export artifact path in object storage. |
| `errorSummary` | `text` | Nullable failure notes. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `ReportPackage`
- belongs to one requesting `User`

### 7. Faculty intelligence and curriculum mapping

#### `FacultyProfile`

Represents an accreditation-oriented projection of a faculty member, distinct from HRIS employment records.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `organizationUnitId` | `uuid` | FK to `OrganizationUnit`. |
| `primaryProgramId` | `uuid` | Nullable FK to `Program`. |
| `sourcePersonKey` | `text` | Canonical person reference from integrations. |
| `displayName` | `text` | Preferred display name. |
| `facultyRank` | `text` | Accreditation-relevant rank/title. |
| `employmentStatus` | `enum(full-time, part-time, adjunct, emeritus, inactive)` | Accreditation-facing employment status. |
| `qualificationStatus` | `enum(qualified, provisionally-qualified, not-qualified, unknown)` | Framework-dependent interpreted status. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution` and one `OrganizationUnit`
- may belong to one primary `Program`
- has many `FacultyQualification`, `FacultyActivity`, `EvidenceItem`, and `StandardsAlignment` records

#### `FacultyQualification`

Represents an accreditation-relevant qualification claim, basis, and review status for a faculty profile.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `facultyProfileId` | `uuid` | FK to `FacultyProfile`. |
| `frameworkVersionId` | `uuid` | Nullable FK to `FrameworkVersion`. |
| `qualificationType` | `text` | Framework-facing qualification category. |
| `status` | `enum(draft, under-review, accepted, rejected, expired)` | Governance state. |
| `effectiveFrom` | `date` | Start of qualification applicability. |
| `effectiveTo` | `date` | Nullable end date. |
| `summary` | `text` | Human-readable justification. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `FacultyProfile`
- may belong to one `FrameworkVersion`
- has many `EvidenceLink` and `Submission` records

#### `FacultyActivity`

Represents accreditation-relevant teaching, scholarly, service, or professional activity.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `facultyProfileId` | `uuid` | FK to `FacultyProfile`. |
| `courseId` | `uuid` | Nullable FK to `Course`. |
| `activityType` | `enum(teaching, scholarship, service, professional-development, advising)` | Activity class. |
| `activityDate` | `date` | Activity date. |
| `title` | `text` | Activity title. |
| `description` | `text` | Summary. |
| `sourceSystemId` | `uuid` | Nullable FK to `SourceSystem`. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `FacultyProfile`
- may belong to one `Course` and one `SourceSystem`
- can be supported by many `EvidenceItem` records through `EvidenceLink`

#### `Competency`

Represents a competency or skill concept used for curriculum mapping where frameworks require it.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `code` | `text` | Stable competency code. |
| `name` | `text` | Competency name. |
| `description` | `text` | Narrative definition. |
| `status` | `enum(active, inactive, archived)` | Lifecycle state. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution`
- has many `ProgramOutcomeMap` and `CourseOutcomeMap` records

#### `ProgramOutcomeMap`

Represents a mapping between a program, learning outcome, competency, and optionally an accreditor standard/criterion.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `programId` | `uuid` | FK to `Program`. |
| `learningOutcomeId` | `uuid` | FK to `LearningOutcome`. |
| `competencyId` | `uuid` | Nullable FK to `Competency`. |
| `standardId` | `uuid` | Nullable FK to `Standard`. |
| `criterionId` | `uuid` | Nullable FK to `Criterion`. |
| `mappingStrength` | `enum(introduced, reinforced, mastered, aligned)` | Mapping semantics. |
| `reviewStatus` | `enum(draft, reviewed, approved, retired)` | Governance state. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Program` and one `LearningOutcome`
- may belong to one `Competency`, `Standard`, and `Criterion`

#### `CourseOutcomeMap`

Represents a mapping from course coverage to learning outcomes and competencies.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `courseId` | `uuid` | FK to `Course`. |
| `learningOutcomeId` | `uuid` | FK to `LearningOutcome`. |
| `competencyId` | `uuid` | Nullable FK to `Competency`. |
| `coverageLevel` | `enum(introduced, reinforced, mastered)` | Course contribution level. |
| `assessmentMethod` | `text` | Optional mapping-specific assessment note. |
| `reviewStatus` | `enum(draft, reviewed, approved, retired)` | Governance state. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Course` and one `LearningOutcome`
- may belong to one `Competency`

#### `StandardsAlignment`

Represents a normalized mapping between a standard/criterion and a curricular, faculty, or outcome concept.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `frameworkId` | `uuid` | FK to `AccreditationFramework`. |
| `standardId` | `uuid` | Nullable FK to `Standard`. |
| `criterionId` | `uuid` | Nullable FK to `Criterion`. |
| `alignmentEntityType` | `enum(program, learning-outcome, faculty-profile)` | Target concept type. |
| `alignmentEntityId` | `uuid` | Target concept identifier. |
| `alignmentRationale` | `text` | Why the alignment exists. |
| `status` | `enum(draft, active, retired)` | Lifecycle state. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `AccreditationFramework`
- may belong to one `Standard` and one `Criterion`
- may refer to one `Program`, `LearningOutcome`, or `FacultyProfile`

### 8. Compliance, integration, notifications, and AI support

#### `AuditEvent`

Represents an immutable audit log record for governance-significant actions.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `actorType` | `enum(user, service-principal, system)` | Actor category. |
| `actorId` | `uuid` | Nullable FK to `User` or `ServicePrincipal`. |
| `eventType` | `text` | Stable machine-readable event code. |
| `resourceType` | `text` | Aggregate/resource kind. |
| `resourceId` | `uuid` | Target resource identifier. |
| `occurredAt` | `timestamptz` | Event time. |
| `correlationId` | `text` | Cross-service trace/correlation key. |
| `details` | `jsonb` | Redacted event context. |
| `classificationLevel` | `enum(internal, confidential, restricted)` | Access sensitivity. |
| `createdAt` | `timestamptz` | Persisted-at timestamp. |
| `updatedAt` | `timestamptz` | Usually same as `createdAt`; included for consistency. |

Relationships:

- belongs to one `Institution`
- may belong to one `User` or `ServicePrincipal`
- may reference one `EvidenceItem`, `Submission`, `WorkflowDecision`, `ReportPackage`, or other aggregate via `resourceType` + `resourceId`

#### `ControlAttestation`

Represents a recorded attestation that a compliance, security, or governance control has been reviewed or satisfied.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `accreditationCycleId` | `uuid` | Nullable FK to `AccreditationCycle`. |
| `committeeId` | `uuid` | Nullable FK to `Committee`. |
| `attestedByUserId` | `uuid` | FK to `User`. |
| `controlCode` | `text` | Stable control identifier. |
| `status` | `enum(attested, expired, revoked)` | Attestation state. |
| `attestedAt` | `timestamptz` | Attestation time. |
| `expiresAt` | `timestamptz` | Nullable expiration. |
| `evidenceSummary` | `text` | Short summary of supporting proof. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution`
- may belong to one `AccreditationCycle` and one `Committee`
- belongs to one attesting `User`
- can be triggered by `WorkflowDecision`

#### `PolicyException`

Represents a formally reviewed exception to workflow, retention, access, or compliance policy.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `submissionId` | `uuid` | Nullable FK to `Submission`. |
| `requestedByUserId` | `uuid` | FK to `User`. |
| `approvedByUserId` | `uuid` | Nullable FK to `User`. |
| `exceptionType` | `enum(access, workflow, retention, export, ai-usage)` | Policy category. |
| `status` | `enum(requested, approved, denied, expired, revoked)` | Lifecycle state. |
| `rationale` | `text` | Business justification. |
| `effectiveFrom` | `timestamptz` | Start of exception. |
| `effectiveTo` | `timestamptz` | Nullable end of exception. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution`
- may belong to one `Submission`
- belongs to one requesting `User`
- may belong to one approving `User`

#### `SourceSystem`

Represents an external system integrated through the integration hub.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `systemType` | `enum(idp, sis, erp, hris, lms, document-management, survey, research, messaging)` | External system category. |
| `name` | `text` | Display name. |
| `vendor` | `text` | Vendor or product name. |
| `status` | `enum(active, disabled, testing, retired)` | Lifecycle state. |
| `baseUrl` | `text` | Optional endpoint reference. |
| `configuration` | `jsonb` | Redacted config metadata, never raw secrets. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution`
- has many `IntegrationMapping`, `SyncJob`, `EvidenceArtifact`, `EvidenceCollection`, `Course`, `FacultyActivity`, and `Notification` records

#### `IntegrationMapping`

Represents an explicit versioned mapping from an external system model to a canonical platform model.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `sourceSystemId` | `uuid` | FK to `SourceSystem`. |
| `canonicalEntityType` | `text` | Target canonical type, e.g. `program`, `course`, `person`. |
| `mappingVersion` | `text` | Version label. |
| `status` | `enum(draft, active, retired)` | Lifecycle state. |
| `sourceSchemaRef` | `text` | External schema version reference. |
| `transformSpec` | `jsonb` | Declarative mapping/transformation details. |
| `idempotencyStrategy` | `text` | Reconciliation/idempotency approach. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `SourceSystem`
- has many `SyncJob` records

#### `SyncJob`

Represents an import/export synchronization job managed by the integration hub.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `sourceSystemId` | `uuid` | FK to `SourceSystem`. |
| `integrationMappingId` | `uuid` | Nullable FK to `IntegrationMapping`. |
| `requestedByServicePrincipalId` | `uuid` | Nullable FK to `ServicePrincipal`. |
| `requestedByUserId` | `uuid` | Nullable FK to `User`. |
| `jobType` | `enum(import, export, reconcile, replay)` | Operational job type. |
| `targetEntityType` | `text` | Canonical target family. |
| `status` | `enum(queued, running, succeeded, failed, dead-lettered, canceled)` | Job state. |
| `startedAt` | `timestamptz` | Nullable start time. |
| `completedAt` | `timestamptz` | Nullable end time. |
| `correlationId` | `text` | Trace key. |
| `diagnostics` | `jsonb` | Retry/failure summary. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `SourceSystem`
- may belong to one `IntegrationMapping`, `ServicePrincipal`, and `User`
- may create `EvidenceCollection`, `EvidenceItem`, `Course`, `FacultyProfile`, or other canonical records depending on job type

#### `Notification`

Represents a queued or delivered notification generated from workflow, reporting, or operational events.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `recipientUserId` | `uuid` | Nullable FK to `User`. |
| `sourceSystemId` | `uuid` | Nullable FK to `SourceSystem` for webhook/email providers. |
| `workflowAssignmentId` | `uuid` | Nullable FK to `WorkflowAssignment`. |
| `channel` | `enum(email, in-app, webhook)` | Delivery channel. |
| `templateCode` | `text` | Template or event code. |
| `status` | `enum(queued, sent, delivered, failed, suppressed)` | Delivery state. |
| `subject` | `text` | Message subject/summary. |
| `payload` | `jsonb` | Rendered message payload or webhook body. |
| `sentAt` | `timestamptz` | Nullable send time. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution`
- may belong to one `User`, `SourceSystem`, and `WorkflowAssignment`
- may be triggered by `Submission`, `WorkflowDecision`, `ExportJob`, or `PolicyException`

#### `AIArtifact`

Represents an assistive AI output or extraction result with provenance and human-review requirements.

| Field | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` | Primary key. |
| `institutionId` | `uuid` | FK to `Institution`. |
| `sourceEntityType` | `enum(evidence-artifact, evidence-item, narrative-section, report-package)` | Provenance source type. |
| `sourceEntityId` | `uuid` | Source record identifier. |
| `generatedByServicePrincipalId` | `uuid` | FK to `ServicePrincipal`. |
| `artifactType` | `enum(summary, extraction, draft, classification, recommendation)` | Assistive output type. |
| `status` | `enum(generated, under-review, accepted, rejected, expired)` | Human-governance state. |
| `content` | `text` | Generated content or extracted summary. |
| `provenance` | `jsonb` | Prompt/model/source citation metadata. |
| `reviewedByUserId` | `uuid` | Nullable FK to `User`. |
| `reviewedAt` | `timestamptz` | Nullable review time. |
| `createdAt` | `timestamptz` | Audit timestamp. |
| `updatedAt` | `timestamptz` | Audit timestamp. |

Relationships:

- belongs to one `Institution`
- belongs to one generating `ServicePrincipal`
- may belong to one reviewing `User`
- may derive from one `EvidenceArtifact`, `EvidenceItem`, `NarrativeSection`, or `ReportPackage`

## Relationship summary

The highest-value relationships for implementation and ERD purposes are:

- `Institution` 1:N `OrganizationUnit`, `User`, `Program`, `AccreditationCycle`, `SourceSystem`
- `Accreditor` 1:N `AccreditationFramework` 1:N `FrameworkVersion` 1:N `Standard` 1:N `Criterion`
- `AccreditationCycle` 1:N `EvidenceItem`, `AssessmentResult`, `Submission`, `Narrative`, `ReportPackage`
- `EvidenceItem` 1:N `EvidenceArtifact` and 1:N `EvidenceLink`
- `AssessmentResult` 1:N `Finding` 1:N `ActionPlan` 1:N `ActionPlanTask`
- `WorkflowTemplate` 1:N `WorkflowStep`; `Submission` 1:N `WorkflowAssignment` and 1:N `WorkflowDecision`
- `Narrative` 1:N `NarrativeSection`; `NarrativeSection` N:M `EvidenceItem` via `EvidenceLink`
- `Program` 1:N `Course` and 1:N `LearningOutcome`
- `Role` and `Permission` N:M through `RolePermissionGrant`
- `Course` and `LearningOutcome` N:M through `CourseOutcomeMap`
- `Program` and `LearningOutcome` N:M through `ProgramOutcomeMap`
- `FacultyProfile` 1:N `FacultyQualification` and 1:N `FacultyActivity`
- `SourceSystem` 1:N `IntegrationMapping` and 1:N `SyncJob`
- `WorkflowDecision` and other critical actions 1:N `AuditEvent` and `Notification`

## Completeness review against product vision and architecture

After drafting the entity model, the repository vision and architecture were reviewed again with special attention to missing domain concepts.

### Coverage found in architecture and reflected here

- institutional multi-tenancy and governed hierarchy
- accreditor-agnostic standards and cycle/versioning model
- evidence lineage, artifacts, quarantine, and retention hooks
- workflow routing, assignments, decisions, and attestations
- narratives, report packaging, and export operations
- assessment, findings, action plans, and curriculum mappings
- faculty qualification and activity projections
- integration mappings, synchronization jobs, and source-system isolation
- audit logging, policy exceptions, notifications, and AI provenance

### Entities that were added during the review pass because architecture implied them

The second pass added or retained these entities explicitly because they are architecturally necessary even when not always named as first-class database tables in every section of the docs:

- `Committee` to support committee-based approvals and attestations
- `EvidenceCollection` to represent structured intake campaigns and import batches
- `ExportJob` to support governed report generation and delivery tracking
- `ControlAttestation` to support the compliance-control matrix and audit readiness
- `Notification` because notifications are a named companion responsibility and workflow dependency
- `AIArtifact` to preserve the assistive AI boundary, provenance, and human review requirements
- `PolicyException` because security/compliance guidance requires exception logging and review metadata

### Vision-document gap note

`docs/product/vision-document.md` currently contains only a title placeholder. The entity model therefore relies primarily on the repository README and the architecture set in `docs/architecture/*`. When the product vision is expanded, this document should be reviewed again for additional portfolio, reviewer, or analytics concepts.

## Implementation guidance for AI coding tools

When generating code from this document:

- treat entities in the same bounded-context section as candidates for the same module root
- default to UUID primary keys and explicit foreign keys
- prefer explicit join entities (`RolePermissionGrant`, `EvidenceLink`, `ProgramOutcomeMap`, `CourseOutcomeMap`, `UserRoleAssignment`) over hidden ORM many-to-many shortcuts
- do not flatten external-system fields into core entities; use `SourceSystem`, `IntegrationMapping`, and canonical adapters
- model AI outputs as advisory records (`AIArtifact`), never as authoritative workflow decisions
- treat `AuditEvent` as append-only and `EvidenceArtifact` as immutable per version
- preserve `jsonb` fields for controlled extension points, not as a substitute for core columns
