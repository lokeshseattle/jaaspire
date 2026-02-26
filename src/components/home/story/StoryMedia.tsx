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
  const { type, uri } = story;

  // ✅ Always called, never conditional
  const player = useVideoPlayer(type === "video" ? uri : null);

  // Video play / pause control
  useEffect(() => {
    if (!player || type !== "video") return;

    paused ? player.pause() : player.play();
  }, [player, paused, type]);

  // Video duration listener
  useEffect(() => {
    if (!player || type !== "video") return;

    const sub = player.addListener("statusChange", (status) => {
      if (status.status === "readyToPlay") {
        onVideoLoad?.(player.duration ?? 5000);
      }
    });

    return () => sub.remove();
  }, [player, type, onVideoLoad]);

  // Image prefetch
  useEffect(() => {
    if (type === "image") {
      Image.prefetch(uri);
    }
  }, [type, uri]);

  // Render
  if (type === "video" && player) {
    return (
      <VideoView player={player} style={styles.media} contentFit="cover" />
    );
  }

  return <Image source={{ uri }} style={styles.media} resizeMode="cover" />;
}

const styles = StyleSheet.create({
  media: {
    flex: 1,
  },
});
