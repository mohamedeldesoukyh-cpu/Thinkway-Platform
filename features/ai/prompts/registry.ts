import { interpolatePrompt, type PromptVariables } from "../shared/prompt-interpolator";

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  template: string;
  defaultVariables?: PromptVariables;
  tags?: string[];
}

export interface RenderedPrompt {
  id: string;
  content: string;
}

export class PromptLibrary {
  private readonly templates = new Map<string, PromptTemplate>();

  register(template: PromptTemplate): void {
    this.templates.set(template.id, template);
  }

  registerMany(templates: PromptTemplate[]): void {
    for (const template of templates) {
      this.register(template);
    }
  }

  get(id: string): PromptTemplate | undefined {
    return this.templates.get(id);
  }

  list(): PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  render(id: string, variables: PromptVariables = {}): RenderedPrompt {
    const template = this.templates.get(id);
    if (!template) {
      throw new Error(`Prompt template not found: ${id}`);
    }

    const mergedVariables: PromptVariables = {
      ...template.defaultVariables,
      ...variables,
    };

    return {
      id: template.id,
      content: interpolatePrompt(template.template, mergedVariables),
    };
  }
}

export function createPromptLibrary(): PromptLibrary {
  return new PromptLibrary();
}
