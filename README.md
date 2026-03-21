# Open Accreditation System

## What this system is

Open Accreditation System is an enterprise accreditation management platform for higher education institutions. It is intended to support multiple accreditors, including AACSB, ABET, HLC, and future frameworks, while preserving a single governed platform for evidence management, approvals, reporting, integrations, and institutional compliance.

This repository is the home for the platform codebase, documentation, deployment assets, schemas, and shared packages. The target architecture described here is the canonical baseline for how the system should evolve, even where the current implementation is still scaffolded or incomplete.

## Why this architecture was chosen

Higher education accreditation is not a simple CRUD problem. The platform must support:

- long-lived institutional records and evidence lineage
- formal workflow and approval chains
- multi-department collaboration with role-based access
- accreditor-specific rules without rewriting the whole platform
- integrations with ERP, SIS, HRIS, LMS, and document-management systems
- auditability, accessibility, and security as first-class concerns
- AI assistance without surrendering institutional control or accountability

For those reasons, the system is intentionally designed as a **domain-centered modular monolith** for the core platform, with **companion services** for specialized concerns such as search, notifications, AI assistance, and integration orchestration when those concerns justify operational separation.

This architecture is preferred over early microservices because it keeps the business domain cohesive, reduces distributed-system overhead, and makes it easier to enforce consistent workflow, evidence, compliance, and audit patterns across modules.

## Core architectural stance

### Modular monolith for the core platform

The main platform should be built primarily in **TypeScript**, using **NestJS with Fastify** as the primary API foundation. The core platform is the system of record and should be implemented as a modular monolith with explicit internal module boundaries.

Within each domain module, code should follow **clean architecture / hexagonal architecture** with these layers:

- `domain` — business concepts, invariants, policies, entities, value objects, domain services
- `application` — use cases, orchestration, commands, queries, ports, transaction boundaries
- `infrastructure` — persistence, messaging, storage, external adapters, framework implementations
- `api` — transport concerns only: controllers, DTOs, validation, authentication context mapping

### Companion services for specialized concerns

Companion services may be introduced when a concern is operationally distinct or benefits from independent scaling or technology choices. Typical candidates include:

- AI assistance and document processing
- search and indexing
- notification delivery
- integration orchestration

These services support the core platform. They do **not** become alternate systems of record for accreditation workflows, evidence, approvals, or institutional claims.

### Python boundary

Python is allowed for AI, document-processing, extraction, and supporting automation services. It is **not** the primary language for the core platform and should not become the authoritative implementation location for the accreditation domain model.

## High-level repository layout

The repository currently contains scaffolding and early service/app structure. Treat the following as the intended high-level organization:

- `apps/` — user-facing applications such as institutional portals and reviewer interfaces
- `services/`
  - `core-api/` — primary TypeScript/NestJS platform API and core modular monolith
  - `integration-hub/` — integration orchestration and source-system adapter service if separated
  - `ai-assistant/` — AI/document-processing companion service
  - `notification-service/` — outbound notifications companion service
  - `search-indexer/` — search/indexing companion service
- `packages/` — shared packages such as UI, API clients, config, events, lint rules, and TypeScript configuration
- `docs/` — product, architecture, accreditor notes, and architectural decision records
- `schemas/` — API, event, and canonical integration schemas
- `platform/` — security, observability, and compliance platform assets
- `deploy/` — Docker, Kubernetes, Terraform, and deployment scripts
- `tests/` — repository-level test suites for security, compliance, accessibility, performance, and end-to-end verification
- `data/` — seeds, migrations, and reference data
- `storage/` — evidence/import/export/quarantine storage areas

## Modular monolith + companion services, briefly explained

The default implementation strategy is:

1. Put new business capabilities into the **core modular monolith** first.
2. Keep the domain model accreditor-agnostic and institutionally governed.
3. Split functionality into a companion service **only** when there is a clear reason, such as:
   - materially different runtime requirements
   - specialized compute or libraries
   - asynchronous processing or indexing
   - operational isolation requirements
   - external integration mediation that should not pollute the core domain

### Correct

- Keep accreditation evidence approval rules in the core API domain modules.
- Move OCR or embedding generation into a Python companion service.
- Keep source-system mappings in integration adapters, not in accreditation entities.

### Incorrect

- Build new features directly as ad hoc microservices because they are “faster to start.”
- Put accreditor workflow rules in a search service or notification service.
- Make the AI service the source of truth for narratives, compliance findings, or final reports.

## Developer expectations for adding features

When adding a feature, assume the architecture in this README and `docs/architecture/README.md` is the default contract.

### Add features by module, not by technical layer alone

A feature should usually start by identifying the domain module it belongs to. New work should then be implemented inside that module across the appropriate layers rather than scattering logic across unrelated directories.

### Recommended sequence

