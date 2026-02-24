import React from "react";
import { Dimensions, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";

import CropOverlay from "./CropOverlay";

const { width } = Dimensions.get("window");
const CROP_SIZE = width;

interface Props {
  imageUri: string;
}

export default function CropView({ imageUri }: Props) {
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const startScale = useSharedValue(1);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = translateX.value;
      startY.value = translateY.value;
    })
    .onUpdate((e) => {
      translateX.value = startX.value + e.translationX;
      translateY.value = startY.value + e.translationY;
    });

  const pinch = Gesture.Pinch()
    .onStart(() => {
      startScale.value = scale.value;
    })
    .onUpdate((e) => {
      scale.value = startScale.value * e.scale;
    });

  const composed = Gesture.Simultaneous(pan, pinch);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <View style={{ flex: 1, backgroundColor: "black" }}>
      <GestureDetector gesture={composed}>
        <Animated.Image
          source={{ uri: imageUri }}
          style={[
            {
              width: CROP_SIZE,
              height: CROP_SIZE,
              alignSelf: "center",
            },
            animatedStyle,
          ]}
          resizeMode="cover"
        />
      </GestureDetector>

      <CropOverlay />
    </View>
  );
}
