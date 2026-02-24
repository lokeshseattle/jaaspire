import * as ImageManipulator from "expo-image-manipulator";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Dimensions,
    Image,
    Pressable,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue
} from "react-native-reanimated";

const { width } = Dimensions.get("window");

const SCREEN_SIZE = width;
const CIRCLE_SIZE = width * 0.8;

export default function ProfileCropScreen() {
  const { uri } = useLocalSearchParams<{ uri: string }>();
  const router = useRouter();
  const imageManipulator = ImageManipulator.useImageManipulator(uri);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const [imageSize, setImageSize] = useState({
    width: 0,
    height: 0,
  });

  // Get original image size
  useEffect(() => {
    if (!uri) return;

    Image.getSize(uri, (w, h) => {
      setImageSize({ width: w, height: h });
    });
  }, [uri]);

  /* ---------------- PINCH ---------------- */

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      scale.value = savedScale.value * e.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  /* ---------------- PAN ---------------- */

  const pan = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = savedTranslateX.value + e.translationX;
      translateY.value = savedTranslateY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const gesture = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  /* ---------------- CONFIRM / CROP ---------------- */

  const handleConfirm = async () => {
    if (!imageSize.width) return;

    const scaleRatio = imageSize.width / SCREEN_SIZE;

    const cropSize = (CIRCLE_SIZE / scale.value) * scaleRatio;

    const originX =
      (imageSize.width - cropSize) / 2 -
      (translateX.value / scale.value) * scaleRatio;

    const originY =
      (imageSize.height - cropSize) / 2 -
      (translateY.value / scale.value) * scaleRatio;

    imageManipulator.crop({
      originX: Math.max(0, originX),
      originY: Math.max(0, originY),
      width: cropSize,
      height: cropSize,
    });

    const result = await imageManipulator.renderAsync();
    const saved = await result.saveAsync({
      compress: 0.9,
      format: ImageManipulator.SaveFormat.JPEG,
    });

    router.replace({
      pathname: "/profile",
      params: { croppedUri: saved.uri },
    });
  };

  return (
    <View style={styles.container}>
      <GestureDetector gesture={gesture}>
        <Animated.Image
          source={{ uri }}
          style={[styles.image, animatedStyle]}
          resizeMode="cover"
        />
      </GestureDetector>

      {/* Dark overlay */}
      <View style={styles.overlay}>
        <View style={styles.circle} />
      </View>

      <Pressable style={styles.button} onPress={handleConfirm}>
        <Text style={{ color: "white" }}>Confirm</Text>
      </Pressable>
    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "black",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_SIZE,
    height: SCREEN_SIZE,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderColor: "white",
  },
  button: {
    position: "absolute",
    bottom: 60,
    backgroundColor: "#111",
    padding: 16,
    borderRadius: 12,
  },
});
