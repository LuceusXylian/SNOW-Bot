export interface TemplateResolutionOptions {
  resolveLabelValue: (label: string) => string | null;
  allowPrompt?: boolean;
  promptForValue?: (label: string) => Promise<string> | string;
}

const SHORTCODE_REGEX = /\[(.+?)\]/g;

export async function resolveTemplateContent(template: string, options: TemplateResolutionOptions): Promise<string> {
  const matches = Array.from(template.matchAll(SHORTCODE_REGEX));
  if (matches.length === 0) {
    return template;
  }

  const resolved = new Map<string, string>();

  for (const match of matches) {
    const label = match[1]!.trim();
    if (!label || resolved.has(label)) {
      continue;
    }

    const value = options.resolveLabelValue(label);
    if (value !== null) {
      resolved.set(label, value);
      continue;
    }

    if (!options.allowPrompt) {
      resolved.set(label, "");
      continue;
    }

    try {
      const promptValue = await Promise.resolve(options.promptForValue?.(label));
      resolved.set(label, promptValue?.trim() ?? "");
    } catch {
      resolved.set(label, "");
    }
  }

  return template.replace(SHORTCODE_REGEX, (_full, label) => {
    const normalized = label.trim();
    return resolved.get(normalized) ?? "";
  });
}
