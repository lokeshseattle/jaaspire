import type { ComponentType } from "react";

export type GiftedUser = {
  _id: string | number;
  name?: string;
  avatar?: string | number;
};

export type GiftedIMessage = {
  _id: string | number;
  text: string;
  createdAt: Date | number;
  user: GiftedUser;
  pending?: boolean;
  /** Outgoing: peer has opened the thread (WhatsApp-style read receipt). */
  isSeen?: boolean;
};

/* Avoid resolving package `types` to .tsx sources (strict TS errors in the library). */
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pkg = require("react-native-gifted-chat") as {
  GiftedChat: ComponentType<Record<string, unknown>> & {
    append: <T extends GiftedIMessage>(
      currentMessages: T[],
      messages: T[],
      isInverted?: boolean,
    ) => T[];
  };
};

export const GiftedChat = pkg.GiftedChat;

export function appendGiftedMessages<T extends GiftedIMessage>(
  currentMessages: T[],
  messages: T[],
  isInverted = true,
): T[] {
  return pkg.GiftedChat.append(currentMessages, messages, isInverted);
}
