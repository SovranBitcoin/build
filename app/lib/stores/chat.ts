import { map } from "nanostores";

export const chatStore = map({
  started: false,
  aborted: false,
  showChat: true,

  // Routstr model selection
  selectedModelId: undefined as string | undefined,
  selectedMaxCompletionTokens: undefined as number | undefined,
  selectedContextLength: undefined as number | undefined,
});
