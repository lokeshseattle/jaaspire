import React from "react";
import { TextInput } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";

export default function DraggableText() {
  const translateX = useSharedValue(100);
  const translateY = useSharedValue(200);

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

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[animatedStyle, { position: "absolute" }]}>
        <TextInput
          placeholder="Type something..."
          style={{
            color: "white",
            fontSize: 28,
            fontWeight: "bold",
          }}
        />
      </Animated.View>
    </GestureDetector>
  );
}
