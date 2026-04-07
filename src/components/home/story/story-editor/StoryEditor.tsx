import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { router } from "expo-router";
import TextOverlayLayer from "./TextOverlayLayer";

interface Props {
  imageUri: string;
}

const MAX_SCALE = 4;
const MIN_SCALE = 1;

export default function StoryEditor({ imageUri }: Props) {
  const uploadStoryImage = usePostStoryImage();
  const viewRef = useRef<View>(null);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const [saving, setSaving] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(1);
  const [isCapturing, setIsCapturing] = useState(false);

  /* ---------------- Aspect Ratio ---------------- */

  useEffect(() => {
    if (!imageUri) return;

    Image.getSize(imageUri, (w, h) => {
      setAspectRatio(w / h);
    });
  }, [imageUri]);

  /* ---------------- Base Image Size ---------------- */

  const baseWidth = screenWidth;
  const baseHeight = screenWidth / aspectRatio;

  /* ---------------- Shared Values ---------------- */

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  /* ---------------- Clamp Helper ---------------- */

  const clamp = (value: number, min: number, max: number) => {
    "worklet";
    return Math.min(Math.max(value, min), max);
  };

  const getBoundaries = (currentScale: number) => {
    "worklet";

    const scaledWidth = baseWidth * currentScale;
    const scaledHeight = baseHeight * currentScale;

    const boundX = Math.max(0, (scaledWidth - screenWidth) / 2);
    const boundY = Math.max(0, (scaledHeight - screenHeight) / 2);

    return { boundX, boundY };
  };

  /* ---------------- Pinch Gesture ---------------- */

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

  /* ---------------- Pan Gesture ---------------- */

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

  /* ---------------- Animated Style ---------------- */

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  /* ---------------- Save ---------------- */

  const saveToGallery = async () => {
    if (!viewRef.current) return;

    setSaving(true);
    setIsCapturing(true);

    try {
      await new Promise((resolve) => setTimeout(resolve, 50)); // allow UI to re-render

      const uri = await captureRef(viewRef, {
        format: "png",
        quality: 1,
      });

      __DEV__ && console.log("👁️ uri: ", uri);

      uploadStoryImage.mutate(
        { uri },
        {
          onSuccess: () => {
            router.replace("/(app)/(tabs)");
          },
          onError: (e) => {
            console.log("👁️ error: ", e);
          },
        },
      );
    } catch (e) {
      console.log("Capture error:", e);
    } finally {
      setIsCapturing(false);
      setSaving(false);
    }
  };

  /* ---------------- Render ---------------- */

  return (
    <View style={styles.container}>
      <View style={styles.editor}>
        <View ref={viewRef} style={styles.canvas}>
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={animatedStyle}>
              <Image
                source={{ uri: imageUri }}
                style={[styles.image, { aspectRatio }]}
              />
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
      {!saving && (
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

/* ---------------- Styles ---------------- */

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
    // gap: 6,

    // paddingHorizontal: 18,
    // paddingVertical: 10,

    height: 40,
    width: 40,

    justifyContent: "center",

    backgroundColor: "rgba(255,255,255,0.25)", // dark glass instead of white
    borderRadius: 20,

    // shadow (iOS)
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,

    // elevation (Android)
    elevation: 6,
  },
  canvas: {
    flex: 1,
    width: "100%",
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: undefined,
    resizeMode: "contain",
  },
  saveButton: {
    position: "absolute",
    bottom: 40,
    right: 20,
    color: "#000",
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
