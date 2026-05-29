import * as SecureStore from "expo-secure-store";

const ACCESS_TOKEN_KEY = "access_token";
const EXPO_PUSH_TOKEN_KEY = "expo_push_token";
const IAP_ACCOUNT_TOKEN_KEY = "iap_account_token";

export const tokenStorage = {
  async save(token: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
  },

  async get(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
  },

  async remove(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  },
};

export const pushTokenStorage = {
  async save(token: string): Promise<void> {
    await SecureStore.setItemAsync(EXPO_PUSH_TOKEN_KEY, token);
  },

  async get(): Promise<string | null> {
    return SecureStore.getItemAsync(EXPO_PUSH_TOKEN_KEY);
  },

  async remove(): Promise<void> {
    await SecureStore.deleteItemAsync(EXPO_PUSH_TOKEN_KEY);
  },
};

/** Server-issued UUID for Apple appAccountToken / Google obfuscatedAccountId. */
export const iapAccountTokenStorage = {
  async save(token: string): Promise<void> {
    await SecureStore.setItemAsync(IAP_ACCOUNT_TOKEN_KEY, token);
  },

  async get(): Promise<string | null> {
    return SecureStore.getItemAsync(IAP_ACCOUNT_TOKEN_KEY);
  },

  async remove(): Promise<void> {
    await SecureStore.deleteItemAsync(IAP_ACCOUNT_TOKEN_KEY);
  },
};
