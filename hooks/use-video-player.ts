// src/hooks/use-video-player.ts
import { videoManager } from "@/src/lib/video-manager";
import type {
    PlayingChangeEventPayload,
    StatusChangeEventPayload,
    VideoPlayer,
} from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";

export function useManagedVideoPlayer(
    postId: number,
    url: string | null,
    isVisible: boolean,
    nextPostUrl?: string,
    nextPostId?: number
) {
    const [isReady, setIsReady] = useState(false);
    const [isBuffering, setIsBuffering] = useState(true);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(videoManager.getGlobalMuted());
    const [player, setPlayer] = useState<VideoPlayer | null>(null);

    // Refs to avoid stale closures in event listeners
    const isVisibleRef = useRef(isVisible);
    const postIdRef = useRef(postId);
    const urlRef = useRef(url);
    const playerRef = useRef<VideoPlayer | null>(null);

    // Keep refs in sync
    isVisibleRef.current = isVisible;
    postIdRef.current = postId;
    urlRef.current = url;

    // --- Setup current video player + event listeners in ONE effect ---
    // This prevents the race condition where player is ready before listener attaches
    useEffect(() => {
        if (!url) {
            setPlayer(null);
            playerRef.current = null;
            return;
        }

        const currentPostId = postId;
        const p = videoManager.getOrCreatePlayer(currentPostId, url);

        setPlayer(p);
        playerRef.current = p;

        // Mark as mounted IMMEDIATELY so manager knows not to evict
        videoManager.mount(currentPostId);

        // --- CHECK INITIAL STATUS (fixes race condition) ---
        // The player might already be ready if it was preloaded or cached
        const initialStatus = p.status;
        console.log(`🎬 [${currentPostId}] Initial status: ${initialStatus}`);

        if (initialStatus === "readyToPlay") {
            setIsReady(true);
            setIsBuffering(false);
            // Auto-play if visible
            if (isVisibleRef.current) {
                videoManager.play(currentPostId);
            }
        } else if (initialStatus === "loading") {
            setIsBuffering(true);
            setIsReady(false);
        } else {
            setIsReady(false);
            setIsBuffering(false);
        }

        // Sync initial playing state
        setIsPlaying(p.playing);

        // --- ATTACH LISTENERS ---
        const statusSub = p.addListener(
            "statusChange",
            ({ status, error }: StatusChangeEventPayload) => {
                // Use ref to get current postId (avoids stale closure)
                const pid = postIdRef.current;

                console.log(`📺 [${pid}] Status: ${status}`);

                switch (status) {
                    case "readyToPlay":
                        setIsReady(true);
                        setIsBuffering(false);
                        // Auto-play if this post is currently visible
                        if (isVisibleRef.current && postIdRef.current === currentPostId) {
                            videoManager.play(currentPostId);
                        }
                        break;
                    case "loading":
                        setIsBuffering(true);
                        break;
                    case "idle":
                        setIsReady(false);
                        setIsBuffering(false);
                        break;
                    case "error":
                        setIsBuffering(false);
                        setIsReady(false);
                        console.error(`❌ [${pid}] Video error:`, error);
                        break;
                }
            }
        );

        const playingSub = p.addListener(
            "playingChange",
            ({ isPlaying: playing }: PlayingChangeEventPayload) => {
                setIsPlaying(playing);
            }
        );

        // --- CLEANUP ---
        return () => {
            console.log(`🧹 [${currentPostId}] Cleaning up player hook`);
            statusSub.remove();
            playingSub.remove();

            // Mark as unmounted - manager can now safely evict if needed
            videoManager.unmount(currentPostId);

            // Pause if this player was playing
            videoManager.pause(currentPostId);
        };
    }, [postId, url]); // Re-run if postId or url changes

    // --- Sub to global mute state ---
    useEffect(() => {
        return videoManager.subscribeToMute((muted) => {
            setIsMuted(muted);
        });
    }, []);

    // --- Handle visibility changes ---
    useEffect(() => {
        const p = playerRef.current;
        if (!p) return;

        const currentPostId = postIdRef.current;

        if (isVisible) {
            // Only play if ready
            if (p.status === "readyToPlay") {
                console.log(`👁️ [${currentPostId}] Visible & ready, playing`);
                videoManager.play(currentPostId);
            } else {
                console.log(`👁️ [${currentPostId}] Visible but status: ${p.status}`);
            }
        } else {
            // Pause when not visible
            if (p.playing) {
                console.log(`👁️ [${currentPostId}] Not visible, pausing`);
                videoManager.pause(currentPostId);
            }
        }
    }, [isVisible]);

    // --- Preload next video ---
    useEffect(() => {
        if (nextPostUrl && nextPostId) {
            console.log(`⏳ Preloading next post ${nextPostId}`);
            videoManager.preload(nextPostId, nextPostUrl);
        }
    }, [nextPostUrl, nextPostId]);

    // --- Actions ---
    const togglePlayPause = useCallback(() => {
        const p = playerRef.current;
        if (!p || p.status !== "readyToPlay") return;

        const currentPostId = postIdRef.current;
        if (p.playing) {
            videoManager.pause(currentPostId);
        } else {
            videoManager.play(currentPostId);
        }
    }, []);

    const toggleMute = useCallback(() => {
        const currentGlobalMuted = videoManager.getGlobalMuted();
        videoManager.setGlobalMuted(!currentGlobalMuted);
    }, []);

    const pause = useCallback(() => {
        const p = playerRef.current;
        if (!p) return;
        videoManager.pause(postIdRef.current);
    }, []);

    const play = useCallback(() => {
        const p = playerRef.current;
        if (!p || p.status !== "readyToPlay") return;
        videoManager.play(postIdRef.current);
    }, []);

    return {
        player,
        isReady,
        isBuffering,
        isPlaying,
        isMuted,
        togglePlayPause,
        toggleMute,
        pause,
        play,
    };
}