import { logVideoNetworkFetch } from "@/src/lib/video-network-debug";
import { createVideoPlayer, VideoPlayer } from "expo-video";
import { Platform } from "react-native";

type PlayerEntry = {
  player: VideoPlayer;
  postId: number;
  lastUsed: number;
  isCleared: boolean;
  url: string;
};

type PreloadTarget = { postId: number; url: string } | null;

class VideoPlayerManager {
  private players = new Map<number, PlayerEntry>();
  private mountedPlayers = new Set<number>();
  /** Focused + upcoming reel IDs — never evicted while reserved. */
  private reservedPostIds = new Set<number>();
  /**
   * Hard cap (decoder budget). Flicks competes for the same pool; the visible
   * Home post is pinned on tab blur so LRU eviction does not recycle it first.
   */
  private maxPlayers = Platform.OS === "android" ? 3 : 4;
  /** Last primary Home feed post — not eligible for eviction while user is away (e.g. on Flicks). */
  private pinnedFeedPostId: number | null = null;
  private currentlyPlaying: number | null = null;
  /** Child mute button intent — drives UI icon state. Muted by default on cold start. */
  private userMutedPreference = true;
  /** Parent device volume is zero — blocks playback regardless of child UI. */
  private systemVolumeZero = true;
  /** Once true, Home/Flicks share mute state; pre-interaction auto-mute/unmute stops. */
  private hasUserInteractedWithMute = false;
  private muteSubscribers = new Set<(muted: boolean) => void>();
  private resetSubscribers = new Set<() => void>();

  /** Playback: muted when child wants mute OR parent volume is zero. */
  getEffectiveMuted(): boolean {
    return this.userMutedPreference || this.systemVolumeZero;
  }

  /** UI: child button state only. */
  getUserMuted(): boolean {
    return this.userMutedPreference;
  }

  getHasInteracted(): boolean {
    return this.hasUserInteractedWithMute;
  }

  setUserMuted(muted: boolean): void {
    this.hasUserInteractedWithMute = true;
    if (this.userMutedPreference === muted) return;
    this.userMutedPreference = muted;
    this.syncPlayerMute();
    this.notifyMuteSubscribers();
  }

  /** Pre-interaction: unmute for Flicks without locking shared state. */
  autoUnmuteForScreen(): void {
    if (this.userMutedPreference === false) {
      this.syncPlayerMute();
      return;
    }
    this.userMutedPreference = false;
    this.syncPlayerMute();
    this.notifyMuteSubscribers();
  }

  /** Pre-interaction: mute for Home without locking shared state. */
  autoMuteForScreen(): void {
    if (this.userMutedPreference === true) {
      this.syncPlayerMute();
      return;
    }
    this.userMutedPreference = true;
    this.syncPlayerMute();
    this.notifyMuteSubscribers();
  }

  applySystemVolume(volume: number, prevVolume: number | null): void {
    const wasAboveZero = prevVolume != null && prevVolume > 0;
    const isZero = volume <= 0;

    this.systemVolumeZero = isZero;

    if (prevVolume !== null) {
      this.hasUserInteractedWithMute = true;
      if (isZero && wasAboveZero) {
        this.userMutedPreference = true;
      } else if (volume > prevVolume) {
        this.userMutedPreference = false;
      }
    }

    this.syncPlayerMute();
    this.notifyMuteSubscribers();
  }

  private syncPlayerMute(): void {
    const muted = this.getEffectiveMuted();
    this.players.forEach(({ player, isCleared }) => {
      if (!isCleared) {
        try {
          player.muted = muted;
        } catch {
          /* native player may be gone */
        }
      }
    });
  }

  private notifyMuteSubscribers(): void {
    const uiMuted = this.userMutedPreference;
    this.muteSubscribers.forEach((sub) => sub(uiMuted));
  }

  /** Call when Home blurs: protect this post's player from eviction. Clear on Home focus (`null`). */
  setPinnedFeedPostId(postId: number | null): void {
    this.pinnedFeedPostId = postId;
  }

