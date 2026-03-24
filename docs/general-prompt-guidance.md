# General Prompt Guidance

This document defines how prompts should be executed to ensure consistency and alignment with this repository.

---

## 1. Source of Truth

Before making changes, you MUST review:

- `docs/architecture/` (primary source)
- Referenced documents within that folder
- Relevant existing code

Prefer **AI-oriented design documents** over long-form human documentation.

Do NOT invent patterns not grounded in these sources.

---

## 2. Allowed Exceptions

- If the user explicitly requests architectural changes:
  - You may propose and implement them
  - Ensure changes are **intentional, consistent, and minimal**
  - You MUST update documentation accordingly (see Section 5)

---

## 3. Implementation Direction

- Work from **core logic outward toward user-facing layers**
- Do not begin with UI or API without grounding in underlying design
- Extend existing systems before creating new ones

---

## 4. Consistency

- Follow existing naming, structure, and patterns
- Reuse abstractions whenever possible
- Avoid duplication or parallel systems

---

## 5. Documentation Updates (REQUIRED)

When making changes, you MUST:

- Update relevant files in `docs/architecture/`
- Keep documentation concise and aligned with implementation
- Ensure documentation reflects the **current system behavior**

---

## 6. Implementation Quality

- Make **incremental, complete changes**
- Ensure changes:
  - Integrate cleanly with existing functionality
  - Do not introduce regressions
  - Use **real implementations only** (no mocks, stubs, or placeholder logic in production code)

---

## 7. When Uncertain

Default to:

1. `docs/architecture/`
2. Existing implementations

Do not guess or introduce speculative designs.

---

## 8. Anti-Patterns (Avoid)

- Ignoring architecture documentation
- UI-first implementations without core support
- Duplicate or conflicting abstractions
- Large, unfocused changes

---

## 9. Goal

All work should be:
- Aligned with documented architecture
- Consistent with the existing system
- Clear, minimal, and extensible
