/**
 * Settings Cascade Helper
 * 
 * Merges project-wide defaults with email-specific overrides.
 * Email settings take precedence when non-null.
 * 
 * Hierarchy: Email-specific → Project defaults → Hardcoded fallbacks
 */

export interface ProjectSettings {
  system_prompt: string;
  model: string;
  reasoning_effort: string;
  text_verbosity: string;
  max_output_tokens: number;
  cost_input_per_1m: number;
  cost_output_per_1m: number;
}

export interface EmailSettings {
  system_prompt?: string | null;
  model?: string | null;
  reasoning_effort?: string | null;
  text_verbosity?: string | null;
  max_output_tokens?: number | null;
}

export interface MergedSettings {
  system_prompt: string;
  model: string;
  reasoningEffort: string;
  textVerbosity: string;
  maxOutputTokens: number;
  costInputPer1m: number;
  costOutputPer1m: number;
}

/**
 * Merge email-specific settings with project defaults
 * Email settings override project defaults only when explicitly set (non-null)
 */
export function mergeSettings(
  projectSettings: ProjectSettings | null,
  emailSettings: EmailSettings | null
): MergedSettings {
  
  // Hardcoded fallbacks (used if project_settings doesn't exist)
  const defaults: ProjectSettings = {
    system_prompt: 'You are Rally, an intelligent email assistant.',
    model: 'gpt-5.1',
    reasoning_effort: 'medium',
    text_verbosity: 'low',
    max_output_tokens: 4000,
    cost_input_per_1m: 2.50,
    cost_output_per_1m: 10.00
  };

  // Start with project settings (or fallbacks)
  const base = projectSettings || defaults;

  // Override with email-specific settings where present
  return {
    system_prompt: emailSettings?.system_prompt ?? base.system_prompt,
    model: emailSettings?.model ?? base.model,
    reasoningEffort: emailSettings?.reasoning_effort ?? base.reasoning_effort,
    textVerbosity: emailSettings?.text_verbosity ?? base.text_verbosity,
    maxOutputTokens: emailSettings?.max_output_tokens ?? base.max_output_tokens,
    costInputPer1m: base.cost_input_per_1m,
    costOutputPer1m: base.cost_output_per_1m
  };
}

