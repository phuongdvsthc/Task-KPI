import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mapProviderError } from './aiErrorMapper';
import { AIGatewayError } from './aiGateway.types';
import { SystemRateLimiter } from './systemRateLimiter';

describe('Rate Limit Handling & AI-D1 Acceptance Tests', () => {
  it('1. maps 429 RESOURCE_EXHAUSTED errors with Retry-After header correctly', () => {
    const mockError = {
      status: 429,
      message: 'RESOURCE_EXHAUSTED: Quota exceeded',
      response: {
        headers: new Headers({ 'retry-after': '25' })
      }
    };

    const mapped = mapProviderError(mockError);
    expect(mapped).toBeInstanceOf(AIGatewayError);
    expect(mapped.code).toBe('AI_RATE_LIMITED');
    expect(mapped.status).toBe(429);
    expect(mapped.retryable).toBe(true);
    expect(mapped.retryAfterSeconds).toBe(25);
    expect(mapped.message).toContain('25 giây');
  });

  it('2. parses Google RPC RetryInfo (retryDelay) and quota metrics', () => {
    const mockError = {
      status: 429,
      message: 'RESOURCE_EXHAUSTED: generativelanguage.googleapis.com/generate_content_free_tier_requests Limit: 20',
      errorDetails: [
        {
          '@type': 'type.googleapis.com/google.rpc.RetryInfo',
          retryDelay: { seconds: 19, nanos: 480000000 }
        },
        {
          '@type': 'type.googleapis.com/google.rpc.QuotaFailure',
          quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests'
        }
      ]
    };

    const mapped = mapProviderError(mockError);
    expect(mapped.code).toBe('AI_RATE_LIMITED');
    expect(mapped.retryAfterSeconds).toBe(19);
    expect(mapped.quotaMetric).toBe('generativelanguage.googleapis.com/generate_content_free_tier_requests');
  });

  it('3. system-wide rate limiter blocks when threshold exceeded', async () => {
    const limiter = new SystemRateLimiter(2); // limit 2 requests per minute

    const mockSupabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ count: 2, error: null })
        })
      })
    };

    const res = await limiter.checkAndRecord(mockSupabaseAdmin, 'assistant_chat');
    expect(res.allowed).toBe(false);
    expect(res.errorCode).toBe('AI_INTERNAL_RATE_LIMITED');
    expect(res.retryAfterSeconds).toBe(20);
  });

  it('4. system-wide rate limiter allows when under threshold', async () => {
    const limiter = new SystemRateLimiter(5);

    const mockSupabaseAdmin = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          gte: vi.fn().mockResolvedValue({ count: 1, error: null })
        })
      })
    };

    const res = await limiter.checkAndRecord(mockSupabaseAdmin, 'assistant_chat');
    expect(res.allowed).toBe(true);
  });

  it('5. non-retryable client errors like 400 or 401 are marked non-retryable', () => {
    const err401 = { status: 401, message: 'Unauthorized API key' };
    const mapped = mapProviderError(err401);
    expect(mapped.retryable).toBe(false);
    expect(mapped.code).toBe('AI_PROVIDER_UNAUTHORIZED');
  });
});
