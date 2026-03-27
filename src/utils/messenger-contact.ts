import type { MessengerContact, MessengerStoryStatus } from "@/src/services/api/api.types";

export type MessengerPeer = {
  id: number;
  name: string;
  avatar: string;
  storyStatus: MessengerStoryStatus;
};

/** Resolves the counterparty row fields from API sender/receiver + contactID. */
export function getMessengerPeer(contact: MessengerContact): MessengerPeer {
  if (contact.contactID === contact.senderID) {
    return {
      id: contact.senderID,
      name: contact.senderName,
      avatar: contact.senderAvatar,
      storyStatus: contact.senderStoryStatus,
    };
  }
  return {
    id: contact.receiverID,
    name: contact.receiverName,
    avatar: contact.receiverAvatar,
    storyStatus: contact.receiverStoryStatus,
  };
}
