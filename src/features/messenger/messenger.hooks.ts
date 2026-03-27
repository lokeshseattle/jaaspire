import { apiClient } from "@/src/services/api/api.client";
import {
  MessengerContactsResponse,
  MessengerMessagesResponse,
  PossibleErrorResponse,
  SendMessengerMessageRequest,
  SendMessengerMessageResponse,
} from "@/src/services/api/api.types";
import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryResult
} from "@tanstack/react-query";
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
      messages: list.map((m) => ({ ...m, id: Number(m.id) })),
    },
  };
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
    mutationFn: (body: SendMessengerMessageRequest) =>
      apiClient
        .post<SendMessengerMessageResponse>(
          `/messenger/${peerUserId}/send`,
          body,
        )
        .then((r) => r.data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["messenger", "contacts"] });
    },
  });
};
