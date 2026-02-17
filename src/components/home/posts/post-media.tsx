import { Image } from "expo-image";
import { VideoView, useVideoPlayer } from "expo-video";
import { memo, useEffect, useState } from "react";

import { Pressable, StyleSheet, View } from "react-native";

interface Props {
  type: string;
  media: string;
  isVisible: boolean;
}

function PostMedia({ type, media, isVisible }: Props) {
  const player = useVideoPlayer(type === "video" ? media : null, (p) => {
    if (!p) return;
    p.loop = true;
    p.muted = false;
  });

  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);

  const toggleAudio = () => {
    if (!player) return;

    const newMutedState = !isMuted;
    player.muted = newMutedState;
    setIsMuted(newMutedState);
  };

  const handleVideoPress = () => {
    if (!player) return;

    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    setIsPlaying(!isPlaying);
  };

  useEffect(() => {
    if (type !== "video" || !player) return;

    if (isVisible) {
      player.play();
    } else {
      player.pause();
    }
  }, [isVisible, player, type]);

  // Image type
  if (type === "image") {
    return (
      <Image
        source={{ uri: media }}
        style={styles.media}
        contentFit="cover"
        cachePolicy="disk"
        transition={200}
      />
    );
  }

  if (!player) {
    return <View style={[styles.media, styles.placeholder]} />;
  }

  return (
    <Pressable
      //   onLongPress={handleVideoPress}
      onPressIn={handleVideoPress}
      onPress={toggleAudio}
    >
      <VideoView
        style={styles.media}
        player={player}
        contentFit="cover"
        nativeControls={false}
        // allowsFullscreen={false}
        allowsPictureInPicture={false}
        fullscreenOptions={{ enable: true }}
      />
    </Pressable>
  );
}

export default memo(PostMedia);

const styles = StyleSheet.create({
  media: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#000",
  },
  placeholder: {
    backgroundColor: "#1a1a1a",
  },
});
