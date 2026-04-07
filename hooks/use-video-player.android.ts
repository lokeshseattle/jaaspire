import { videoManager } from "@/src/lib/video-manager.android";
import type {
    PlayingChangeEventPayload,
    StatusChangeEventPayload,
    VideoPlayer,
} from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";

function safePlayerSnapshot(p: VideoPlayer): {
  status: VideoPlayer["status"];
  playing: boolean;
} | null {
  try {
    return { status: p.status, playing: p.playing };
  } catch {
    return null;
  }
}

export function useManagedVideoPlayer(
  postId: number,
  url: string | null,
  isFocused: boolean,
  nextPostUrl?: string,
  nextPostId?: number,
) {
  // Individual state atoms — React can bail out when the primitive value
  // hasn't changed, unlike a single object where spread always creates
  // a new reference.
  const [player, setPlayer] = useState<VideoPlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(videoManager.getGlobalMuted());

  const isFocusedRef = useRef(isFocused);
  const postIdRef = useRef(postId);
  const playerRef = useRef<VideoPlayer | null>(null);

  isFocusedRef.current = isFocused;
  postIdRef.current = postId;

  useEffect(() => {
    if (!url) {
      setPlayer(null);
      setIsReady(false);
      setIsBuffering(false);
      setIsPlaying(false);
      playerRef.current = null;
      return;
    }

    const currentPostId = postId;
    const p = videoManager.getOrCreatePlayer(currentPostId, url);

    playerRef.current = p;
    videoManager.mount(currentPostId);

    // Set player ref first
    setPlayer(p);

    const initial = safePlayerSnapshot(p);
    if (!initial) {
      setIsReady(false);
      setIsBuffering(false);
      setIsPlaying(false);
    } else if (initial.status === "readyToPlay") {
      setIsReady(true);
      setIsBuffering(false);
      setIsPlaying(initial.playing);
      if (isFocusedRef.current) {
        videoManager.play(currentPostId);
      }
    } else if (initial.status === "loading") {
      setIsReady(false);
      setIsBuffering(true);
      setIsPlaying(initial.playing);
    } else {
      setIsReady(false);
      setIsBuffering(false);
      setIsPlaying(initial.playing);
    }

    const statusSub = p.addListener(
      "statusChange",
      ({ status, error }: StatusChangeEventPayload) => {
        switch (status) {
          case "readyToPlay":
            setIsReady(true);
            setIsBuffering(false);
            if (isFocusedRef.current && postIdRef.current === currentPostId) {
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
            setIsReady(false);
            setIsBuffering(false);
            if (__DEV__) {
              console.error(`[VideoPlayer:${currentPostId}] error:`, error);
            }
            break;
        }
      },
    );

    const playingSub = p.addListener(
      "playingChange",
      ({ isPlaying: playing }: PlayingChangeEventPayload) => {
        setIsPlaying(playing);
      },
    );

    return () => {
      statusSub.remove();
      playingSub.remove();
      videoManager.unmount(currentPostId);
      videoManager.pause(currentPostId);
    };
  }, [postId, url]);

  useEffect(() => {
    return videoManager.subscribeToMute(setIsMuted);
  }, []);

  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;

    const currentPostId = postIdRef.current;
    const snap = safePlayerSnapshot(p);
    if (!snap) return;

    if (isFocused) {
      if (snap.status === "readyToPlay") {
        videoManager.play(currentPostId);
      }
    } else {
      if (snap.playing) {
        videoManager.pause(currentPostId);
      }
    }
  }, [isFocused]);

  useEffect(() => {
    if (nextPostUrl && nextPostId) {
      videoManager.preload(nextPostId, nextPostUrl);
    }
  }, [nextPostUrl, nextPostId]);

  const togglePlayPause = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const snap = safePlayerSnapshot(p);
    if (!snap || snap.status !== "readyToPlay") return;

    const currentPostId = postIdRef.current;
    if (snap.playing) {
      videoManager.pause(currentPostId);
    } else {
      videoManager.play(currentPostId);
    }
  }, []);

  const toggleMute = useCallback(() => {
    videoManager.setGlobalMuted(!videoManager.getGlobalMuted());
  }, []);

  const pause = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    videoManager.pause(postIdRef.current);
  }, []);

  const play = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    const snap = safePlayerSnapshot(p);
    if (!snap || snap.status !== "readyToPlay") return;
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
