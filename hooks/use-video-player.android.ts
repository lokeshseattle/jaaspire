import { videoManager } from "@/src/lib/video-manager.android";
import type {
    PlayingChangeEventPayload,
    StatusChangeEventPayload,
    VideoPlayer,
} from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";

type VideoHookState = {
  player: VideoPlayer | null;
  isReady: boolean;
  isBuffering: boolean;
  isPlaying: boolean;
};

const EMPTY_STATE: VideoHookState = {
  player: null,
  isReady: false,
  isBuffering: false,
  isPlaying: false,
};

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
  const [state, setState] = useState<VideoHookState>(EMPTY_STATE);
  const [isMuted, setIsMuted] = useState(videoManager.getGlobalMuted());

  const isFocusedRef = useRef(isFocused);
  const postIdRef = useRef(postId);
  const playerRef = useRef<VideoPlayer | null>(null);

  isFocusedRef.current = isFocused;
  postIdRef.current = postId;

  useEffect(() => {
    if (!url) {
      setState(EMPTY_STATE);
      playerRef.current = null;
      return;
    }

    const currentPostId = postId;
    const p = videoManager.getOrCreatePlayer(currentPostId, url);

    playerRef.current = p;
    videoManager.mount(currentPostId);

    const initial = safePlayerSnapshot(p);
    if (!initial) {
      setState({
        player: p,
        isReady: false,
        isBuffering: false,
        isPlaying: false,
      });
    } else if (initial.status === "readyToPlay") {
      setState({
        player: p,
        isReady: true,
        isBuffering: false,
        isPlaying: initial.playing,
      });
      if (isFocusedRef.current) {
        videoManager.play(currentPostId);
      }
    } else if (initial.status === "loading") {
      setState({
        player: p,
        isReady: false,
        isBuffering: true,
        isPlaying: initial.playing,
      });
    } else {
      setState({
        player: p,
        isReady: false,
        isBuffering: false,
        isPlaying: initial.playing,
      });
    }

    const statusSub = p.addListener(
      "statusChange",
      ({ status, error }: StatusChangeEventPayload) => {
        switch (status) {
          case "readyToPlay":
            setState((prev) => ({
              ...prev,
              isReady: true,
              isBuffering: false,
            }));
            if (isFocusedRef.current && postIdRef.current === currentPostId) {
              videoManager.play(currentPostId);
            }
            break;
          case "loading":
            setState((prev) => ({ ...prev, isBuffering: true }));
            break;
          case "idle":
            setState((prev) => ({
              ...prev,
              isReady: false,
              isBuffering: false,
            }));
            break;
          case "error":
            setState((prev) => ({
              ...prev,
              isReady: false,
              isBuffering: false,
            }));
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
        setState((prev) => ({ ...prev, isPlaying: playing }));
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
    player: state.player,
    isReady: state.isReady,
    isBuffering: state.isBuffering,
    isPlaying: state.isPlaying,
    isMuted,
    togglePlayPause,
    toggleMute,
    pause,
    play,
  };
}
