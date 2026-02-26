import React, { useState } from "react";
import { StyleSheet, TextInput, useWindowDimensions } from "react-native";

import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
interface Props {
  isCapturing?: boolean;
}

export default function TextOverlayLayer({ isCapturing }: Props) {
  const { width, height } = useWindowDimensions();

  const [text, setText] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const startX = width / 2;
  const startY = height / 2;

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const scale = useSharedValue(1);

  const exitEditing = () => {
    setIsEditing(false);

    if (!text || text.trim() === "") {
      setText(null);
      translateX.value = 0;
      translateY.value = 0;
      savedX.value = 0;
      savedY.value = 0;
    }
  };

  const panGesture = Gesture.Pan()
    .enabled(text !== null)
    .onBegin(() => {
      if (isEditing) {
        runOnJS(exitEditing)();
      }

      scale.value = withTiming(1.05);
    })
    .onUpdate((e) => {
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;
      scale.value = withTiming(1);
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (text !== null) {
        runOnJS(setIsEditing)(true);
      }
    });

  const outsideTapGesture = Gesture.Tap().onEnd(() => {
    if (isEditing) {
      runOnJS(exitEditing)();
    }
  });

  const composedGesture = Gesture.Simultaneous(
    panGesture,
    doubleTapGesture,
    outsideTapGesture,
  );

  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    left: startX,
    top: startY,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
      { translateX: -75 },
      { translateY: -25 },
    ],
  }));

  return (
    <>
      {text !== null && (
        <GestureDetector gesture={composedGesture}>
          <Animated.View style={[styles.container, animatedStyle]}>
            {isEditing ? (
              <TextInput
                value={text}
                onChangeText={
                  (v) => setText(v.replace(/\n/g, "")) // disable new lines
                }
                autoFocus
                blurOnSubmit
                returnKeyType="done"
                onSubmitEditing={exitEditing}
                onBlur={exitEditing}
                style={styles.input}
                placeholder="Type something..."
                placeholderTextColor="rgba(255,255,255,0.6)"
              />
            ) : (
              <Animated.Text style={styles.text}>{text}</Animated.Text>
            )}
          </Animated.View>
        </GestureDetector>
      )}

      {text === null && !isCapturing && (
        <Animated.View style={styles.addButton}>
          <Ionicons
            name="text"
            size={22}
            color="white"
            onPress={() => {
              setText("");
              setIsEditing(true);
            }}
          />
        </Animated.View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.65)",
  },
  text: {
    color: "white",
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
  },
  input: {
    color: "white",
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    minWidth: 120,
  },
  addButton: {
    position: "absolute",
    bottom: 110,
    alignSelf: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
});
