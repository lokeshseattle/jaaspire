import { apiClient } from "@/src/services/api/api.client";
import { startNewAiChat, sendAiChatMessageStream } from "@/src/services/api/ai-chat.api";
import {
  MarkMessengerMessagesReadResponse,
  MessengerContactsResponse,
  MessengerMediaAttachment,
  MessengerMessage,
  MessengerMessagePayload,
  MessengerMessagesResponse,
  MessengerMessageUser,
  MessengerUser,
  PossibleErrorResponse,
  AiChatStreamCompleteData,
  AiChatStreamStartData,
  SendAiChatMessageRequest,
  SendAiChatMessageResult,
  SendMessengerMessageRequest,
  SendMessengerMessageResponse,
} from "@/src/services/api/api.types";
import {
  InfiniteData,
  keepPreviousData,
  QueryClient,
  useInfiniteQuery,
  useMutation,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { notificationCountsQueryKey } from "../profile/notification.hooks";
import { messengerMessagesQueryKey } from "./messenger-query-keys";

export { messengerMessagesQueryKey } from "./messenger-query-keys";

export const useGetMessengerContacts = (): UseQueryResult<
  MessengerContactsResponse,
  PossibleErrorResponse
> => {
  return useQuery({
    queryKey: ["messenger", "contacts"],
    queryFn: () =>
      apiClient
        .get<MessengerContactsResponse>("/messenger/contacts")
        .then((r) => r.data),
    staleTime: 1000 * 45,
    placeholderData: keepPreviousData,
    meta: {
      persist: true,
    },
  });
};

type PaginationLike = {
  hasMore?: boolean;
  has_more?: boolean;
  oldestMessageId?: number | string;
  oldest_message_id?: number | string;
};

/** Supports camelCase and snake_case pagination (Laravel-style JSON). */
function resolveMessengerNextBeforeId(
  lastPage: MessengerMessagesResponse,
): number | undefined {
  const pagination = lastPage?.data?.pagination as PaginationLike | undefined;
  const messages = lastPage?.data?.messages ?? [];

  const hasMore = pagination?.hasMore === true || pagination?.has_more === true;

  if (!hasMore) return undefined;

  const raw = pagination?.oldestMessageId ?? pagination?.oldest_message_id;
  const fromApi = typeof raw === "number" ? raw : Number(raw);
  if (Number.isFinite(fromApi)) return fromApi;

  if (messages.length === 0) return undefined;
  const ids = messages
    .map((m) => Number(m.id))
    .filter((id) => Number.isFinite(id));
  if (ids.length === 0) return undefined;
  return Math.min(...ids);
}

/** Align attachment fields from API (e.g. snake_case preview URL). */
function normalizeMessengerAttachment(
  a: MessengerMediaAttachment,
): MessengerMediaAttachment {
  const raw = a as MessengerMediaAttachment & {
    preview_url?: string | null;
  };
  const preview =
    firstNonEmptyString(
      a.previewurl ?? undefined,
      raw.preview_url ?? undefined,
    ) ??
    a.previewurl ??
    null;
  return {
    ...a,
    previewurl: preview,
  };
}

function firstNonEmptyString(
  ...vals: (string | null | undefined)[]
): string | undefined {
  for (const v of vals) {
    if (typeof v !== "string") continue;
    const t = v.trim();
    if (t.length > 0) return t;
  }
  return undefined;
}

/** Backend sends id:0 / empty rows when a thread has no real messages yet. */
function isRenderableMessengerMessage(m: MessengerMessage): boolean {
  const id = Number(m.id);
  if (!Number.isFinite(id) || id <= 0) return false;
  const hasText = (m.message ?? "").trim().length > 0;
  const hasAttachments = (m.attachments?.length ?? 0) > 0;
  return hasText || hasAttachments;
}

/** Coerce message ids to numbers so deduping across pages is stable. */
function normalizeMessengerMessagesPage(
  body: MessengerMessagesResponse,
): MessengerMessagesResponse {
  const list = body?.data?.messages;
  if (!list?.length) return body;
  return {
    ...body,
    data: {
      ...body.data,
      messages: list
        .filter(isRenderableMessengerMessage)
        .map((m) => ({
          ...m,
          id: Number(m.id),
          message: m.message ?? "",
          attachments: m.attachments?.map(normalizeMessengerAttachment),
        })),
    },
  };
}

function messengerMessageUserToMessengerUser(
  u: MessengerMessageUser,
): MessengerUser {
  return {
    id: u.id,
    name: u.name,
    username: u.username,
    avatar: u.avatar,
    bio: "",
    profileUrl: u.profileUrl,
    canEarnMoney: u.canEarnMoney ?? false,
  };
}

/** Maps send API payload into the same shape used by GET thread messages. */
export function messengerPayloadToMessage(
  payload: MessengerMessagePayload,
): MessengerMessage {
  const id = Number(payload.id);
  return {
    hasUserUnlockedMessage: Boolean(payload.hasUserUnlockedMessage),
    id,
    sender_id: payload.sender_id,
    receiver_id: payload.receiver_id,
    message: payload.message ?? "",
    isSeen: Boolean(payload.isSeen),
    price: payload.price,
    is_ai_conversation: Boolean(payload.is_ai_conversation),
    created_at: payload.created_at,
    sender: messengerMessageUserToMessengerUser(payload.sender),
    receiver: messengerMessageUserToMessengerUser(payload.receiver),
    attachments: payload.attachments?.map(normalizeMessengerAttachment),
  };
}

/** Deduped merge into page 0; avoids refetch after POST /send. */
export function mergeMessengerMessageIntoInfiniteCache(
  queryClient: QueryClient,
  peerUserId: number,
  message: MessengerMessage,
): void {
  const key = messengerMessagesQueryKey(peerUserId);
  const id = Number(message.id);
  const safeMessage: MessengerMessage = {
    ...message,
    id,
    message: message.message ?? "",
    attachments: message.attachments?.map(normalizeMessengerAttachment),
  };
  queryClient.setQueryData<InfiniteData<MessengerMessagesResponse>>(
    key,
    (prev) => {
      const normalized = normalizeMessengerMessagesPage({
        status: "success",
        data: {
          messages: [safeMessage],
          pagination: { hasMore: false, oldestMessageId: id },
        },
      });
      if (!prev || prev.pages.length === 0) {
        return {
          pageParams: [undefined],
          pages: [normalized],
        };
      }
      for (const page of prev.pages) {
        if (page.data.messages.some((m) => Number(m.id) === id)) {
          return prev;
        }
      }
      const firstPage = prev.pages[0];
      const nextMessages = [...firstPage.data.messages, safeMessage];
      return {
        ...prev,
        pages: [
          {
            ...firstPage,
            data: {
              ...firstPage.data,
              messages: nextMessages,
            },
          },
          ...prev.pages.slice(1),
        ],
      };
    },
  );
}

/** Patch a single message row in page 0 (e.g. streaming AI text updates). */
export function patchMessengerMessageInInfiniteCache(
  queryClient: QueryClient,
  peerUserId: number,
  messageId: number,
  patch: Partial<Pick<MessengerMessage, "message">>,
): void {
  const key = messengerMessagesQueryKey(peerUserId);
  const targetId = Number(messageId);
  queryClient.setQueryData<InfiniteData<MessengerMessagesResponse>>(
    key,
    (prev) => {
      if (!prev?.pages.length) return prev;
      const firstPage = prev.pages[0];
      const idx = firstPage.data.messages.findIndex(
        (m) => Number(m.id) === targetId,
      );
      if (idx === -1) return prev;
      const nextMessages = [...firstPage.data.messages];
      nextMessages[idx] = {
        ...nextMessages[idx],
        ...patch,
        message: patch.message ?? nextMessages[idx].message ?? "",
      };
      return {
        ...prev,
        pages: [
          {
            ...firstPage,
            data: { ...firstPage.data, messages: nextMessages },
          },
          ...prev.pages.slice(1),
        ],
      };
    },
  );
}

export function messengerUserFromProfile(
  id: number,
  profile: {
    name: string;
    username?: string;
    avatar: string;
    bio?: string;
    profileUrl?: string;
    canEarnMoney?: boolean;
  },
): MessengerUser {
  const username = profile.username?.replace(/^@/, "").trim() ?? "";
  return {
    id,
    name: profile.name,
    username,
    avatar: profile.avatar,
    bio: profile.bio ?? "",
    profileUrl: profile.profileUrl ?? (username ? `/${username}` : ""),
    canEarnMoney: profile.canEarnMoney ?? false,
  };
}

export function buildAiChatPlaceholderMessages(params: {
  userMessageId: number;
  aiMessageId: number;
  userText: string;
  myId: number;
  peerId: number;
  myUser: MessengerUser;
  peerUser: MessengerUser;
}): { userMessage: MessengerMessage; aiMessage: MessengerMessage } {
  const userAt = Date.now();
  const userCreated = new Date(userAt).toISOString();
  const aiCreated = new Date(userAt + 1).toISOString();
  return {
    userMessage: {
      id: params.userMessageId,
      sender_id: params.myId,
      receiver_id: params.peerId,
      message: params.userText,
      isSeen: false,
      price: 0,
      is_ai_conversation: true,
      created_at: userCreated,
      hasUserUnlockedMessage: true,
      sender: params.myUser,
      receiver: params.peerUser,
      attachments: [],
    },
    aiMessage: {
      id: params.aiMessageId,
      sender_id: params.peerId,
      receiver_id: params.myId,
      message: "",
      isSeen: false,
      price: 0,
      is_ai_conversation: true,
      created_at: aiCreated,
      hasUserUnlockedMessage: true,
      sender: params.peerUser,
      receiver: params.myUser,
      attachments: [],
    },
  };
}

/** Used by realtime to skip redundant refetches when POST already merged the row. */
export function isMessengerMessageIdInThreadCache(
  queryClient: QueryClient,
  peerUserId: number,
  messageId: number,
): boolean {
  if (!Number.isFinite(messageId)) return false;
  const cached = queryClient.getQueryData<
    InfiniteData<MessengerMessagesResponse>
  >(messengerMessagesQueryKey(peerUserId));
  if (!cached) return false;
  return cached.pages.some((page) =>
    page.data.messages.some((m) => Number(m.id) === messageId),
  );
}

export const useInfiniteMessengerMessages = (peerUserId: number) => {
  return useInfiniteQuery({
    queryKey: messengerMessagesQueryKey(peerUserId),
    queryFn: async ({ pageParam }: { pageParam: number | undefined }) => {
      const url =
        pageParam != null
          ? `/messenger/${peerUserId}/messages?before_id=${pageParam}`
          : `/messenger/${peerUserId}/messages`;
      const res = await apiClient.get<MessengerMessagesResponse>(url);
      return normalizeMessengerMessagesPage(res.data);
    },
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage: MessengerMessagesResponse) =>
      resolveMessengerNextBeforeId(lastPage),
    /** Inverted chat prepends older rows at the “top”; avoid focus churn refetching multi-page threads. */
    refetchOnWindowFocus: false,
    enabled: Number.isFinite(peerUserId) && peerUserId > 0,
  });
};

