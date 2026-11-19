import { MASKED_SECRET } from "@/lib/security";

interface ProviderSettings {
  aiProvider?: string;
  aiApiKey?: string | null;
  aiModel?: string;
}

export function getOpenAIApiKey(settings?: ProviderSettings | null): string {
  if (settings?.aiProvider && settings.aiProvider !== "openai") return "";
  const storedKey = settings?.aiApiKey?.trim();
  if (storedKey && storedKey !== MASKED_SECRET) return storedKey;
  const environmentKey = process.env.OPENAI_API_KEY?.trim();
  return environmentKey && environmentKey !== "sk-your-openai-api-key" ? environmentKey : "";
}

export function getChatProvider(settings?: ProviderSettings | null) {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim();
  if (openRouterKey) {
    return {
      provider: "openrouter" as const,
      apiKey: openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
      model: "openai/gpt-oss-120b",
    };
  }

  return {
    provider: "openai" as const,
    apiKey: getOpenAIApiKey(settings),
    baseURL: undefined,
    model: settings?.aiModel || "gpt-4o-mini",
  };
}
