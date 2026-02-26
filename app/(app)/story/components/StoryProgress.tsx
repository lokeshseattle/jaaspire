import React from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  interpolate,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Props {
  total: number;
  currentIndex: number;
  progress: { value: number };
}

interface SegmentProps {
  index: number;
  currentIndex: number;
  progress: { value: number };
}

const ProgressSegment = ({ index, currentIndex, progress }: SegmentProps) => {
  const animatedStyle = useAnimatedStyle(() => {
    let widthPercent = 0;

    if (index < currentIndex) {
      widthPercent = 100;
    } else if (index === currentIndex) {
      widthPercent = interpolate(progress.value, [0, 1], [0, 100]);
    }

    return { width: `${widthPercent}%` };
  }, [currentIndex]);

  return (
    <View style={styles.segment}>
      <Animated.View style={[styles.fill, animatedStyle]} />
    </View>
  );
};

const StoryProgress = ({ total, currentIndex, progress }: Props) => {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      {Array.from({ length: total }).map((_, index) => (
        <ProgressSegment
          key={index}
          index={index}
          currentIndex={currentIndex}
          progress={progress}
        />
      ))}
    </View>
  );
};

export default StoryProgress;

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 10,
    right: 10,
    flexDirection: "row",
    gap: 4,
    zIndex: 50,
  },
  segment: {
    flex: 1,
    height: 2.5,
    backgroundColor: "rgba(255,255,255,0.3)",
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    backgroundColor: "white",
    borderRadius: 2,
  },
});
