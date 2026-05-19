// Smoke test: simulate the exact payload that src/App.jsx endGame()
// produces, and verify it passes the new firestore.rules.
// Mirrors lines 239-245 of App.jsx verbatim.

import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';

const PROJECT_ID = 'exw-memory-game-smoke';
const HOST = '127.0.0.1';
const PORT = 8080;

// Verbatim copy of endGame() payload shape (App.jsx:239-245)
function buildEndGameResult({ user, playerName, score, gameStartTime }) {
  return {
    id: (user?.uid || 'guest-' + Math.random().toString(36).substr(2, 9)) + '-' + Date.now(),
    userId: user?.uid || 'guest',
    name: playerName || 'Guest',
    score: score,
    startTime: gameStartTime || Date.now(),
  };
}

const testEnv = await initializeTestEnvironment({
  projectId: PROJECT_ID,
  firestore: {
    rules: readFileSync('firestore.rules', 'utf8'),
    host: HOST,
    port: PORT,
  },
});

const ANON_UID = 'anon-real-uid-123';
const db = testEnv.authenticatedContext(ANON_UID).firestore();

let passed = 0;
let failed = 0;

async function run(label, scenario) {
  const payload = buildEndGameResult(scenario);
  try {
    await assertSucceeds(setDoc(doc(db, 'leaderboard', payload.id), payload));
    passed += 1;
    console.log(`  PASS  ${label}`);
    console.log(`        payload: ${JSON.stringify(payload)}`);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL  ${label}`);
    console.log(`        payload: ${JSON.stringify(payload)}`);
    console.log(`        error:   ${err.message}`);
  }
}

console.log('\n[SMOKE] Real endGame() payloads against firestore.rules\n');

// Typical Computex booth scenarios:
await run('English name "Alice", score 50', {
  user: { uid: ANON_UID },
  playerName: 'Alice',
  score: 50,
  gameStartTime: Date.now() - 30000,
});

await run('Chinese name "許晏綺", score 100 (max)', {
  user: { uid: ANON_UID },
  playerName: '許晏綺',
  score: 100,
  gameStartTime: Date.now() - 30000,
});

await run('Mixed name "Alex 小明", score 80', {
  user: { uid: ANON_UID },
  playerName: 'Alex 小明',
  score: 80,
  gameStartTime: Date.now() - 30000,
});

await run('Empty playerName -> fallback "Guest", score 0', {
  user: { uid: ANON_UID },
  playerName: '',
  score: 0,
  gameStartTime: Date.now() - 30000,
});

await run('Max client input: 15 English chars', {
  user: { uid: ANON_UID },
  playerName: 'a'.repeat(15), // input maxLength={15}
  score: 30,
  gameStartTime: Date.now() - 30000,
});

await run('Max client input: 15 Chinese chars', {
  user: { uid: ANON_UID },
  playerName: '一'.repeat(15),
  score: 70,
  gameStartTime: Date.now() - 30000,
});

await run('Boundary: score = 10 (one match)', {
  user: { uid: ANON_UID },
  playerName: 'Bob',
  score: 10,
  gameStartTime: Date.now() - 30000,
});

await testEnv.cleanup();

console.log(`\n========================================`);
console.log(`Passed: ${passed}   Failed: ${failed}`);
console.log(`========================================\n`);

process.exit(failed > 0 ? 1 : 0);
