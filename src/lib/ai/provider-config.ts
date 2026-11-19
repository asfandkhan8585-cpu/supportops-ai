import { MASKED_SECRET } from "@/lib/security";
import { DEFAULT_OPENROUTER_MODEL } from "./openrouter-models";

interface ProviderSettings {
  aiProvider?: string;
  aiApiKey?: string | null;
  aiModel?: string;
}

function getStoredKey(settings?: ProviderSettings | null): string {
  const storedKey = settings?.aiApiKey?.trim();
  return storedKey && storedKey !== MASKED_SECRET ? storedKey : "";
}

export function getOpenAIApiKey(settings?: ProviderSettings | null): string {
  if (!settings?.aiProvider || settings.aiProvider === "openai") {
    const storedKey = getStoredKey(settings);
    if (storedKey) return storedKey;
  } else if (settings.aiProvider !== "openrouter") {
    return "";
  }
  const environmentKey = process.env.OPENAI_API_KEY?.trim();
  return environmentKey && environmentKey !== "sk-your-openai-api-key" ? environmentKey : "";
}

export function getChatProvider(settings?: ProviderSettings | null) {
  const openRouterKey = process.env.OPENROUTER_API_KEY?.trim() || "";
  const openAIKey = getOpenAIApiKey(settings);
  const selectedOpenRouter = settings?.aiProvider === "openrouter";
  const useEnvironmentFallback =
    openRouterKey && !openAIKey && (!settings?.aiProvider || settings.aiProvider === "openai");

  if (selectedOpenRouter || useEnvironmentFallback) {
    return {
      provider: "openrouter" as const,
      apiKey: (selectedOpenRouter && getStoredKey(settings)) || openRouterKey,
      baseURL: "https://openrouter.ai/api/v1",
      model: (selectedOpenRouter && settings.aiModel?.trim()) || DEFAULT_OPENROUTER_MODEL,
    };
  }

  return {
    provider: "openai" as const,
    apiKey: openAIKey,
    baseURL: undefined,
    model: settings?.aiModel || "gpt-4o-mini",
  };
}
