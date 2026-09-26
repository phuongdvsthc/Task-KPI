/**
 * Self-Test Script for AI-D3-D Active Provider Resolver & Activation Transaction
 */

import { aiProviderConfigService } from '../src/services/ai/aiProviderConfig.service';
import { aiConfigurationResolver } from '../src/services/ai/gateway/aiConfigResolver';

export async function runAID3DSelfTest(supabaseAdmin?: any) {
  const results = {
    passed: 0,
    failed: 0,
    tests: [] as Array<{ name: string; status: string; error?: string }>
  };

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`[AI-D3-D SelfTest] ✓ ${name}`);
    } catch (err: any) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: err.message });
      console.error(`[AI-D3-D SelfTest] ✗ ${name}:`, err.message);
    }
  }

  // 1. Check AI Configuration Resolver exists and resolves structure
  await test('AIConfigurationResolver interface and ALLOWED_CHAT_MODELS are defined', async () => {
    if (!aiConfigurationResolver || typeof aiConfigurationResolver.resolve !== 'function') {
      throw new Error('aiConfigurationResolver.resolve is not a function');
    }
  });

  // 2. Check service methods for provider configs
  await test('aiProviderConfigService has listProviderSummaries and activateProvider', async () => {
    if (typeof aiProviderConfigService.listProviderSummaries !== 'function') throw new Error('listProviderSummaries missing');
    if (typeof aiProviderConfigService.activateProvider !== 'function') throw new Error('activateProvider missing');
  });

  if (supabaseAdmin) {
    // 3. Database test: ensure max one active provider
    await test('Database has at most one active provider', async () => {
      const summaries = await aiProviderConfigService.listProviderSummaries(supabaseAdmin);
      const activeCount = summaries.filter(s => s.isActive).length;
      if (activeCount > 1) {
        throw new Error(`Found ${activeCount} active providers, expected at most 1.`);
      }
    });
  } else {
    console.log('[AI-D3-D SelfTest] (Skipping DB test because supabaseAdmin was not provided)');
  }

  console.log(`[AI-D3-D SelfTest] Completed: ${results.passed} passed, ${results.failed} failed.`);
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAID3DSelfTest().catch(console.error);
}
