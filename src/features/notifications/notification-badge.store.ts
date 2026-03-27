import { create } from "zustand";

export interface NotificationBadgeState {
  unreadCount: number;
  incrementUnread: () => void;
  clearBadge: () => void;
}

export const useNotificationBadgeStore = create<NotificationBadgeState>(
  (set) => ({
    unreadCount: 0,
    incrementUnread: () => set((s) => ({ unreadCount: s.unreadCount + 1 })),
    clearBadge: () => set({ unreadCount: 0 }),
  }),
);
