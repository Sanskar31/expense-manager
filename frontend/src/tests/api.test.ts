import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { request } from '../services/api';

describe('API request function', () => {
  const originalFetch = window.fetch;

  beforeEach(() => {
    window.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    });
    
    vi.stubEnv('VITE_AI_URL', 'https://mock-ai-function-url.aws/');
  });

  afterEach(() => {
    window.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it('uses standard VITE_API_URL proxy for normal requests', async () => {
    await request('/transactions', { method: 'GET' });
    expect(window.fetch).toHaveBeenCalledWith(
      '/api/transactions',
      expect.objectContaining({ method: 'GET' })
    );
  });

  it('uses VITE_AI_URL directly for /ai/query requests to bypass API Gateway', async () => {
    await request('/ai/query', { method: 'POST' });
    expect(window.fetch).toHaveBeenCalledWith(
      'https://mock-ai-function-url.aws/',
      expect.objectContaining({ method: 'POST' })
    );
  });
});
