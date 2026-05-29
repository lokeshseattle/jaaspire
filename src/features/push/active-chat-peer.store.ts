/** Active `app/(app)/chat/[senderId]` peer id — updated by route sync, read by foreground push handler. */
let activeChatPeerId: string | null = null;

export function setActiveChatPeerId(peerId: string | null): void {
  activeChatPeerId = peerId;
}

export function getActiveChatPeerId(): string | null {
  return activeChatPeerId;
}
