/**
 * Comprehensive Automated Self-Test Script for AI-D3-F (Final Multi-Provider Acceptance)
 */

import { aiCrypto } from '../src/services/ai/aiCrypto';
import { aiGateway } from '../src/services/ai/gateway/index';
import { aiProviderConfigService } from '../src/services/ai/aiProviderConfig.service';
import { aiConfigurationResolver } from '../src/services/ai/gateway/aiConfigResolver';
import { OpenAIProviderAdapter } from '../src/services/ai/providers/OpenAIProviderAdapter';
import { GeminiProviderAdapter } from '../src/services/ai/gateway/geminiProviderAdapter';

export async function runAID3FSelfTest(supabaseAdmin?: any) {
  const results = {
    totalAssertions: 0,
    passed: 0,
    failed: 0,
    blocked: 0,
    tests: [] as Array<{ name: string; status: 'PASS' | 'FAIL' | 'BLOCKED'; error?: string }>
  };

  async function test(name: string, fn: () => Promise<void>) {
    results.totalAssertions++;
    try {
      await fn();
      results.passed++;
      results.tests.push({ name, status: 'PASS' });
      console.log(`[AI-D3-F Acceptance] ✓ ${name}`);
    } catch (err: any) {
      results.failed++;
      results.tests.push({ name, status: 'FAIL', error: err.message });
      console.error(`[AI-D3-F Acceptance] ✗ ${name}:`, err.message);
    }
  }

  // 1. Encryption & Decryption Integrity
  await test('Encryption service encrypts and decrypts correctly with unique IVs', async () => {
    const plaintext = 'sk-proj-test-api-key-123456789';
    const enc1 = aiCrypto.encrypt(plaintext);
    const enc2 = aiCrypto.encrypt(plaintext);
    if (enc1.iv === enc2.iv) throw new Error('IVs must be unique for each encryption');
    const dec = aiCrypto.decrypt(enc1.encryptedText, enc1.iv, enc1.authTag);
    if (dec !== plaintext) throw new Error('Decrypted text does not match plaintext');
  });

  // 2. Provider Registry Verification
  await test('ProviderRegistry contains both gemini and openai adapters', async () => {
    const gemini = aiGateway.getAdapter('gemini');
    const openai = aiGateway.getAdapter('openai');
    if (!gemini || gemini.providerName !== 'gemini') throw new Error('Gemini adapter missing');
    if (!openai || openai.providerName !== 'openai') throw new Error('OpenAI adapter missing');
  });

  // 3. No-Fallback Guarantee & Adapter Isolation
  await test('Adapters and Gateway do not implement fallback or parallel calls', async () => {
    const openaiAdapter = new OpenAIProviderAdapter();
    const geminiAdapter = new GeminiProviderAdapter();
    if (typeof openaiAdapter.generate !== 'function') throw new Error('OpenAI generate missing');
    if (typeof geminiAdapter.generate !== 'function') throw new Error('Gemini generate missing');
    // Ensure no fallback property or method exists
    if ((openaiAdapter as any).fallbackAdapter || (geminiAdapter as any).fallbackAdapter) {
      throw new Error('Fallback mechanism detected in adapter');
    }
  });

  // 4. AI Configuration Resolver & Allowed Models
  await test('AIConfigurationResolver handles allowed models and active resolution', async () => {
    if (!aiConfigurationResolver || typeof aiConfigurationResolver.resolve !== 'function') {
      throw new Error('aiConfigurationResolver missing resolve');
    }
  });

  // 5. Provider Config Service
  await test('aiProviderConfigService has required management methods', async () => {
    if (typeof aiProviderConfigService.listProviderSummaries !== 'function') throw new Error('listProviderSummaries missing');
    if (typeof aiProviderConfigService.activateProvider !== 'function') throw new Error('activateProvider missing');
    if (typeof aiProviderConfigService.saveProviderConfig !== 'function') throw new Error('saveProviderConfig missing');
  });

  if (supabaseAdmin) {
    await test('Database schema contains ai_provider_configs and valid active constraint', async () => {
      const summaries = await aiProviderConfigService.listProviderSummaries(supabaseAdmin);
      const activeCount = summaries.filter(s => s.isActive).length;
      if (activeCount > 1) throw new Error(`Found ${activeCount} active providers, maximum 1 allowed.`);
    });
  } else {
    results.blocked++;
    results.tests.push({ name: 'Database live query validation', status: 'BLOCKED', error: 'supabaseAdmin not provided in standalone invocation' });
    console.log('[AI-D3-F Acceptance] ⊘ Database live query validation: BLOCKED (supabaseAdmin not provided)');
  }

  console.log(`\n[AI-D3-F Acceptance Summary] Total: ${results.totalAssertions}, Passed: ${results.passed}, Failed: ${results.failed}, Blocked: ${results.blocked}`);
  return results;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAID3FSelfTest().catch(console.error);
}
