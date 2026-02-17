import { VideoView, useVideoPlayer } from "expo-video";
import React, { useEffect } from "react";
import { Image, StyleSheet } from "react-native";
import { StoryItem } from "./types";

interface StoryMediaProps {
  story: StoryItem;
  onVideoLoad?: (duration: number) => void;
  paused?: boolean;
}

export default function StoryMedia({
  story,
  onVideoLoad,
  paused = false,
}: StoryMediaProps) {
  // ✅ ALWAYS call hook
  const player = useVideoPlayer(story.type === "video" ? story.uri : null);

  // Handle playback
  useEffect(() => {
    if (!player) return;

    if (story.type === "video") {
      if (paused) {
        player.pause();
      } else {
        player.play();
      }
    }
  }, [player, paused, story.type]);

  // Get duration once ready
  useEffect(() => {
    if (!player || story.type !== "video") return;

    const sub = player.addListener("statusChange", (status) => {
      if (status.status === "readyToPlay") {
        onVideoLoad?.(player.duration ?? 5000);
      }
    });

    return () => {
      sub.remove();
    };
  }, [player, story.type]);

  // Prefetch images
  useEffect(() => {
    if (story.type === "image") {
      Image.prefetch(story.uri);
    }
  }, [story]);

  if (story.type === "video" && player) {
    return (
      <VideoView player={player} style={styles.media} contentFit="cover" />
    );
  }

  return (
    <Image
      source={{ uri: story.uri }}
      style={styles.media}
      resizeMode="cover"
    />
  );
}

const styles = StyleSheet.create({
  media: {
    flex: 1,
  },
});
