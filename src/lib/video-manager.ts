import { createVideoPlayer, VideoPlayer } from "expo-video";

type PlayerEntry = {
  player: VideoPlayer;
  postId: number;
  lastUsed: number;
  isCleared: boolean;
};

class VideoPlayerManager {
  private players = new Map<number, PlayerEntry>();
  private mountedPlayers = new Set<number>();
  /**
   * Android hardware decoders are limited (typically 3-4 on real devices,
   * sometimes 2 on emulators). A VideoPlayer consumes a decoder slot only
   * when connected to a VideoView, BUT expo-video may also hold a codec
   * during buffering.  Keep the pool small to avoid codec exhaustion.
   */
  private maxPlayers = 3;
  private currentlyPlaying: number | null = null;
  private globalMuted: boolean = true;
  private muteSubscribers = new Set<(muted: boolean) => void>();

  getOrCreatePlayer(postId: number, url: string): VideoPlayer {
    const existing = this.players.get(postId);
    if (existing) {
      existing.lastUsed = Date.now();

      if (existing.isCleared) {
        try {
          existing.player.replace(url);
          existing.isCleared = false;
        } catch (e) {
          console.warn(`[VM] Failed to revive player ${postId}:`, e);
          this.players.delete(postId);
          return this.getOrCreatePlayer(postId, url);
        }
      }

      return existing.player;
    }

    if (this.players.size >= this.maxPlayers) {
      this.evictOne(postId);
    }

    const player = createVideoPlayer(url);
    player.loop = true;
    player.muted = this.globalMuted;

    this.players.set(postId, {
      player,
      postId,
      lastUsed: Date.now(),
      isCleared: false,
    });

    return player;
  }

  preload(postId: number, url: string): void {
    if (this.players.has(postId)) {
      const entry = this.players.get(postId)!;
      if (entry.isCleared) {
        this.getOrCreatePlayer(postId, url);
      }
      return;
    }
    this.getOrCreatePlayer(postId, url);
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
        console.warn(`[VM] Failed to release zombie ${postId}:`, e);
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
          console.warn(`[VM] Failed to pause ${this.currentlyPlaying}:`, e);
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
        console.warn(`[VM] Failed to play ${postId}:`, e);
      }
    }
  }

  pause(postId: number): void {
    const entry = this.players.get(postId);
    if (entry && !entry.isCleared) {
      try {
        entry.player.pause();
      } catch (e) {
        console.warn(`[VM] Failed to pause ${postId}:`, e);
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
        console.warn(`[VM] Failed to pause ${id}:`, e);
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

  setGlobalMuted(muted: boolean): void {
    this.globalMuted = muted;
    this.players.forEach(({ player, isCleared }, postId) => {
      if (!isCleared) {
        try {
          player.muted = muted;
        } catch (e) {
          console.warn(`[VM] Failed to set muted ${postId}:`, e);
        }
      }
    });
    this.muteSubscribers.forEach((sub) => sub(muted));
  }

  getGlobalMuted(): boolean {
    return this.globalMuted;
  }

  subscribeToMute(callback: (muted: boolean) => void): () => void {
    this.muteSubscribers.add(callback);
    return () => this.muteSubscribers.delete(callback);
  }

  private evictOne(reservePostId?: number): boolean {
    let candidateId: number | null = null;
    let candidateTime = Infinity;

    this.players.forEach((entry, id) => {
      if (id === this.currentlyPlaying) return;
      if (id === reservePostId) return;
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
          console.warn(`[VM] Failed to release ${candidateId}:`, e);
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
        console.warn(`[VM] Failed to clear ${postId}:`, e);
      }
    }
  }

  releaseAll(): void {
    this.players.forEach(({ player }, id) => {
      try {
        player.release();
      } catch (e) {
        console.warn(`[VM] Failed to release ${id}:`, e);
      }
    });
    this.players.clear();
    this.mountedPlayers.clear();
    this.currentlyPlaying = null;
  }

  getDebugInfo(): object {
    return {
      totalPlayers: this.players.size,
      mountedPlayers: this.mountedPlayers.size,
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
