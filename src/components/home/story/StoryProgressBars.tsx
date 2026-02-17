import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
    interpolate,
    useAnimatedStyle,
} from "react-native-reanimated";
import { StoryItem } from "./types";

interface StoryProgressBarsProps {
  stories: StoryItem[];
  progress: { value: number }; // Use a plain object with value property to avoid type error
  currentIndex: number;
}

export default function StoryProgressBars({
  stories,
  progress,
  currentIndex,
}: StoryProgressBarsProps) {
  return (
    <View style={styles.container}>
      {stories.map((_, index) => {
        const animatedStyle = useAnimatedStyle(() => {
          let widthPercentage = 0;

          if (index < currentIndex) {
            widthPercentage = 100;
          } else if (index === currentIndex) {
            widthPercentage = interpolate(progress.value, [0, 1], [0, 100]);
          }

          return {
            width: `${widthPercentage}%`,
          };
        });

        return (
          <View key={index} style={styles.background}>
            <Animated.View style={[styles.fill, animatedStyle]} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 30,
    left: 10,
    right: 10,
    flexDirection: "row",
    gap: 4,
    zIndex: 50,
  },
  background: {
    flex: 1,
    height: 3,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: 3,
    backgroundColor: "white",
  },
});
