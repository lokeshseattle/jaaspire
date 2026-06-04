import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image as RNImage,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { captureRef } from "react-native-view-shot";

import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { usePostStoryImage } from "@/src/features/story/story.hooks";
import { useContainMediaLayout } from "@/src/hooks/use-vertical-video-layout";
import { useVideoTrackSize } from "@/src/hooks/use-video-track-size";
import { Image } from "expo-image";
import { router } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import TextOverlayLayer from "./TextOverlayLayer";

interface Props {
  mediaUri: string;
  mediaType?: "image" | "video";
}

const MAX_SCALE = 4;
const MIN_SCALE = 1;

function inferMediaType(uri: string, mediaType?: "image" | "video"): "image" | "video" {
  if (mediaType) return mediaType;
  return /\.(mp4|mov|m4v|webm|avi|mkv)(\?|$)/i.test(uri) ? "video" : "image";
}

export default function StoryEditor({
  mediaUri,
  mediaType: mediaTypeProp,
}: Props) {
  const uploadStoryImage = usePostStoryImage();
  const viewRef = useRef<View>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const mediaType = inferMediaType(mediaUri, mediaTypeProp);
  const isVideo = mediaType === "video";

  const [saving, setSaving] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [imageSourceSize, setImageSourceSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  const player = useVideoPlayer(isVideo ? mediaUri : null, (p) => {
    p.loop = true;
    p.muted = false;
    p.play();
  });

  const [playerReady, setPlayerReady] = useState(false);

  useEffect(() => {
    if (!player || !isVideo) {
      setPlayerReady(false);
      return;
    }

    const syncReady = () => {
      try {
        setPlayerReady(player.status === "readyToPlay");
      } catch {
        setPlayerReady(false);
      }
    };

    syncReady();
    const sub = player.addListener("statusChange", syncReady);
    return () => sub.remove();
  }, [player, isVideo]);

  const trackSize = useVideoTrackSize(isVideo ? player : null, playerReady);
  const sourceWidth = isVideo ? trackSize?.width : imageSourceSize?.width;
  const sourceHeight = isVideo ? trackSize?.height : imageSourceSize?.height;

  const mediaLayout = useContainMediaLayout(
    screenWidth,
    screenHeight,
    sourceWidth,
    sourceHeight,
  );

  const baseWidth = mediaLayout.frameWidth;
  const baseHeight = mediaLayout.frameHeight;

  const baseWidthSv = useSharedValue(baseWidth);
  const baseHeightSv = useSharedValue(baseHeight);

  useEffect(() => {
    baseWidthSv.value = baseWidth;
    baseHeightSv.value = baseHeight;
  }, [baseWidth, baseHeight, baseWidthSv, baseHeightSv]);

  useEffect(() => {
    if (!mediaUri || isVideo) {
      setImageSourceSize(null);
      return;
    }

    RNImage.getSize(
      mediaUri,
      (width, height) => {
        if (width > 0 && height > 0) {
          setImageSourceSize({ width, height });
        }
      },
      () => {
        /* onLoad fallback */
      },
    );
  }, [mediaUri, isVideo]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetTransforms = useCallback(() => {
    scale.value = 1;
    savedScale.value = 1;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [scale, savedScale, translateX, translateY, savedTranslateX, savedTranslateY]);

  useEffect(() => {
    resetTransforms();
  }, [mediaUri, baseWidth, baseHeight, resetTransforms]);

  const clamp = (value: number, min: number, max: number) => {
    "worklet";
    return Math.min(Math.max(value, min), max);
  };

  const getBoundaries = (currentScale: number) => {
    "worklet";

    const scaledWidth = baseWidthSv.value * currentScale;
    const scaledHeight = baseHeightSv.value * currentScale;

    const boundX = Math.max(0, (scaledWidth - screenWidth) / 2);
    const boundY = Math.max(0, (scaledHeight - screenHeight) / 2);

    return { boundX, boundY };
  };

  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      let nextScale = savedScale.value * e.scale;
      nextScale = clamp(nextScale, MIN_SCALE, MAX_SCALE);
      scale.value = nextScale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;

      const { boundX, boundY } = getBoundaries(scale.value);

      translateX.value = withTiming(clamp(translateX.value, -boundX, boundX));
      translateY.value = withTiming(clamp(translateY.value, -boundY, boundY));
    });

  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      const { boundX, boundY } = getBoundaries(scale.value);

      translateX.value = clamp(
        savedTranslateX.value + e.translationX,
        -boundX,
        boundX,
      );

      translateY.value = clamp(
        savedTranslateY.value + e.translationY,
        -boundY,
        boundY,
      );
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composedGesture = Gesture.Simultaneous(pinchGesture, panGesture);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const saveToGallery = async () => {
    if (!viewRef.current || isVideo) return;

    setSaving(true);
    setIsCapturing(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 50));

      const uri = await captureRef(viewRef, {
        format: "png",
        quality: 1,
      });

      uploadStoryImage.mutate(
        { uri },
        {
          onSuccess: () => {
            router.replace("/(app)/(tabs)");
          },
        },
      );
    } finally {
      setIsCapturing(false);
      setSaving(false);
    }
  };

  const handleImageLoad = useCallback((event: unknown) => {
    const source = (event as { source?: { width?: number; height?: number } })
      ?.source;
    const width = source?.width;
    const height = source?.height;
    if (width && height) {
      setImageSourceSize((prev) =>
        prev?.width === width && prev?.height === height
          ? prev
          : { width, height },
      );
    }
  }, []);

  const showMedia = baseWidth > 0 && baseHeight > 0;
  const showSave = !isVideo && !saving;

  const mediaContent = useMemo(() => {
    if (!showMedia) {
      return (
        <View style={styles.loading}>
          <ActivityIndicator color="#fff" />
        </View>
      );
    }

    if (isVideo && player) {
      return (
        <View
          style={[styles.mediaFrame, { width: baseWidth, height: baseHeight }]}
        >
          <VideoView
            style={StyleSheet.absoluteFill}
            player={player}
            contentFit="contain"
            nativeControls={false}
            allowsPictureInPicture={false}
            fullscreenOptions={{ enable: false }}
            useExoShutter={false}
          />
        </View>
      );
    }

    return (
      <Image
        source={{ uri: mediaUri }}
        style={{ width: baseWidth, height: baseHeight }}
        contentFit="contain"
        cachePolicy="disk"
        transition={0}
        onLoad={handleImageLoad}
      />
    );
  }, [
    showMedia,
    isVideo,
    player,
    baseWidth,
    baseHeight,
    mediaUri,
    handleImageLoad,
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.editor}>
        <View ref={viewRef} style={styles.canvas}>
          <GestureDetector gesture={composedGesture}>
            <Animated.View
              style={[
                styles.mediaStage,
                { width: baseWidth, height: baseHeight },
                animatedStyle,
              ]}
            >
              {mediaContent}
            </Animated.View>
          </GestureDetector>

          <TextOverlayLayer isCapturing={isCapturing} />
        </View>
      </View>
      <Pressable
        style={styles.crossButton}
        disabled={uploadStoryImage.isPending}
        onPress={router.back}
      >
        <Text style={styles.saveText}>X</Text>
      </Pressable>
      {showSave && (
        <Pressable
          style={styles.saveButton}
          disabled={uploadStoryImage.isPending}
          onPress={saveToGallery}
        >
          {uploadStoryImage.isPending && <ActivityIndicator />}
          <Text style={styles.saveText}>Upload Story</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
  },
  editor: {
    flex: 1,
  },
  crossButton: {
    position: "absolute",
    top: 50,
    left: 20,
    flexDirection: "row",
    alignItems: "center",
    height: 40,
    width: 40,
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  canvas: {
    flex: 1,
    width: "100%",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  mediaStage: {
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  mediaFrame: {
    overflow: "hidden",
    backgroundColor: "#000",
  },
  loading: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  saveButton: {
    position: "absolute",
    bottom: 40,
    right: 20,
    backgroundColor: "rgba(255,255,255,.20)",
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 8,
  },
  saveText: {
    color: "#fff",
    fontWeight: "600",
  },
});
