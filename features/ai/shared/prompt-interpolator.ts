export type PromptVariables = Record<string, string | number | boolean | undefined>;

const VARIABLE_PATTERN = /\{\{(\s*[\w.]+\s*)\}\}/g;

export function interpolatePrompt(
  template: string,
  variables: PromptVariables
): string {
  return template.replace(VARIABLE_PATTERN, (_match, key: string) => {
    const normalizedKey = key.trim();
    const value = variables[normalizedKey];
    if (value === undefined || value === null) {
      return "";
    }
    return String(value);
  });
}
