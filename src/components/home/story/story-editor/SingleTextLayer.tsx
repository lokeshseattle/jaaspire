import React, { useRef, useState } from "react";
import {
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableWithoutFeedback,
    useWindowDimensions,
} from "react-native";

import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";

import { Gesture, GestureDetector } from "react-native-gesture-handler";

interface Props {
  id: string;
  text: string;
  onChange: (id: string, value: string) => void;
}

export default function SingleTextLayer({ id, text, onChange }: Props) {
  const { width, height } = useWindowDimensions();
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedX = useSharedValue(0);
  const savedY = useSharedValue(0);

  const clamp = (value: number, min: number, max: number) => {
    "worklet";
    return Math.min(Math.max(value, min), max);
  };

  const panGesture = Gesture.Pan()
    .enabled(!isEditing)
    .onUpdate((e) => {
      translateX.value = savedX.value + e.translationX;
      translateY.value = savedY.value + e.translationY;
    })
    .onEnd(() => {
      savedX.value = translateX.value;
      savedY.value = translateY.value;

      translateX.value = withTiming(translateX.value);
      translateY.value = withTiming(translateY.value);
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const enterEdit = () => {
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const exitEdit = () => {
    setIsEditing(false);
    Keyboard.dismiss();
  };

  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[styles.container, animatedStyle]}>
        <TouchableWithoutFeedback onPress={enterEdit}>
          {isEditing ? (
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={(v) => onChange(id, v)}
              style={styles.text}
              multiline
              textAlign="center"
              onBlur={exitEdit}
            />
          ) : (
            <Text style={styles.text}>{text}</Text>
          )}
        </TouchableWithoutFeedback>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.65)",
    maxWidth: "80%",
  },
  text: {
    color: "white",
    fontSize: 22,
    fontWeight: "600",
    lineHeight: 28,
  },
});
