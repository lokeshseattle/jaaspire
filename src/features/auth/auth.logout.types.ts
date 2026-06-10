export type LogoutNotice = {
  title: string;
  message: string;
};

export const DEFAULT_SESSION_LOGOUT_NOTICE: LogoutNotice = {
  title: "Signed out",
  message: "Your session expired or is no longer valid. Please sign in again.",
};

export type ForceLogoutOptions = {
  /** When true, clears the session without showing a logout alert. */
  silent?: boolean;
  notice?: LogoutNotice;
};
