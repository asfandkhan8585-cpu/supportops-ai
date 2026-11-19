export interface AIMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: ToolCall[];
  reasoning_details?: unknown;
  tool_call_id?: string;
  name?: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ToolResult {
  tool_call_id: string;
  content: string;
}

export type AIConfig = ReturnType<typeof import("./provider-config").getChatProvider> & {
  embeddingApiKey: string;
  maxTokens: number;
  temperature: number;
};

export interface ConversationContext {
  businessName: string;
  businessDesc: string;
  welcomeMessage: string;
  tone: string;
  language: string;
  knowledgeBase: KnowledgeItem[];
  customerName: string;
  customerHistory: string[];
  channel: string;
}

export interface KnowledgeItem {
  id: string;
  category: string;
  title: string;
  content: string;
}
