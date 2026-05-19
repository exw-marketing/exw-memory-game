// Firestore Rules test for EXW Memory Game leaderboard.
// Run via: npm run test:rules
// Spins up a temporary emulator project, exercises every branch of the
// security rules, and exits non-zero if any expectation fails.

import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
} from 'firebase/firestore';

const PROJECT_ID = 'exw-memory-game-rules-test';
const HOST = '127.0.0.1';
const PORT = 8080;

const validResult = (overrides = {}) => ({
  id: 'anon-abc123-1716000000000',
  userId: 'anon-uid-1',
  name: 'Alice',
  score: 80,
  startTime: 1716000000000,
  ...overrides,
});

let passed = 0;
let failed = 0;
const failures = [];

async function expect(label, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  PASS  ${label}`);
  } catch (err) {
    failed += 1;
    failures.push({ label, err });
    console.log(`  FAIL  ${label}`);
    console.log(`        ${err.message}`);
  }
}

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: HOST,
    port: PORT,
  },
});

// Helpers
const authed = (uid = 'anon-uid-1') => testEnv.authenticatedContext(uid).firestore();
const unauthed = () => testEnv.unauthenticatedContext().firestore();

// ============================================================
// SECTION 1: READS — anyone can read leaderboard
// ============================================================
console.log('\n[READ] anyone can read leaderboard');

await expect('unauthenticated can read leaderboard doc', async () => {
  // Seed with admin context (bypasses rules)
  await testEnv.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'leaderboard/seed1'), validResult({ id: 'seed1' }));
  });
  await assertSucceeds(getDoc(doc(unauthed(), 'leaderboard/seed1')));
});

await expect('authenticated can read leaderboard doc', async () => {
  await assertSucceeds(getDoc(doc(authed(), 'leaderboard/seed1')));
});

// ============================================================
// SECTION 2: CREATE — happy paths
// ============================================================
console.log('\n[CREATE] happy paths');

await expect('authed, valid English name, score 0', async () => {
  const data = validResult({ id: 'happy-1', name: 'Bob', score: 0 });
  await assertSucceeds(setDoc(doc(authed(), 'leaderboard/happy-1'), data));
});

await expect('authed, valid English name, score 100 (max)', async () => {
  const data = validResult({ id: 'happy-2', score: 100 });
  await assertSucceeds(setDoc(doc(authed(), 'leaderboard/happy-2'), data));
});

await expect('authed, English name exactly 30 chars', async () => {
  const data = validResult({ id: 'happy-3', name: 'a'.repeat(30) });
  await assertSucceeds(setDoc(doc(authed(), 'leaderboard/happy-3'), data));
});

await expect('authed, Chinese name 3 chars (許晏綺)', async () => {
  const data = validResult({ id: 'happy-4', name: '許晏綺' });
  await assertSucceeds(setDoc(doc(authed(), 'leaderboard/happy-4'), data));
});

await expect('authed, Chinese name exactly 20 chars', async () => {
  const data = validResult({ id: 'happy-5', name: '一'.repeat(20) });
  await assertSucceeds(setDoc(doc(authed(), 'leaderboard/happy-5'), data));
});

await expect('authed, mixed Chinese+English name (treated as non-ASCII, <=20)', async () => {
  const data = validResult({ id: 'happy-6', name: 'Alice 小明' });
  await assertSucceeds(setDoc(doc(authed(), 'leaderboard/happy-6'), data));
});

// ============================================================
// SECTION 3: CREATE — denied (auth)
// ============================================================
console.log('\n[CREATE] denied (auth)');

await expect('unauthenticated create denied', async () => {
  const data = validResult({ id: 'deny-auth' });
  await assertFails(setDoc(doc(unauthed(), 'leaderboard/deny-auth'), data));
});

// ============================================================
// SECTION 4: CREATE — denied (schema)
// ============================================================
console.log('\n[CREATE] denied (schema violations)');

await expect('score > 100 denied', async () => {
  const data = validResult({ id: 'deny-score-high', score: 999 });
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-score-high'), data));
});

await expect('score < 0 denied', async () => {
  const data = validResult({ id: 'deny-score-neg', score: -1 });
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-score-neg'), data));
});

await expect('score as string denied', async () => {
  const data = validResult({ id: 'deny-score-str', score: '50' });
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-score-str'), data));
});

await expect('score as float denied', async () => {
  const data = validResult({ id: 'deny-score-float', score: 50.5 });
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-score-float'), data));
});

await expect('missing score field denied', async () => {
  const { score, ...rest } = validResult({ id: 'deny-no-score' });
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-no-score'), rest));
});

await expect('missing name field denied', async () => {
  const { name, ...rest } = validResult({ id: 'deny-no-name' });
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-no-name'), rest));
});

await expect('extra field "admin" denied', async () => {
  const data = { ...validResult({ id: 'deny-extra' }), admin: true };
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-extra'), data));
});

await expect('English name 31 chars denied', async () => {
  const data = validResult({ id: 'deny-name-en', name: 'a'.repeat(31) });
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-name-en'), data));
});

await expect('Chinese name 21 chars denied', async () => {
  const data = validResult({ id: 'deny-name-zh', name: '一'.repeat(21) });
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-name-zh'), data));
});

await expect('empty name denied', async () => {
  const data = validResult({ id: 'deny-name-empty', name: '' });
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-name-empty'), data));
});

await expect('name as number denied', async () => {
  const data = validResult({ id: 'deny-name-num', name: 12345 });
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-name-num'), data));
});

await expect('startTime as 0 denied (must be > 0)', async () => {
  const data = validResult({ id: 'deny-time-zero', startTime: 0 });
  await assertFails(setDoc(doc(authed(), 'leaderboard/deny-time-zero'), data));
});

// ============================================================
// SECTION 5: UPDATE / DELETE — denied (immutability)
// ============================================================
console.log('\n[UPDATE/DELETE] immutability enforced');

await expect('update existing doc denied', async () => {
  await assertFails(updateDoc(doc(authed(), 'leaderboard/seed1'), { score: 999 }));
});

await expect('setDoc overwrite of existing doc denied', async () => {
  // setDoc on existing doc is an update under the hood
  const data = validResult({ id: 'seed1', score: 999 });
  await assertFails(setDoc(doc(authed(), 'leaderboard/seed1'), data));
});

await expect('delete existing doc denied', async () => {
  await assertFails(deleteDoc(doc(authed(), 'leaderboard/seed1')));
});

// ============================================================
// SECTION 6: OTHER COLLECTIONS — fully blocked
// ============================================================
console.log('\n[OTHER COLLECTIONS] blocked');

await expect('read from random collection denied', async () => {
  await assertFails(getDoc(doc(authed(), 'admin/secrets')));
});

await expect('write to random collection denied', async () => {
  await assertFails(setDoc(doc(authed(), 'admin/secrets'), { x: 1 }));
});

await expect('write to nested leaderboard subcollection denied', async () => {
  await assertFails(setDoc(doc(authed(), 'leaderboard/seed1/comments/c1'), { x: 1 }));
});

// ============================================================
// Cleanup
// ============================================================
await testEnv.cleanup();

console.log(`\n========================================`);
console.log(`Passed: ${passed}   Failed: ${failed}`);
console.log(`========================================`);

if (failed > 0) {
  console.log('\nFailures:');
  for (const f of failures) {
    console.log(`  - ${f.label}`);
    console.log(`    ${f.err.message}`);
  }
  process.exit(1);
}
process.exit(0);