  getOrCreatePlayer(postId: number, url: string): VideoPlayer {
    const existing = this.players.get(postId);
    if (existing) {
      existing.lastUsed = Date.now();

      if (existing.url !== url) {
        try {
          logVideoNetworkFetch(postId, url, "replace");
          existing.player.replace(url);
          existing.url = url;
          existing.isCleared = false;
          existing.player.loop = true;
          existing.player.muted = this.getEffectiveMuted();
        } catch (e) {
          // console.warn(`[VM] Failed to replace source ${postId}:`, e);
          this.players.delete(postId);
          return this.getOrCreatePlayer(postId, url);
        }
      }

      if (existing.isCleared) {
        try {
          logVideoNetworkFetch(postId, url, "replace");
          existing.player.replace(url);
          existing.isCleared = false;
        } catch (e) {
          // console.warn(`[VM] Failed to revive player ${postId}:`, e);
          this.players.delete(postId);
          return this.getOrCreatePlayer(postId, url);
        }
      }

      return existing.player;
    }

    while (this.players.size >= this.maxPlayers) {
      if (!this.evictOne(postId)) break;
    }

    logVideoNetworkFetch(postId, url, "create");
    const player = createVideoPlayer(url);
    player.loop = true;
    player.muted = this.getEffectiveMuted();

    this.players.set(postId, {
      player,
      postId,
      lastUsed: Date.now(),
      isCleared: false,
      url,
    });

    return player;
  }

  preload(postId: number, url: string): void {
    const entry = this.players.get(postId);

    if (entry) {
      if (entry.isCleared || entry.url !== url) {
        this.getOrCreatePlayer(postId, url);
      }
      entry.lastUsed = Date.now();
      return;
    }

    this.getOrCreatePlayer(postId, url);
  }

  /** Protect focused + upcoming reels from LRU eviction during warm-up. */
  setReservedPostIds(postIds: number[]): void {
    this.reservedPostIds = new Set(postIds);
  }

  /** Preload with scroll-direction priority (primary first, secondary if pool allows). */
  preloadAdjacent(options: {
    primary: PreloadTarget;
    secondary: PreloadTarget;
  }): void {
    const { primary, secondary } = options;
    if (primary) this.preload(primary.postId, primary.url);
    if (
      secondary &&
      (this.players.size < this.maxPlayers ||
        this.hasPlayer(secondary.postId) ||
        this.reservedPostIds.has(secondary.postId))
    ) {
      this.preload(secondary.postId, secondary.url);
    }
  }

  hasPlayer(postId: number): boolean {
    const entry = this.players.get(postId);
    return entry !== undefined && !entry.isCleared;
  }

  mount(postId: number): void {
    this.mountedPlayers.add(postId);
  }

  unmount(postId: number): void {
    this.mountedPlayers.delete(postId);

    const entry = this.players.get(postId);
    if (entry?.isCleared) {
      try {
        entry.player.release();
      } catch (e) {
        // console.warn(`[VM] Failed to release zombie ${postId}:`, e);
      }
      this.players.delete(postId);
    }
  }

  play(postId: number): void {
    if (this.currentlyPlaying !== null && this.currentlyPlaying !== postId) {
      const current = this.players.get(this.currentlyPlaying);
      if (current && !current.isCleared) {
        try {
          current.player.pause();
        } catch (e) {
          // console.warn(`[VM] Failed to pause ${this.currentlyPlaying}:`, e);
        }
      }
    }

    const entry = this.players.get(postId);
    if (entry && !entry.isCleared) {
      try {
        entry.player.play();
        entry.lastUsed = Date.now();
        this.currentlyPlaying = postId;
      } catch (e) {
        // console.warn(`[VM] Failed to play ${postId}:`, e);
      }
    }
  }

  pause(postId: number): void {
    const entry = this.players.get(postId);
    if (entry && !entry.isCleared) {
      try {
        entry.player.pause();
      } catch (e) {
        // console.warn(`[VM] Failed to pause ${postId}:`, e);
      }
    }
    if (this.currentlyPlaying === postId) {
      this.currentlyPlaying = null;
    }
  }

  pauseAll(): void {
    this.players.forEach(({ player, isCleared }, id) => {
      if (isCleared) return;
      try {
        player.pause();
      } catch (e) {
        // console.warn(`[VM] Failed to pause ${id}:`, e);
      }
    });
    this.currentlyPlaying = null;
  }

