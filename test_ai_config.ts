import { runAISelfTest } from './src/services/ai/aiSelfTest';

async function main() {
  console.log('Running AI Config & Decryption Self-Test (A-H)...');
  const res = await runAISelfTest();
  console.log('Self-Test Results:', JSON.stringify(res, null, 2));
  if (!res.success) {
    console.error('Self-Test FAILED!');
    process.exit(1);
  } else {
    console.log('Self-Test PASSED successfully!');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Self-Test execution error:', err);
  process.exit(1);
});
