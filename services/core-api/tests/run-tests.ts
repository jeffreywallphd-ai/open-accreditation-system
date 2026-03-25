import { runTests as runDomainTests } from './unit/foundational-domain-invariants.test.js';
import { runTests as runAccreditationFrameworkTests } from './unit/accreditation-frameworks-domain-slice.test.js';
import { runTests as runPersistenceTests } from './integration/persistence-foundation.integration.test.js';
import { runTests as runHttpTests } from './integration/http-foundation.integration.test.js';
import { runTests as runAccreditationFrameworkPersistenceTests } from './integration/accreditation-frameworks-persistence.integration.test.js';
import { runTests as runAccreditationFrameworkHttpTests } from './integration/accreditation-frameworks-http.integration.test.js';
import { runTests as runEvidenceManagementDomainTests } from './unit/evidence-management-domain-slice.test.js';
import { runTests as runEvidenceManagementApplicationTests } from './unit/evidence-management-application-slice.test.js';
import { runTests as runEvidenceManagementPersistenceTests } from './integration/evidence-management-persistence.integration.test.js';
import { runTests as runWorkflowApprovalsDomainTests } from './unit/workflow-approvals-domain-slice.test.js';
import { runTests as runWorkflowApprovalsApplicationTests } from './unit/workflow-approvals-application-slice.test.js';
import { runTests as runWorkflowEvidenceReadinessContractTests } from './unit/workflow-evidence-readiness-contract.test.js';
import { runTests as runWorkflowApprovalsPersistenceTests } from './integration/workflow-approvals-persistence.integration.test.js';
import { runTests as runNarrativesReportingDomainTests } from './unit/narratives-reporting-domain-slice.test.js';
import { runTests as runNarrativesReportingApplicationTests } from './unit/narratives-reporting-application-slice.test.js';
import { runTests as runNarrativesReportingPersistenceTests } from './integration/narratives-reporting-persistence.integration.test.js';
import { runTests as runNarrativesReportingHttpTests } from './integration/narratives-reporting-http.integration.test.js';

const suites: Array<[string, () => Promise<void>]> = [
  ['domain invariants', runDomainTests],
  ['accreditation frameworks slice', runAccreditationFrameworkTests],
  ['evidence management slice', runEvidenceManagementDomainTests],
  ['evidence management application slice', runEvidenceManagementApplicationTests],
  ['workflow approvals domain slice', runWorkflowApprovalsDomainTests],
  ['workflow approvals application slice', runWorkflowApprovalsApplicationTests],
  ['narratives reporting domain slice', runNarrativesReportingDomainTests],
  ['narratives reporting application slice', runNarrativesReportingApplicationTests],
  ['workflow evidence readiness contract', runWorkflowEvidenceReadinessContractTests],
  ['persistence integration', runPersistenceTests],
  ['http integration', runHttpTests],
  ['accreditation frameworks persistence integration', runAccreditationFrameworkPersistenceTests],
  ['accreditation frameworks http integration', runAccreditationFrameworkHttpTests],
  ['evidence management persistence integration', runEvidenceManagementPersistenceTests],
  ['workflow approvals persistence integration', runWorkflowApprovalsPersistenceTests],
  ['narratives reporting persistence integration', runNarrativesReportingPersistenceTests],
  ['narratives reporting http integration', runNarrativesReportingHttpTests],
];

let failed = 0;
for (const [name, runner] of suites) {
  try {
    await runner();
    console.log(`PASS: ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL: ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log(`PASS: all ${suites.length} suites`);
}
