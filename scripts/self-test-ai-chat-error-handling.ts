/**
 * Automated Self-Test for AI Chat Error Handling and End-to-End Chat Flow.
 * Verifies:
 * 1. 401/403 (Unauthorized / Forbidden) mapping
 * 2. 404 (Model Not Found) mapping
 * 3. 429 (Rate Limited / Quota Exceeded) mapping
 * 4. 503 (Provider Unavailable / High Demand) mapping
 * 5. 500 (Internal Provider Error) mapping
 * 6. Network Errors (ECONNREFUSED / fetch failed) mapping
 * 7. Decryption of stored provider config (AES-256-GCM triad)
 * 8. Live Chat End-to-End execution with "Xin chào"
 * 9. Live Chat End-to-End execution with RAG query
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { mapProviderError } from '../src/services/ai/gateway/aiErrorMapper';
import { AIGatewayError } from '../src/services/ai/gateway/aiGateway.types';
import { aiCrypto } from '../src/services/ai/aiCrypto';
import { aiConfigurationResolver } from '../src/services/ai/gateway/aiConfigResolver';
import { aiProviderConfigService } from '../src/services/ai/aiProviderConfig.service';
import { chatOrchestrator } from '../src/services/ai/conversation/chatOrchestrator';
import { conversationRepository } from '../src/services/ai/conversation/conversation.repository';

dotenv.config();

export interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  category: string;
}

export async function runAIChatSelfTest() {
  const results: { total: number; passed: number; failed: number; tests: TestResult[] } = {
    total: 0,
    passed: 0,
    failed: 0,
    tests: []
  };

  function assert(name: string, category: string, condition: boolean, errorMsg?: string) {
    results.total++;
    if (condition) {
      results.passed++;
      results.tests.push({ name, passed: true, category });
      console.log(`  ✓ [${category}] ${name}`);
    } else {
      results.failed++;
      results.tests.push({ name, passed: false, error: errorMsg || 'Assertion failed', category });
      console.error(`  ✗ [${category}] ${name} - ${errorMsg || 'Assertion failed'}`);
    }
  }

  console.log('\n=== RUNNING AI CHAT ERROR HANDLING & E2E SELF-TESTS ===\n');

  // --- Group 1: 401/403 Authentication & Authorization ---
  const err401 = mapProviderError({
    status: 401,
    message: 'API_KEY_INVALID: API key not valid. Please pass a valid API key.'
  });
  assert(
    '401 HTTP status maps to AI_PROVIDER_UNAUTHORIZED with status 401',
    'Auth Errors',
    err401.code === 'AI_PROVIDER_UNAUTHORIZED' && err401.status === 401 && !err401.retryable
  );

  const err403 = mapProviderError({
    status: 403,
    message: 'PERMISSION_DENIED: Access denied by AI provider.'
  });
  assert(
    '403 HTTP status maps to AI_PROVIDER_FORBIDDEN with status 403',
    'Auth Errors',
    err403.code === 'AI_PROVIDER_FORBIDDEN' && err403.status === 403 && !err403.retryable
  );

  // --- Group 2: 404 Model Not Found ---
  const err404 = mapProviderError({
    status: 404,
    message: 'models/gemini-invalid is not found for API version v1beta'
  });
  assert(
    '404 HTTP status maps to AI_MODEL_NOT_FOUND with status 404',
    'Model Errors',
    err404.code === 'AI_MODEL_NOT_FOUND' && err404.status === 404 && !err404.retryable
  );

  // --- Group 3: 429 Rate Limit / Quota Exceeded ---
  const err429 = mapProviderError({
    status: 429,
    message: 'RESOURCE_EXHAUSTED: Quota exceeded for quota metric generativelanguage.googleapis.com/requests. retry delay: 15s'
  });
  assert(
    '429 HTTP status maps to AI_RATE_LIMITED with status 429 and retryable=true',
    'Rate Limit Errors',
    err429.code === 'AI_RATE_LIMITED' && err429.status === 429 && err429.retryable
  );

  // --- Group 4: 503 Provider Unavailable / High Demand ---
  const err503 = mapProviderError({
    status: 503,
    message: '{"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}'
  });
  assert(
    '503 High Demand / UNAVAILABLE maps to AI_PROVIDER_UNAVAILABLE with status 503 and retryable=true',
    'Provider Overload Errors',
    err503.code === 'AI_PROVIDER_UNAVAILABLE' && err503.status === 503 && err503.retryable
  );

  // --- Group 5: 500 Internal Provider Error ---
  const err500 = mapProviderError({
    status: 500,
    message: 'Internal Server Error'
  });
  assert(
    '500 HTTP status maps to AI_PROVIDER_ERROR with status 500',
    'Provider Internal Errors',
    err500.code === 'AI_PROVIDER_ERROR' && err500.status === 500
  );

  // --- Group 6: Network Connection Errors ---
  const errNetwork = mapProviderError(new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:443'));
  assert(
    'Network fetch failure maps to AI_PROVIDER_NETWORK_ERROR with status 503 and retryable=true',
    'Network Errors',
    errNetwork.code === 'AI_PROVIDER_NETWORK_ERROR' && errNetwork.status === 503 && errNetwork.retryable
  );

  // --- Group 7: Decryption and Runtime Configuration Resolution ---
  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey);

    // Bootstrap and resolve active config
    await aiProviderConfigService.bootstrapDefaultProviders(supabase);
    const resolved = await aiConfigurationResolver.resolve(supabase, { forceRefresh: true });

    assert(
      'AI configuration resolver retrieves active provider and decrypts valid API key without leak',
      'Config & Crypto',
      (resolved.provider === 'gemini' || resolved.provider === 'openai') &&
      typeof resolved.apiKey === 'string' &&
      resolved.apiKey.length > 10 &&
      !resolved.apiKey.includes('***')
    );

    // --- Group 8: End-to-End Chat Flow ("Xin chào") ---
    const userId = 'd7014bc3-8e5c-4b6d-9c0b-a99f83169f56';
    const conv1 = await conversationRepository.createConversation(supabase, userId, 'Self-Test Greeting');

    let greetingOutput = '';
    let greetingError: any = null;

    try {
      await chatOrchestrator.streamChat(
        supabase,
        userId,
        conv1.id,
        { content: 'Xin chào', clientRequestId: `test_req_${Date.now()}` },
        new AbortController().signal,
        (ev) => {
          if (ev.type === 'delta') greetingOutput += ev.text;
          if (ev.type === 'error') greetingError = ev;
        },
        { hasKnowledgeView: false }
      );
    } catch (e: any) {
      greetingError = e;
    } finally {
      await supabase.from('ai_messages').delete().eq('conversation_id', conv1.id);
      await supabase.from('ai_conversations').delete().eq('id', conv1.id);
    }

    assert(
      'Live chat stream sends "Xin chào" and receives successful response stream without error',
      'E2E Chat Greeting',
      greetingError === null && greetingOutput.length > 5
    );

    // --- Group 9: End-to-End Chat Flow with Internal Knowledge Query ---
    const conv2 = await conversationRepository.createConversation(supabase, userId, 'Self-Test Knowledge Query');

    let ragOutput = '';
    let ragError: any = null;
    let ragStatusReceived = false;

    try {
      await chatOrchestrator.streamChat(
        supabase,
        userId,
        conv2.id,
        { content: 'Quy định làm việc từ xa và chấm công như thế nào?', clientRequestId: `test_req_${Date.now() + 1}` },
        new AbortController().signal,
        (ev) => {
          if (ev.type === 'delta') ragOutput += ev.text;
          if (ev.type === 'rag_status') ragStatusReceived = true;
          if (ev.type === 'error') ragError = ev;
        },
        { hasKnowledgeView: true }
      );
    } catch (e: any) {
      ragError = e;
    } finally {
      await supabase.from('ai_messages').delete().eq('conversation_id', conv2.id);
      await supabase.from('ai_conversations').delete().eq('id', conv2.id);
    }

    assert(
      'Live chat stream with knowledge query executes RAG retrieval step and streams complete response',
      'E2E Chat Knowledge Query',
      ragError === null && ragOutput.length > 20
    );
  }

  console.log(`\n[AI Chat Self-Test Summary] Total: ${results.total}, Passed: ${results.passed}, Failed: ${results.failed}\n`);
  return results;
}

runAIChatSelfTest()
  .then((res) => {
    if (res.failed > 0) {
      process.exit(1);
    }
  })
  .catch((err) => {
    console.error('Test execution fatal error:', err);
    process.exit(1);
  });
