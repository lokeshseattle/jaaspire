// src/lib/video-manager.ts
import { createVideoPlayer, VideoPlayer } from "expo-video";

type PlayerEntry = {
    player: VideoPlayer;
    lastUsed: number;
};

class VideoPlayerManager {
    private players = new Map<number, PlayerEntry>();
    private maxPlayers = 4;
    private currentlyPlaying: number | null = null;

    getOrCreatePlayer(postId: number, url: string): VideoPlayer {
        if (this.players.has(postId)) {
            const entry = this.players.get(postId)!;
            entry.lastUsed = Date.now();
            return entry.player;
        }

        if (this.players.size >= this.maxPlayers) {
            this.releaseOldest();
        }

        console.log(`🎬 Creating player for post ${postId}`);

        const player = createVideoPlayer(url);
        player.loop = true;
        player.muted = true;

        this.players.set(postId, {
            player,
            lastUsed: Date.now(),
        });

        return player;
    }

    preload(postId: number, url: string): void {
        this.getOrCreatePlayer(postId, url);
    }

    play(postId: number): void {
        console.log(`▶️ Play requested for post ${postId}`);

        // Pause currently playing
        if (this.currentlyPlaying !== null && this.currentlyPlaying !== postId) {
            console.log(`⏸️ Pausing post ${this.currentlyPlaying}`);
            const entry = this.players.get(this.currentlyPlaying);
            entry?.player.pause();
        }

        const entry = this.players.get(postId);
        if (entry) {
            console.log(`▶️ Actually playing post ${postId}, status: ${entry.player.status}`);
            entry.player.play();
            entry.lastUsed = Date.now();
            this.currentlyPlaying = postId;
        } else {
            console.warn(`⚠️ No player found for post ${postId}`);
        }
    }

    pause(postId: number): void {
        console.log(`⏸️ Pause requested for post ${postId}`);
        const entry = this.players.get(postId);
        entry?.player.pause();

        if (this.currentlyPlaying === postId) {
            this.currentlyPlaying = null;
        }
    }

    pauseAll(): void {
        console.log(`⏸️ Pausing all videos`);
        this.players.forEach(({ player }) => player.pause());
        this.currentlyPlaying = null;
    }

    getPlayer(postId: number): VideoPlayer | undefined {
        return this.players.get(postId)?.player;
    }

    setMuted(postId: number, muted: boolean): void {
        const entry = this.players.get(postId);
        if (entry) {
            entry.player.muted = muted;
        }
    }

    private releaseOldest(): void {
        let oldestId: number | null = null;
        let oldestTime = Infinity;

        this.players.forEach((entry, id) => {
            if (id === this.currentlyPlaying) return;
            if (entry.lastUsed < oldestTime) {
                oldestTime = entry.lastUsed;
                oldestId = id;
            }
        });

        if (oldestId !== null) {
            console.log(`🗑️ Releasing player for post ${oldestId}`);
            const entry = this.players.get(oldestId);
            entry?.player.release();
            this.players.delete(oldestId);
        }
    }

    releaseAll(): void {
        this.players.forEach(({ player }) => player.release());
        this.players.clear();
        this.currentlyPlaying = null;
    }
}

export const videoManager = new VideoPlayerManager();