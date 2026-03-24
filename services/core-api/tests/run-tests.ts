import { runTests as runDomainTests } from './unit/foundational-domain-invariants.test.js';
import { runTests as runAccreditationFrameworkTests } from './unit/accreditation-frameworks-domain-slice.test.js';
import { runTests as runPersistenceTests } from './integration/persistence-foundation.integration.test.js';
import { runTests as runHttpTests } from './integration/http-foundation.integration.test.js';
import { runTests as runAccreditationFrameworkPersistenceTests } from './integration/accreditation-frameworks-persistence.integration.test.js';
import { runTests as runAccreditationFrameworkHttpTests } from './integration/accreditation-frameworks-http.integration.test.js';
import { runTests as runEvidenceManagementDomainTests } from './unit/evidence-management-domain-slice.test.js';
import { runTests as runEvidenceManagementApplicationTests } from './unit/evidence-management-application-slice.test.js';
import { runTests as runEvidenceManagementPersistenceTests } from './integration/evidence-management-persistence.integration.test.js';

const suites: Array<[string, () => Promise<void>]> = [
  ['domain invariants', runDomainTests],
  ['accreditation frameworks slice', runAccreditationFrameworkTests],
  ['evidence management slice', runEvidenceManagementDomainTests],
  ['evidence management application slice', runEvidenceManagementApplicationTests],
  ['persistence integration', runPersistenceTests],
  ['http integration', runHttpTests],
  ['accreditation frameworks persistence integration', runAccreditationFrameworkPersistenceTests],
  ['accreditation frameworks http integration', runAccreditationFrameworkHttpTests],
  ['evidence management persistence integration', runEvidenceManagementPersistenceTests],
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