export const useSendMessengerMessage = (
  peerUserId: number,
): UseMutationResult<
  SendMessengerMessageResponse,
  PossibleErrorResponse,
  SendMessengerMessageRequest
> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ message, sku_key, attachments }: SendMessengerMessageRequest) =>
      apiClient
        .post<SendMessengerMessageResponse>(
          `/messenger/${peerUserId}/send`,
          { message, sku_key, attachments },
        )
        .then((r) => r.data),
    onSuccess: (response) => {
      const payload = response?.data?.message;
      if (payload) {
        mergeMessengerMessageIntoInfiniteCache(
          queryClient,
          peerUserId,
          messengerPayloadToMessage(payload),
        );
      }
    },
  });
};

export type SendAiChatMessageVariables = SendAiChatMessageRequest & {
  peerUserId: number;
  myId: number;
  myUser: MessengerUser;
  peerUser: MessengerUser;
  onStreamStart?: (data: AiChatStreamStartData) => void;
  onStreamChunk?: (aiMessageId: number, accumulated: string) => void;
  onStreamComplete?: (data: AiChatStreamCompleteData) => void;
};

export const useSendAiChatMessage = (): UseMutationResult<
  SendAiChatMessageResult,
  PossibleErrorResponse,
  SendAiChatMessageVariables
> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      message,
      peerUserId,
      myId,
      myUser,
      peerUser,
      onStreamStart,
      onStreamChunk,
      onStreamComplete,
    }: SendAiChatMessageVariables) => {
      let aiMessageId = 0;

      return sendAiChatMessageStream(message, {
        onStart: (data) => {
          aiMessageId = data.ai_message_id;
          onStreamStart?.(data);
          const { userMessage, aiMessage } = buildAiChatPlaceholderMessages({
            userMessageId: data.user_message_id,
            aiMessageId: data.ai_message_id,
            userText: message,
            myId,
            peerId: peerUserId,
            myUser,
            peerUser,
          });
          mergeMessengerMessageIntoInfiniteCache(
            queryClient,
            peerUserId,
            userMessage,
          );
          mergeMessengerMessageIntoInfiniteCache(
            queryClient,
            peerUserId,
            aiMessage,
          );
        },
        onChunk: (_piece, accumulated) => {
          if (!aiMessageId) return;
          onStreamChunk?.(aiMessageId, accumulated);
        },
        onComplete: (data) => {
          onStreamComplete?.(data);
          patchMessengerMessageInInfiniteCache(
            queryClient,
            peerUserId,
            data.message_id,
            { message: data.full_content },
          );
        },
      });
    },
  });
};

export const useResetAiChat = (
  peerUserId: number,
): UseMutationResult<void, PossibleErrorResponse, void> => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await startNewAiChat();
    },
    onSuccess: () => {
      queryClient.resetQueries({
        queryKey: messengerMessagesQueryKey(peerUserId),
      });
    },
  });
};

export const useMarkMessageAsRead = () => {
  const queryClient = useQueryClient();

  return useMutation<
    MarkMessengerMessagesReadResponse,
    PossibleErrorResponse,
    number
  >({
    mutationFn: (peerUserId: number) =>
      apiClient
        .post<MarkMessengerMessagesReadResponse>(
          `/messenger/${peerUserId}/read`,
        )
        .then((r) => r.data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messenger", "contacts"] });
      queryClient.invalidateQueries({ queryKey: notificationCountsQueryKey });
    },
  });
};
