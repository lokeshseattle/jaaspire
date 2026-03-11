import { useEvent } from "expo";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ActivityIndicator, Image, StyleSheet, View } from "react-native";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface Props {
  uri: string;
  type: "image" | "video";
  paused: boolean;
  onVideoLoad?: (duration: number) => void;
  onTimeUpdate?: (currentTime: number) => void;
  onVideoEnd?: () => void;
}

export interface StoryMediaHandle {
  seekTo: (seconds: number) => void;
  setPlaybackRate: (rate: number) => void;
}

// ─────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────
const StoryMedia = forwardRef<StoryMediaHandle, Props>(
  ({ uri, type, paused, onVideoLoad, onTimeUpdate, onVideoEnd }, ref) => {
    const [isBuffering, setIsBuffering] = useState(type === "video");

    // Always call useVideoPlayer (hooks rule) - pass null for images
    const player = useVideoPlayer(type === "video" ? uri : null, (p) => {
      if (type === "video") {
        p.loop = false;
        p.muted = false;
        p.play();
      }
    });

    // ─────────────────────────────────────────────────────────
    // Expose seekTo and setPlaybackRate to parent via ref
    // ─────────────────────────────────────────────────────────
    useImperativeHandle(ref, () => ({
      seekTo: (seconds: number) => {
        if (type === "video" && player) {
          player.currentTime = seconds;
        }
      },
      setPlaybackRate: (rate: number) => {
        if (type === "video" && player) {
          player.playbackRate = rate;
        }
      },
    }), [player, type]);

    // ─────────────────────────────────────────────────────────
    // Handle pause/play based on prop
    // ─────────────────────────────────────────────────────────
    useEffect(() => {
      if (type !== "video" || !player) return;

      if (paused) {
        player.pause();
      } else {
        player.play();
      }
    }, [paused, player, type]);

    // ─────────────────────────────────────────────────────────
    // Subscribe to player status changes (for duration + buffering)
    // ─────────────────────────────────────────────────────────
    const { status } = useEvent(player, "statusChange", {
      status: player?.status
    });

    useEffect(() => {
      if (type !== "video") return;

      if (status === "readyToPlay") {
        setIsBuffering(false);
        if (player?.duration && player.duration > 0) {
          onVideoLoad?.(player.duration);
        }
      } else if (status === "loading") {
        setIsBuffering(true);
      }
    }, [status, player?.duration, type, onVideoLoad]);

    // Reset buffering state when uri changes
    useEffect(() => {
      if (type === "video") {
        setIsBuffering(true);
      }
    }, [uri, type]);

    // ─────────────────────────────────────────────────────────
    // Poll currentTime for progress updates (more reliable than event)
    // ─────────────────────────────────────────────────────────
    useEffect(() => {
      if (type !== "video" || !player) return;

      const interval = setInterval(() => {
        if (!paused && player.currentTime !== undefined) {
          onTimeUpdate?.(player.currentTime);
        }
      }, 100);

      return () => clearInterval(interval);
    }, [player, type, paused, onTimeUpdate]);

    // ─────────────────────────────────────────────────────────
    // Subscribe to playback state changes (for end detection)
    // ─────────────────────────────────────────────────────────
    const { isPlaying } = useEvent(player, "playingChange", {
      isPlaying: player?.playing ?? false,
    });

    useEffect(() => {
      if (
        type === "video" &&
        player &&
        !isPlaying &&
        status === "readyToPlay" &&
        player.duration &&
        player.currentTime >= player.duration - 0.1
      ) {
        onVideoEnd?.();
      }
    }, [isPlaying, status, player, type, onVideoEnd]);

    // ─────────────────────────────────────────────────────────
    // Render
    // ─────────────────────────────────────────────────────────
    return (
      <View style={styles.container}>
        {type === "video" ? (
          <VideoView
            player={player}
            style={styles.media}
            contentFit="contain"
            nativeControls={false}
          />
        ) : (
          <Image
            source={{ uri }}
            style={styles.media}
            resizeMode="contain"
          />
        )}

        {/* Buffering spinner — shown only while video is loading */}
        {isBuffering && type === "video" && (
          <View style={styles.loaderOverlay}>
            <ActivityIndicator size="large" color="white" />
          </View>
        )}
      </View>
    );
  }
);

StoryMedia.displayName = "StoryMedia";

export default StoryMedia;

// ─────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "black",
  },
  media: {
    width: "100%",
    height: "100%",
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
});