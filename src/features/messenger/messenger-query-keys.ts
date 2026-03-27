export const messengerMessagesQueryKey = (peerUserId: number) =>
  ["messenger", "messages", String(peerUserId)] as const;
