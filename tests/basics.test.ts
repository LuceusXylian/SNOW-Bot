import { describe, it, expect, vi } from 'vitest';
import { success_message, error_message, SharedData, shouldSendMessageToFrame } from '../components/basics';
import { withTimeout } from '../components/messaging';
import { DEFAULT_ACTIVE, DEFAULT_ALLOW_PROMPT, DEFAULT_PASTE_CLEANER_ENABLED } from '../components/constants';
import { ConditionType, ConditionTargetType } from '../components/scripting';

describe('basics utilities', () => {
  it('success_message returns success payload', () => {
    const payload = success_message({ a: 1 });
    expect(payload).toEqual({ success: true, data: { a: 1 } });
  });

  it('error_message returns error payload', () => {
    const payload = error_message('boom');
    expect(payload).toEqual({ success: false, error: 'boom' });
  });

  it('SharedData defaults are applied', () => {
    // Pass minimal stubs for LOGGER and COMMANDER
    const LOGGER: any = { from: 0, debug: () => {} };
    const COMMANDER: any = { LOGGER };
    const sd = new SharedData(LOGGER, COMMANDER, {});
    expect(sd.data.active).toBe(DEFAULT_ACTIVE);
    expect(sd.data.allow_prompt).toBe(DEFAULT_ALLOW_PROMPT);
    expect(sd.data.paste_cleaner_enabled).toBe(DEFAULT_PASTE_CLEANER_ENABLED);
    expect(Array.isArray(sd.data.templates)).toBe(true);
  });

  it('withTimeout rejects when a promise takes too long', async () => {
    vi.useFakeTimers();
    try {
      const slowPromise = new Promise<string>((resolve) => {
        setTimeout(() => resolve('done'), 100);
      });

      const assertion = expect(withTimeout(slowPromise, 10, 'message timed out')).rejects.toThrow('message timed out');
      await vi.advanceTimersByTimeAsync(10);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  it('shouldSendMessageToFrame filters by hostname and URL conditions', () => {
    const hostnameConditions = [{
      target: { target_type: ConditionTargetType.HOSTNAME },
      type: ConditionType.IS,
      string_value: 'example.com',
    }];
    const urlConditions = [{
      target: { target_type: ConditionTargetType.URL },
      type: ConditionType.CONTAINS,
      string_value: '/tickets',
    }];

    expect(shouldSendMessageToFrame('https://example.com/page', { conditions: hostnameConditions })).toBe(true);
    expect(shouldSendMessageToFrame('https://foo.example.com/page', { conditions: hostnameConditions })).toBe(false);
    expect(shouldSendMessageToFrame('https://example.com/tickets/1', { conditions: urlConditions })).toBe(true);
    expect(shouldSendMessageToFrame('https://example.com/orders/1', { conditions: urlConditions })).toBe(false);
  });
});
