/**
 * Self-Test Suite for AI-B3: Giao diện AI Assistant
 * - Menu & Route registration
 * - Component & Layout structure
 * - SSE Streaming parser robustness
 * - Security & Sanitization
 * - Modals & Error states
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { createSSEParser } from './src/services/ai/aiAssistantApiClient';
import { ROUTE_REGISTRY, normalizeRoutePath } from './src/routes/routeMetadata';
import { CAPABILITIES } from './src/types/authorization';
import { AIConversationStreamEvent } from './src/services/ai/conversation/conversation.types';

async function runAIB3SelfTest() {
  console.log('======================================================================');
  console.log('RUNNING AUTOMATED SELF-TEST: AI-B3 (Giao diện AI Assistant)');
  console.log('======================================================================');

  let passed = 0;
  let failed = 0;

  function test(name: string, fn: () => void) {
    try {
      fn();
      console.log(`  [PASS] ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  [FAIL] ${name}:`, err.message);
      failed++;
    }
  }

  // 1. Files existence check
  test('AI-B3 components and service files exist', () => {
    const requiredFiles = [
      'src/components/ai/AIAssistantView.tsx',
      'src/components/ai/AIAssistantSidebar.tsx',
      'src/components/ai/AIAssistantMessageList.tsx',
      'src/components/ai/AIAssistantComposer.tsx',
      'src/components/ai/AIAssistantModals.tsx',
      'src/components/common/SafeMarkdown.tsx',
      'src/services/ai/aiAssistantApiClient.ts',
    ];

    for (const f of requiredFiles) {
      assert.ok(fs.existsSync(path.resolve(process.cwd(), f)), `File ${f} must exist`);
    }
  });

  // 2. Route & Capability Registration
  test('ai-assistant route is registered in ROUTE_REGISTRY with CAPABILITIES.AI_CHAT_USE', () => {
    const aiRoute = ROUTE_REGISTRY.find((r) => r.path === 'ai-assistant');
    assert.ok(aiRoute, 'Route ai-assistant must be in ROUTE_REGISTRY');
    assert.equal(aiRoute.requiredCapability, CAPABILITIES.AI_CHAT_USE);
    assert.equal(aiRoute.authRequired, true);

    const normalized = normalizeRoutePath('/ai-assistant');
    assert.equal(normalized, 'ai-assistant');
  });

  // 3. Sidebar Menu & Tab Integration
  test('Sidebar contains ai-assistant in NavTabId and renders when authorized', () => {
    const sidebarSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/layout/Sidebar.tsx'), 'utf-8');
    assert.ok(sidebarSrc.includes("'ai-assistant'"), 'Sidebar must include ai-assistant in NavTabId');
    assert.ok(sidebarSrc.includes('CAPABILITIES.AI_CHAT_USE'), 'Sidebar menu must check CAPABILITIES.AI_CHAT_USE');
    assert.ok(sidebarSrc.includes('Trợ lý AI'), 'Sidebar must display Trợ lý AI label');
  });

  // 4. AppLayout Route Switch Integration
  test('AppLayout renders AIAssistantView for ai-assistant tab', () => {
    const layoutSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/layout/AppLayout.tsx'), 'utf-8');
    assert.ok(layoutSrc.includes("import { AIAssistantView } from '../ai/AIAssistantView'"), 'AppLayout must import AIAssistantView');
    assert.ok(layoutSrc.includes("activeTab === 'ai-assistant'"), 'AppLayout must route activeTab ai-assistant');
  });

  // 5. Header Tab Title Integration
  test('Header includes ai-assistant title and subtitle', () => {
    const headerSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/layout/Header.tsx'), 'utf-8');
    assert.ok(headerSrc.includes("'ai-assistant': {"), 'Header must include ai-assistant title config');
    assert.ok(headerSrc.includes('Trợ lý AI'), 'Header title must be Trợ lý AI');
  });

  // 6. Safe Markdown Security & Sanitization
  test('SafeMarkdown component rejects dangerous pseudo-protocols', () => {
    const markdownSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/common/SafeMarkdown.tsx'), 'utf-8');
    assert.ok(markdownSrc.includes('javascript:'), 'SafeMarkdown must explicitly block javascript:');
    assert.ok(markdownSrc.includes('data:'), 'SafeMarkdown must explicitly block data:');
    assert.ok(!markdownSrc.includes('dangerouslySetInnerHTML'), 'SafeMarkdown must NEVER use dangerouslySetInnerHTML');
    assert.ok(markdownSrc.includes('rel="noopener noreferrer"'), 'SafeMarkdown links must have rel="noopener noreferrer"');
  });

  // 7. SSE Streaming Parser: Fragmentation Handling
  test('createSSEParser handles fragmented chunks cleanly across read boundaries', () => {
    const events: AIConversationStreamEvent[] = [];
    const parser = createSSEParser((ev) => events.push(ev));

    // Splitting chunk in the middle of a string
    parser.feed('data: {"type":"delta","text":"Xin ');
    assert.equal(events.length, 0);

    parser.feed('chào các bạn!"}\n\n');
    assert.equal(events.length, 1);
    assert.equal(events[0].type, 'delta');
    if (events[0].type === 'delta') {
      assert.equal(events[0].text, 'Xin chào các bạn!');
    }
  });

  // 8. SSE Streaming Parser: Multiple Events in single chunk
  test('createSSEParser handles multiple events in single chunk', () => {
    const events: AIConversationStreamEvent[] = [];
    const parser = createSSEParser((ev) => events.push(ev));

    const chunk =
      'data: {"type":"start","conversationId":"c1","userMessageId":"m1","requestId":"r1"}\n\n' +
      ': keep-alive\n\n' +
      'data: {"type":"delta","text":"Nội dung"}\n\n' +
      'data: {"type":"done","assistantMessageId":"m2","finishReason":"stop"}\n\n';

    parser.feed(chunk);
    assert.equal(events.length, 3);
    assert.equal(events[0].type, 'start');
    assert.equal(events[1].type, 'delta');
    assert.equal(events[2].type, 'done');
  });

  // 9. API Client Privacy & Security
  test('AIAssistantApiClient uses authenticated session and never sends user_id', () => {
    const clientSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/services/ai/aiAssistantApiClient.ts'), 'utf-8');
    assert.ok(clientSrc.includes('getSupabaseClient'), 'Client must use supabase auth session');
    assert.ok(clientSrc.includes('Authorization'), 'Client must attach Bearer token');
    assert.ok(!clientSrc.includes('user_id:'), 'Client must NOT send user_id payload');
    assert.ok(!clientSrc.includes('owner_user_id:'), 'Client must NOT send owner_user_id payload');
  });

  // 10. AIAssistantView Abort & Idempotency
  test('AIAssistantView implements client abort signal and clientRequestId', () => {
    const viewSrc = fs.readFileSync(path.resolve(process.cwd(), 'src/components/ai/AIAssistantView.tsx'), 'utf-8');
    assert.ok(viewSrc.includes('AbortController'), 'AIAssistantView must use AbortController');
    assert.ok(viewSrc.includes('clientRequestId'), 'AIAssistantView must generate clientRequestId');
    assert.ok(viewSrc.includes('CAPABILITIES.AI_CONVERSATIONS_DELETE_OWN'), 'AIAssistantView must guard delete with capability');
  });

  console.log('----------------------------------------------------------------------');
  console.log(`Results: ${passed} passed, ${failed} failed.`);
  console.log('======================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAIB3SelfTest();
