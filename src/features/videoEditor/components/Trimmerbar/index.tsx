import React from "react";
import { StyleSheet, View } from "react-native";
import Animated from "react-native-reanimated";
import { LAYOUT, TRIMMER } from "../../constants";
import { ThumbnailFrame, TrimRange } from "../../types";
import { Playhead } from "./Playhead";
import { ThumbnailBackground } from "./ThumbnailBackground";
import { TimeLabels } from "./TimeLabels";
import { TrimHandle } from "./TrimHandle";
import { TrimSelection } from "./TrimSelection";

interface TrimmerBarProps {
  duration: number;
  trimRange: TrimRange;
  thumbnails: (ThumbnailFrame | undefined)[];
  thumbnailsLoading?: boolean;
  leftHandleGesture: ReturnType<typeof import("react-native-gesture-handler").Gesture.Pan>;
  rightHandleGesture: ReturnType<typeof import("react-native-gesture-handler").Gesture.Pan>;
  middleGesture: ReturnType<typeof import("react-native-gesture-handler").Gesture.Pan>;
  playheadGesture: ReturnType<typeof import("react-native-gesture-handler").Gesture.Pan>;
  leftHandleStyle: ReturnType<typeof Animated.useAnimatedStyle>;
  rightHandleStyle: ReturnType<typeof Animated.useAnimatedStyle>;
  selectionStyle: ReturnType<typeof Animated.useAnimatedStyle>;
  leftDimStyle: ReturnType<typeof Animated.useAnimatedStyle>;
  rightDimStyle: ReturnType<typeof Animated.useAnimatedStyle>;
  playheadStyle: ReturnType<typeof Animated.useAnimatedStyle>;
}

export const TrimmerBar: React.FC<TrimmerBarProps> = ({
  duration,
  trimRange,
  thumbnails,
  thumbnailsLoading = false,
  leftHandleGesture,
  rightHandleGesture,
  middleGesture,
  playheadGesture,
  leftHandleStyle,
  rightHandleStyle,
  selectionStyle,
  leftDimStyle,
  rightDimStyle,
  playheadStyle,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.track}>
        <ThumbnailBackground
          thumbnails={thumbnails}
          isLoading={thumbnailsLoading}
        />

        <TrimSelection gesture={middleGesture} style={selectionStyle} />

        <Animated.View style={leftDimStyle} pointerEvents="none" />
        <Animated.View style={rightDimStyle} pointerEvents="none" />

        <TrimHandle
          gesture={leftHandleGesture}
          style={leftHandleStyle}
          position="left"
        />

        <TrimHandle
          gesture={rightHandleGesture}
          style={rightHandleStyle}
          position="right"
        />

        <Playhead animatedStyle={playheadStyle} gesture={playheadGesture} />
      </View>

      <TimeLabels
        startTime={trimRange.startTime}
        endTime={trimRange.endTime}
        duration={duration}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: LAYOUT.TRIMMER_HORIZONTAL_PADDING,
    paddingVertical: 10,
  },
  track: {
    width: LAYOUT.TRIMMER_WIDTH,
    height: TRIMMER.BAR_HEIGHT,
    backgroundColor: "#374151",
    borderRadius: 6,
    position: "relative",
    overflow: "hidden",
  },
});
