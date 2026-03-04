// src/lib/video-manager.ts
import { createVideoPlayer, VideoPlayer } from "expo-video";

type PlayerEntry = {
    player: VideoPlayer;
    postId: number;
    lastUsed: number;
    isCleared: boolean; // Track if source was cleared (zombie player)
};

class VideoPlayerManager {
    private players = new Map<number, PlayerEntry>();
    private mountedPlayers = new Set<number>();
    private maxPlayers = 5;
    private currentlyPlaying: number | null = null;

    /**
     * Get an existing player or create a new one for a given post.
     * If we're at capacity, evicts the oldest *unmounted* player first.
     */
    getOrCreatePlayer(postId: number, url: string): VideoPlayer {
        const existing = this.players.get(postId);
        if (existing) {
            existing.lastUsed = Date.now();

            // If the player was cleared (zombie), replace the source to revive it
            if (existing.isCleared) {
                try {
                    existing.player.replace(url);
                    existing.isCleared = false;
                    console.log(`🔄 Revived cleared player for post ${postId}`);
                } catch (e) {
                    console.warn(`⚠️ Failed to revive player for post ${postId}:`, e);
                    // Player is dead, remove and recreate
                    this.players.delete(postId);
                    return this.getOrCreatePlayer(postId, url);
                }
            }

            return existing.player;
        }

        // Evict if at capacity
        if (this.players.size >= this.maxPlayers) {
            this.evictOne(postId);
        }

        console.log(`🎬 Creating player for post ${postId}`);

        const player = createVideoPlayer(url);
        player.loop = true;
        player.muted = true;

        this.players.set(postId, {
            player,
            postId,
            lastUsed: Date.now(),
            isCleared: false,
        });

        return player;
    }

    /**
     * Preload a video by creating its player without playing it.
     */
    preload(postId: number, url: string): void {
        if (this.players.has(postId)) {
            // If exists but cleared, revive it
            const entry = this.players.get(postId)!;
            if (entry.isCleared) {
                this.getOrCreatePlayer(postId, url);
            }
            return;
        }
        this.getOrCreatePlayer(postId, url);
    }

    /**
     * Check if a player exists for a given post.
     */
    hasPlayer(postId: number): boolean {
        const entry = this.players.get(postId);
        return entry !== undefined && !entry.isCleared;
    }

    /**
     * Check if a player exists (even if cleared).
     */
    hasPlayerEntry(postId: number): boolean {
        return this.players.has(postId);
    }

    /**
     * Mark a player as mounted (a <VideoView> is rendering it).
     * Mounted players are protected from eviction.
     */
    mount(postId: number): void {
        this.mountedPlayers.add(postId);
        console.log(`📌 Mounted player for post ${postId}`);
    }

    /**
     * Mark a player as unmounted (the <VideoView> is gone).
     * If the player was cleared while mounted, now safe to fully release.
     */
    unmount(postId: number): void {
        this.mountedPlayers.delete(postId);
        console.log(`📍 Unmounted player for post ${postId}`);

        // If this player was cleared (zombie), now safe to fully release
        const entry = this.players.get(postId);
        if (entry?.isCleared) {
            console.log(`🗑️ Releasing zombie player for post ${postId}`);
            try {
                entry.player.release();
            } catch (e) {
                console.warn(`⚠️ Failed to release zombie player ${postId}:`, e);
            }
            this.players.delete(postId);
        }
    }

    /**
     * Play video for a given post. Pauses any currently playing video first.
     * Guarantees only one video plays at a time.
     */
    play(postId: number): void {
        // Pause currently playing if different
        if (this.currentlyPlaying !== null && this.currentlyPlaying !== postId) {
            const current = this.players.get(this.currentlyPlaying);
            if (current && !current.isCleared) {
                try {
                    current.player.pause();
                } catch (e) {
                    console.warn(`⚠️ Failed to pause post ${this.currentlyPlaying}:`, e);
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
                console.warn(`⚠️ Failed to play post ${postId}:`, e);
            }
        }
    }

    /**
     * Pause video for a given post.
     */
    pause(postId: number): void {
        const entry = this.players.get(postId);
        if (entry && !entry.isCleared) {
            try {
                entry.player.pause();
            } catch (e) {
                console.warn(`⚠️ Failed to pause post ${postId}:`, e);
            }
        }
        if (this.currentlyPlaying === postId) {
            this.currentlyPlaying = null;
        }
    }

    /**
     * Pause all videos.
     */
    pauseAll(): void {
        this.players.forEach(({ player, isCleared }, id) => {
            if (isCleared) return;
            try {
                player.pause();
            } catch (e) {
                console.warn(`⚠️ Failed to pause post ${id}:`, e);
            }
        });
        this.currentlyPlaying = null;
    }

    /**
     * Get player for a post if it exists and is not cleared.
     */
    getPlayer(postId: number): VideoPlayer | undefined {
        const entry = this.players.get(postId);
        if (entry && !entry.isCleared) {
            return entry.player;
        }
        return undefined;
    }

    /**
     * Set muted state for a player.
     */
    setMuted(postId: number, muted: boolean): void {
        const entry = this.players.get(postId);
        if (entry && !entry.isCleared) {
            try {
                entry.player.muted = muted;
            } catch (e) {
                console.warn(`⚠️ Failed to set muted for post ${postId}:`, e);
            }
        }
    }

    /**
     * Evict one player to make room. ONLY evicts unmounted players.
     * Never evicts mounted, currently playing, or the reserved postId.
     */
    private evictOne(reservePostId?: number): boolean {
        let candidateId: number | null = null;
        let candidateTime = Infinity;

        // Find oldest unmounted player (excluding currently playing & reserved)
        this.players.forEach((entry, id) => {
            if (id === this.currentlyPlaying) return;
            if (id === reservePostId) return;
            if (this.mountedPlayers.has(id)) return; // Skip mounted - NEVER evict
            if (entry.isCleared) return; // Already cleared

            if (entry.lastUsed < candidateTime) {
                candidateTime = entry.lastUsed;
                candidateId = id;
            }
        });

        if (candidateId !== null) {
            console.log(`🗑️ Evicting player for post ${candidateId}`);
            const entry = this.players.get(candidateId);
            if (entry) {
                try {
                    entry.player.release();
                } catch (e) {
                    console.warn(`⚠️ Failed to release post ${candidateId}:`, e);
                }
            }
            this.players.delete(candidateId);
            return true;
        }

        // No unmounted players available to evict
        // This is fine - we'll just have more than maxPlayers temporarily
        console.warn(`⚠️ Cannot evict: all ${this.players.size} players are mounted or playing`);
        return false;
    }

    /**
     * Clear resources for a mounted player without releasing the native object.
     * Use when memory pressure is high but player is still visible.
     */
    clearMountedPlayer(postId: number): void {
        const entry = this.players.get(postId);
        if (entry && this.mountedPlayers.has(postId)) {
            try {
                entry.player.replace(null as any);
                entry.isCleared = true;
                console.log(`🧹 Cleared mounted player for post ${postId}`);
            } catch (e) {
                console.warn(`⚠️ Failed to clear mounted player ${postId}:`, e);
            }
        }
    }

    /**
     * Release all players. Call on screen unmount or app background.
     */
    releaseAll(): void {
        this.players.forEach(({ player }, id) => {
            try {
                player.release();
            } catch (e) {
                console.warn(`⚠️ Failed to release post ${id}:`, e);
            }
        });
        this.players.clear();
        this.mountedPlayers.clear();
        this.currentlyPlaying = null;
    }

    /**
     * Get debug info about current state.
     */
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