  getPlayer(postId: number): VideoPlayer | undefined {
    const entry = this.players.get(postId);
    if (entry && !entry.isCleared) {
      return entry.player;
    }
    return undefined;
  }

  /** Seek existing player to start (e.g. when returning to flicks tab). */
  seekToStart(postId: number): void {
    const entry = this.players.get(postId);
    if (!entry || entry.isCleared) return;
    try {
      entry.player.currentTime = 0;
    } catch (e) {
      // console.warn(`[VM] Failed seekToStart ${postId}:`, e);
    }
  }

  /** @deprecated Use setUserMuted — kept for any legacy callers. */
  setGlobalMuted(muted: boolean): void {
    this.setUserMuted(muted);
  }

  /** @deprecated Use getUserMuted — kept for any legacy callers. */
  getGlobalMuted(): boolean {
    return this.getUserMuted();
  }

  subscribeToMute(callback: (muted: boolean) => void): () => void {
    this.muteSubscribers.add(callback);
    return () => this.muteSubscribers.delete(callback);
  }

  subscribeToReset(callback: () => void): () => void {
    this.resetSubscribers.add(callback);
    return () => this.resetSubscribers.delete(callback);
  }

  /** Release every player unconditionally and notify hooks to re-create from scratch. */
  resetAll(): void {
    this.players.forEach(({ player }, id) => {
      try {
        player.release();
      } catch (e) {
        // console.warn(`[VM] Failed to release ${id}:`, e);
      }
    });
    this.players.clear();
    this.mountedPlayers.clear();
    this.currentlyPlaying = null;
    this.pinnedFeedPostId = null;
    this.reservedPostIds.clear();
    this.resetSubscribers.forEach((sub) => sub());
  }

  private evictOne(reservePostId?: number): boolean {
    let candidateId: number | null = null;
    let candidateTime = Infinity;

    this.players.forEach((entry, id) => {
      if (id === this.currentlyPlaying) return;
      if (id === reservePostId) return;
      if (this.reservedPostIds.has(id)) return;
      if (this.pinnedFeedPostId != null && id === this.pinnedFeedPostId) return;
      if (this.mountedPlayers.has(id)) return;
      if (entry.isCleared) return;

      if (entry.lastUsed < candidateTime) {
        candidateTime = entry.lastUsed;
        candidateId = id;
      }
    });

    if (candidateId !== null) {
      const entry = this.players.get(candidateId);
      if (entry) {
        try {
          entry.player.release();
        } catch (e) {
          // console.warn(`[VM] Failed to release ${candidateId}:`, e);
        }
      }
      this.players.delete(candidateId);
      return true;
    }

    return false;
  }

  clearMountedPlayer(postId: number): void {
    const entry = this.players.get(postId);
    if (entry && this.mountedPlayers.has(postId)) {
      try {
        entry.player.replace(null as any);
        entry.isCleared = true;
      } catch (e) {
        // console.warn(`[VM] Failed to clear ${postId}:`, e);
      }
    }
  }

  releaseAll(): void {
    const pin = this.pinnedFeedPostId;
    const pinnedEntry = pin != null ? this.players.get(pin) : undefined;

    this.players.forEach(({ player }, id) => {
      if (pin != null && id === pin) return;
      try {
        player.release();
      } catch (e) {
        // console.warn(`[VM] Failed to release ${id}:`, e);
      }
    });

    this.players.clear();
    this.mountedPlayers.clear();
    this.currentlyPlaying = null;
    this.reservedPostIds.clear();

    if (pinnedEntry != null && pin != null) {
      this.players.set(pin, pinnedEntry);
    }
  }

  getDebugInfo(): object {
    return {
      totalPlayers: this.players.size,
      mountedPlayers: this.mountedPlayers.size,
      pinnedFeedPostId: this.pinnedFeedPostId,
      currentlyPlaying: this.currentlyPlaying,
      players: Array.from(this.players.entries()).map(([id, entry]) => ({
        postId: id,
        mounted: this.mountedPlayers.has(id),
        isCleared: entry.isCleared,
        lastUsed: entry.lastUsed,
      })),
    };
  }
}

export const videoManager = new VideoPlayerManager();