1. Identify the bounded context or module.
2. Define or refine domain concepts and invariants.
3. Add application use cases and ports.
4. Implement infrastructure adapters as needed.
5. Expose capability through API handlers/controllers.
6. Add audit, authorization, evidence, and workflow implications explicitly.
7. Add tests at the correct scope.
8. Record a meaningful ADR if the change alters architectural direction.

### What to avoid

- embedding ERP/SIS-specific fields directly into core domain models
- placing business rules in controllers, DTOs, or generic helpers
- adding raw Express-style patterns as the primary foundation when NestJS/Fastify should be used
- introducing module-to-module shortcuts that bypass published application interfaces
- letting AI-generated content bypass human review, approvals, or evidence traceability

## How to structure new modules

New core business modules should be added under the main core platform service and follow a predictable shape like:

```text
services/core-api/src/modules/<module-name>/
  domain/
  application/
  infrastructure/
  api/
```

### Module guidance

- Put entities, value objects, policies, and domain services in `domain/`.
- Put commands, queries, use cases, ports, and orchestration in `application/`.
- Put repositories, event publishers, persistence mappings, storage clients, and external adapters in `infrastructure/`.
- Put controllers, request/response DTOs, validation schemas, and transport mapping in `api/`.

### Correct

- `evidence-management/domain/EvidenceItem.ts`
- `workflow-approvals/application/ApproveSubmission.ts`
- `integration-hub/infrastructure/sis/BannerProgramAdapter.ts`

### Incorrect

- `packages/utils/accreditationHelpers.ts` containing real business rules
- `api/controllers/SubmitEvidenceController.ts` performing approval logic directly
- `domain/StudentInformationSystemRecord.ts` inside an accreditation domain module

## How to handle integrations consistently

The integration layer must remain separate from the core accreditation domain.

### Rules

- Use **canonical internal models** between the core platform and integration adapters.
- Isolate source-system details in the integration hub or infrastructure adapters.
- Keep ERP/SIS/HRIS/LMS/document-platform schema details out of core domain entities.
- Translate external payloads at the edge.
- Prefer standards-based contracts and explicit mapping code.

### Correct

- Map Workday faculty data into a canonical faculty profile before the core platform consumes it.
- Store source-system identifiers as mapped references, not as domain-defining business concepts.
- Keep LMS course outcome synchronization behind a port/adapter boundary.

### Incorrect

- Expose PeopleSoft or Banner table structures directly in `assessment-improvement/domain`.
- Require core modules to understand vendor-specific webhook payloads.
- Mix accreditor rules with SIS import parsing logic.

## AI service boundaries

AI capabilities are assistive. They can help summarize evidence, draft narratives, classify documents, suggest mappings, or identify possible gaps. They must not be treated as authoritative institutional decision-makers.

### Rules

- Keep AI in bounded supporting services or clearly isolated infrastructure adapters.
- Log prompts, provenance, and relevant citations when appropriate.
- Require human review for consequential outputs.
- Ensure final claims, submissions, and approvals come from governed workflows in the core platform.
- Do not let AI bypass audit, evidence, or approval controls.

## Architectural Decision Records (ADRs)

Use ADRs to document material architectural choices and reversals. Store them under `docs/decisions/`.

Create an ADR when:

- introducing a new companion service
- changing a module boundary or shared-kernel rule
- adopting a new integration pattern or event contract
- changing persistence or tenancy strategy
- altering the AI boundary or approval model

A good ADR should capture the context, decision, alternatives considered, and consequences.

## Do / Don’t

### Do

- preserve modular boundaries
- prefer NestJS with Fastify for the main TypeScript API
- keep the core domain accreditor-agnostic
- isolate integrations behind canonical models and adapters
- build auditability, approvals, and evidence traceability into feature design
- keep AI assistive and human-governed
- prefer consistency with established module/layer patterns over convenience

### Don’t

- introduce raw framework sprawl or one-off patterns per feature
- put source-system schemas into domain modules
- move core domain behavior into generic utility packages
- bypass workflow, compliance, or audit controls for “internal” features
- split into microservices without a clear domain or operational reason
- treat AI output as approved institutional truth

## Architecture Guardrails for Future Codex Prompts

Future implementation prompts may cite this section directly.

> Follow the architecture guardrails in `README.md` and `docs/architecture/README.md`. Do not introduce architectural patterns that conflict with them.

When making changes:

- preserve modular boundaries
- keep integrations outside the core domain
- keep AI in bounded supporting services
- do not introduce raw framework sprawl
- do not bypass audit/compliance patterns
- prefer consistency with existing module/layer patterns over convenience

If the current implementation differs from the target architecture, move it incrementally toward the target state rather than expanding the inconsistency.

## Canonical detailed reference

For detailed module definitions, dependency rules, compliance expectations, and consistency checks, see `docs/architecture/README.md`. That document is the more detailed canonical architecture guide; this root README is the quick-start architectural orientation.
