import { API_BASE_URL } from "@/src/constants/app-env";
import { useAuthStore } from "@/src/features/auth/auth.store";
import { forceLogout } from "@/src/features/auth/auth.utils";
import { ApiError } from "@/src/services/api/api.error";
import type {
  AiChatStreamCompleteData,
  AiChatStreamStartData,
  SendAiChatMessageResult,
} from "@/src/services/api/api.types";
import { fetch } from "expo/fetch";

export type AiChatStreamHandlers = {
  onStart: (data: AiChatStreamStartData) => void;
  onChunk: (content: string, accumulated: string) => void;
  onComplete: (data: AiChatStreamCompleteData) => void;
};

function dispatchSseEvent(
  eventType: string,
  dataStr: string,
  handlers: AiChatStreamHandlers,
  state: {
    userMessageId: number;
    aiMessageId: number;
    accumulated: string;
  },
): SendAiChatMessageResult | null {
  switch (eventType) {
    case "start": {
      const data = JSON.parse(dataStr) as AiChatStreamStartData;
      state.userMessageId = data.user_message_id;
      state.aiMessageId = data.ai_message_id;
      handlers.onStart(data);
      return null;
    }
    case "chunk": {
      const data = JSON.parse(dataStr) as { content?: string };
      const piece = typeof data.content === "string" ? data.content : "";
      state.accumulated += piece;
      handlers.onChunk(piece, state.accumulated);
      return null;
    }
    case "done":
      return null;
    case "complete": {
      const data = JSON.parse(dataStr) as AiChatStreamCompleteData;
      handlers.onComplete(data);
      state.accumulated = data.full_content;
      return {
        userMessageId: state.userMessageId,
        aiMessageId: state.aiMessageId,
        fullContent: data.full_content,
      };
    }
    default:
      return null;
  }
}

async function readSseResponse(
  response: Response,
  handlers: AiChatStreamHandlers,
): Promise<SendAiChatMessageResult> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new ApiError("Streaming is not supported on this device.");
  }

  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  const state = {
    userMessageId: 0,
    aiMessageId: 0,
    accumulated: "",
  };
  let result: SendAiChatMessageResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (line.startsWith("event:")) {
        currentEvent = line.slice(6).trim();
        continue;
      }
      if (!line.startsWith("data:")) continue;

      const dataStr = line.slice(5).trim();
      if (!currentEvent) continue;

      if (currentEvent === "done" && dataStr === "[DONE]") {
        continue;
      }

      const eventType = currentEvent;
      const eventResult = dispatchSseEvent(
        eventType,
        dataStr,
        handlers,
        state,
      );
      if (eventType === "chunk") {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => resolve());
        });
      }
      if (eventResult) {
        result = eventResult;
      }
    }
  }

  if (!result) {
    throw new ApiError("AI response stream ended before completion.");
  }

  return result;
}

async function throwForFailedResponse(response: Response): Promise<never> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as { message?: string };
    if (
      body.message === "Unauthenticated." &&
      useAuthStore.getState().accessToken
    ) {
      await forceLogout({
        notice: {
          title: "Signed out",
          message:
            "Your session expired while using AI chat. Please sign in again.",
        },
      });
    }
    throw new ApiError(
      body.message ?? "Something went wrong",
      response.status,
      body,
    );
  }

  const text = await response.text();
  throw new ApiError(
    text.trim() || `Request failed (${response.status})`,
    response.status,
  );
}

export async function sendAiChatMessageStream(
  message: string,
  handlers: AiChatStreamHandlers,
  signal?: AbortSignal,
): Promise<SendAiChatMessageResult> {
  const token = useAuthStore.getState().accessToken;
  const headers: Record<string, string> = {
    Accept: "text/event-stream",
    "Content-Type": "application/json",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/ai-chat/send`, {
    method: "POST",
    headers,
    body: JSON.stringify({ message }),
    signal,
  });

  if (!response.ok) {
    await throwForFailedResponse(response);
  }

  return readSseResponse(response, handlers);
}
