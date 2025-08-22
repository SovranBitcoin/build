import { BaseProvider } from "~/lib/modules/llm/base-provider";
import type { ModelInfo } from "~/lib/modules/llm/types";
import type { LanguageModelV1 } from "ai";
import type { IProviderSetting } from "~/types/model";
import { createOpenAI } from "@ai-sdk/openai";

export default class RoutstrProvider extends BaseProvider {
  name = "Routstr";
  getApiKeyLink = "https://routstr.com/api-keys"; // Placeholder URL

  config = {
    apiTokenKey: "ROUTSTR_API_KEY",
    baseUrl: "https://api.routstr.com/v1",
  };

  // Static models are kept minimal since dynamic models will be loaded from API
  staticModels: ModelInfo[] = [
    {
      name: "openai/gpt-oss-120b",
      label: "GPT OSS 120B (via Routstr)",
      provider: "Routstr",
      maxTokenAllowed: 4000, // Conservative limit for this model
    },
    {
      name: "openai/o1-mini",
      label: "GPT O1 Mini",
      provider: "Routstr",
      maxTokenAllowed: 4000, // Conservative limit for this model
    },
  ];

  async getDynamicModels(
    apiKeys?: Record<string, string>,
    settings?: IProviderSetting,
    serverEnv?: Record<string, string>,
  ): Promise<ModelInfo[]> {
    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: settings,
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: "ROUTSTR_BASE_URL",
      defaultApiTokenKey: "ROUTSTR_API_KEY",
    });

    // Use hardcoded Cashu token if no API key is provided
    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        console.warn(
          `Failed to fetch Routstr models: ${response.status} ${response.statusText}`,
        );
        return [];
      }

      const res = (await response.json()) as any;
      const data = res.data;

      console.log(JSON.stringify(data, null, 2));

      const models = data.map((model: any) => {
        // idk if this is right, someone please check.
        const contextLength =
          model.top_provider?.context_length -
          model.top_provider?.max_completion_tokens;
        const maxCompletionTokens = model.top_provider?.max_completion_tokens;

        const modelInfo = {
          name: model.id,
          label: model.name || model.id,
          provider: this.name,
          maxTokenAllowed: contextLength,

          // Store the full model data for the dialog
          routstrData: {
            id: model.id,
            name: model.name,
            context_length: model.context_length,
            top_provider: model.top_provider,
            sats_pricing: model.sats_pricing,
          },
        };

        console.log(model.id === "openai/gpt-4o-mini" ? model : "");

        console.log(
          `Routstr model ${model.id}: context=${contextLength}, maxCompletion=${maxCompletionTokens}, assigned=${model.maxTokenAllowed}`,
        );

        return modelInfo;
      });

      return models;
    } catch (error) {
      console.error("Error fetching Routstr models:", error);
      return [];
    }
  }

  getModelInstance(options: {
    model: string;
    serverEnv: Env;
    apiKeys?: Record<string, string>;
    providerSettings?: Record<string, IProviderSetting>;
  }): LanguageModelV1 {
    const { model, serverEnv, apiKeys, providerSettings } = options;

    const { apiKey, baseUrl } = this.getProviderBaseUrlAndKey({
      apiKeys,
      providerSettings: providerSettings?.[this.name],
      serverEnv: serverEnv as any,
      defaultBaseUrlKey: "ROUTSTR_BASE_URL",
      defaultApiTokenKey: "ROUTSTR_API_KEY",
    });

    // Custom fetch function to handle Routstr's non-standard response format
    const customFetch = async (
      input: URL | RequestInfo,
      init?: RequestInit,
    ) => {
      console.log(
        "Routstr customFetch called with URL:",
        typeof input === "string" ? input : input.toString(),
      );

      const response = await fetch(input, init);

      if (!response.ok) {
        console.log(
          "Routstr response not OK:",
          response.status,
          response.statusText,
        );
        return response;
      }

      // Only transform responses for chat completions endpoint
      const url = typeof input === "string" ? input : input.toString();
      console.log("Routstr checking URL for chat completions:", url);

      if (url.includes("/chat/completions")) {
        console.log("Routstr processing chat completions response");

        const contentType = response.headers.get("content-type");

        // Handle streaming responses (Server-Sent Events)
        if (
          contentType?.includes("text/event-stream") ||
          contentType?.includes("text/plain")
        ) {
          // For streaming responses, we need to transform each chunk
          const readable = new ReadableStream({
            start(controller) {
              const reader = response.body?.getReader();

              if (!reader) {
                controller.close();
                return undefined;
              }

              const decoder = new TextDecoder();

              function pump(): Promise<void> {
                return reader!.read().then(({ done, value }) => {
                  if (done) {
                    controller.close();
                    return undefined;
                  }

                  try {
                    const chunk = decoder.decode(value, { stream: true });

                    // Process each line in the chunk
                    const lines = chunk.split("\n");
                    const processedLines = lines.map((line) => {
                      if (
                        line.startsWith("data: ") &&
                        line !== "data: [DONE]"
                      ) {
                        try {
                          const jsonStr = line.slice(6); // Remove 'data: ' prefix
                          const data = JSON.parse(jsonStr);

                          // Remove cost property if present
                          if (
                            data &&
                            typeof data === "object" &&
                            "cost" in data
                          ) {
                            const { cost, ...cleanData } = data;

                            // Debug: log what we're working with
                            console.log(
                              "Routstr streaming response before cleaning:",
                              JSON.stringify(data, null, 2),
                            );
                            console.log(
                              "Routstr streaming response after cleaning:",
                              JSON.stringify(cleanData, null, 2),
                            );

                            // If cleaning results in empty object, this might be a cost-only chunk
                            if (Object.keys(cleanData).length === 0) {
                              console.error(
                                "Routstr streaming response became empty after removing cost property - cost-only chunk",
                              );

                              // Skip cost-only chunks by returning empty string (will be filtered out)
                              return "";
                            }

                            return "data: " + JSON.stringify(cleanData);
                          }
                        } catch {
                          // If parsing fails, return original line
                          return line;
                        }
                      }

                      return line;
                    });

                    const processedChunk = processedLines.join("\n");
                    controller.enqueue(
                      new TextEncoder().encode(processedChunk),
                    );
                  } catch {
                    // If processing fails, pass through original chunk
                    controller.enqueue(value);
                  }

                  return pump();
                });
              }

              return pump();
            },
          });

          return new Response(readable, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }

        // Handle non-streaming JSON responses
        if (contentType?.includes("application/json")) {
          console.log(
            "Routstr processing JSON response, content-type:",
            contentType,
          );

          try {
            const data = await response.json();
            console.log(
              "Routstr raw JSON response:",
              JSON.stringify(data, null, 2),
            );

            // Check if this is a cost-only response that should be ignored
            if (data && typeof data === "object" && "cost" in data) {
              const { cost, ...cleanData } = data;

              // Debug: log what we're working with
              console.log(
                "Routstr non-streaming response before cleaning:",
                JSON.stringify(data, null, 2),
              );
              console.log(
                "Routstr non-streaming response after cleaning:",
                JSON.stringify(cleanData, null, 2),
              );

              // If this is a cost-only response (no other meaningful data), ignore it completely
              if (Object.keys(cleanData).length === 0) {
                console.log(
                  "Routstr cost-only response detected - this appears to be a separate cost notification, not a chat completion response",
                );

                /*
                 * This is a cost-only response from Routstr, not a chat completion
                 * Return a proper OpenAI-compatible error response
                 */
                console.log(
                  "Routstr cost-only response detected - returning error response",
                );

                const errorResponse = {
                  error: {
                    message:
                      "Cost-only response from Routstr - not a chat completion",
                    type: "invalid_request_error",
                    code: "cost_only_response",
                  },
                };

                return new Response(JSON.stringify(errorResponse), {
                  status: 400,
                  statusText: "Bad Request - Cost Only Response",
                  headers: {
                    ...Object.fromEntries(response.headers.entries()),
                    "content-type": "application/json",
                  },
                });
              }

              // Create a new response with the cleaned data (removing cost property)
              return new Response(JSON.stringify(cleanData), {
                status: response.status,
                statusText: response.statusText,
                headers: response.headers,
              });
            }

            // If no cost property, return original response
            console.log(
              "Routstr response has no cost property, returning as-is",
            );

            return new Response(JSON.stringify(data), {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          } catch (error) {
            console.error("Routstr JSON parsing failed:", error);

            // If JSON parsing fails, return original response
            return response;
          }
        }

        console.log("Routstr response content-type not JSON:", contentType);
      }

      console.log(
        "Routstr URL does not contain /chat/completions, passing through",
      );

      return response;
    };

    const openai = createOpenAI({
      baseURL: baseUrl || this.config.baseUrl,
      apiKey,
      fetch: customFetch,
    });

    return openai(model);
  }
}
