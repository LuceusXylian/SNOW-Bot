import { describe, it, expect, vi } from 'vitest';
import { success_message, error_message, SharedData, background_check_conditions, migrateScriptingData } from '../components/basics';
import { withTimeout } from '../components/messaging';
import { DEFAULT_ACTIVE, DEFAULT_ALLOW_PROMPT, DEFAULT_PASTE_CLEANER_ENABLED } from '../components/constants';
import { ConditionType, ConditionTargetType } from '../components/scripting';
import { resolveTemplateContent } from '../components/template-resolution';

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

  it('merges predefined global and profile variables into persistent variables', async () => {
    const LOGGER: any = { from: 0, debug: () => {}, log: () => {} };
    const COMMANDER: any = { LOGGER };
    const sd = new SharedData(LOGGER, COMMANDER, {
      predefined_global_vars: { environment: 'prod' },
      predefined_profile_vars: { '2': { user: 'alice' } },
      button_grid_index: 2,
    });

    const merged = sd.buildPersistentVariables();
    expect(merged).toEqual({ environment: 'prod', user: 'alice' });
    expect(sd.data.persistent_variables).toEqual({ environment: 'prod', user: 'alice' });
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

  it('unsetActiveProfileVars clears only the previous profile-scoped values and keeps globals', () => {
    const LOGGER: any = { from: 0, debug: () => {}, log: () => {} };
    const COMMANDER: any = { LOGGER };
    const sd = new SharedData(LOGGER, COMMANDER, {
      predefined_global_vars: { shared: 'global' },
      predefined_profile_vars: {
        0: { user: 'alice', shared: 'profile-override' },
      },
      button_grid_index: 0,
      persistent_variables: { shared: 'profile-override', user: 'alice' },
    });

    sd.unsetActiveProfileVars(0);

    expect(sd.data.persistent_variables).toEqual({ shared: 'global' });
  });

  it('background_check_conditions filters by hostname and URL conditions', () => {
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

    expect(background_check_conditions('https://example.com/page', { conditionGroups: [{ conditions: hostnameConditions }] })).toBe(true);
    expect(background_check_conditions('https://foo.example.com/page', { conditionGroups: [{ conditions: hostnameConditions }] })).toBe(false);
    expect(background_check_conditions('https://example.com/tickets/1', { conditionGroups: [{ conditions: urlConditions }] })).toBe(true);
    expect(background_check_conditions('https://example.com/orders/1', { conditionGroups: [{ conditions: urlConditions }] })).toBe(false);
  });

  it('supports OR between condition groups and migrates legacy conditions', () => {
    const oldData = {
      scripts: [{ version: 0, id: 'script', name: 'Script', hide: false, function_arguments: [], lines: [{ conditions: [], actions: [] }] }],
      triggers: [{ id: 'trigger', name: 'Trigger', script_id: 'script', events: [], every: null, conditions: [] }],
    } as any;
    migrateScriptingData(oldData);

    expect(oldData.scripts[0].lines[0].conditionGroups).toEqual([{ conditions: [] }]);
    expect(oldData.scripts[0].lines[0].conditions).toBeUndefined();
    expect(oldData.triggers[0].conditionGroups).toEqual([{ conditions: [] }]);
    expect(background_check_conditions('https://example.com/orders/1', {
      conditionGroups: [
        { conditions: [{ target: { target_type: ConditionTargetType.HOSTNAME }, type: ConditionType.IS, string_value: 'other.example' }] },
        { conditions: [{ target: { target_type: ConditionTargetType.URL }, type: ConditionType.CONTAINS, string_value: '/orders/' }] },
      ],
    })).toBe(true);
  });

  it('replaces unresolved placeholders with empty strings when prompting is disabled', async () => {
    const output = await resolveTemplateContent('Hello [Name]', {
      resolveLabelValue: () => null,
      allowPrompt: false,
    });

    expect(output).toBe('Hello ');
  });

  it('falls back safely when prompt resolution throws', async () => {
    const output = await resolveTemplateContent('Hello [Name]', {
      resolveLabelValue: () => null,
      allowPrompt: true,
      promptForValue: async () => {
        throw new Error('prompt blocked');
      },
    });

    expect(output).toBe('Hello ');
  });
});
