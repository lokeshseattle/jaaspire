import * as Crypto from "expo-crypto";
import { create } from "zustand";

export interface SeedState {
  seed: string;
}

function createSeed(): string {
  return Crypto.randomUUID();
}

export const useSeedStore = create<SeedState>(() => ({
  seed: "",
}));

/** Call once from the app entry module so each launch gets a fresh id before React renders. */
export function initializeSessionSeed() {
  useSeedStore.setState({ seed: createSeed() });
}
