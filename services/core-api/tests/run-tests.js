import { runTests as runDomainTests } from './unit/foundational-domain-invariants.test.js';
import { runTests as runContextTests } from './integration/foundational-contexts.integration.test.js';
import { runTests as runApiTests } from './integration/foundational-api.integration.test.js';

const suites = [
  ['domain invariants', runDomainTests],
  ['application integration', runContextTests],
  ['api integration', runApiTests],
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
