import type { LlmCompletionRequest, LlmProvider } from "@/features/ai/types/llm";

/** JSON mode prevents Markdown fences or invalid escaping from breaking Arabic requests. */
export class FinanceAiProvider implements LlmProvider {
  readonly identity = { id:"finance-openai", name:"Finance AI" };
  constructor(private readonly apiKey:string, private readonly model:string) {}
  async complete(request:LlmCompletionRequest) {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method:"POST",headers:{Authorization:`Bearer ${this.apiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({model:this.model,messages:request.messages,response_format:{type:"json_object"},max_completion_tokens:3000}),
      signal:AbortSignal.timeout(25000),
    });
    if (!response.ok) throw new Error(`Finance AI provider failed (${response.status}).`);
    const data = await response.json();
    const choice = data.choices?.[0];
    if (choice?.finish_reason !== "stop" || typeof choice.message?.content !== "string") throw new Error("Incomplete finance AI response.");
    return {content:choice.message.content,model:this.model,providerId:this.identity.id};
  }
}
