import { describe, it, expect } from 'vitest';
import { success_message, error_message, SharedData } from '../components/basics';
import { DEFAULT_ACTIVE, DEFAULT_ALLOW_PROMPT, DEFAULT_PASTE_CLEANER_ENABLED } from '../components/constants';

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
});
