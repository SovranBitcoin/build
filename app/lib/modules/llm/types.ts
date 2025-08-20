import type { LanguageModelV1 } from "ai";
import type { IProviderSetting } from "~/types/model";

export interface ModelInfo {
  name: string;
  label: string;
  provider: string;
  maxTokenAllowed: number;
  routstrData?: {
    id: string;
    name?: string;
    context_length?: number;
    top_provider?: {
      context_length?: number;
      max_completion_tokens?: number;
    };
    sats_pricing?: {
      prompt?: number;
      completion?: number;
      max_cost?: number;
    };
  };
}

export interface ProviderInfo {
  name: string;
  staticModels: ModelInfo[];
  getDynamicModels?: (
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ) => Promise<ModelInfo[]>;
  getModelInstance: (options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }) => LanguageModelV1;
  getApiKeyLink?: string;
  labelForGetApiKey?: string;
  icon?: string;
}
export interface ProviderConfig {
  baseUrlKey?: string;
  baseUrl?: string;
  apiTokenKey?: string;
}
