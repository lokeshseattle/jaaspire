import { Image } from "expo-image";
import { VideoView, type VideoContentFit, type VideoPlayer } from "expo-video";
import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import Animated from "react-native-reanimated";

const DEFAULT_CANVAS = "#000";

export type VerticalVideoFrameProps = {
  frameWidth: number;
  frameHeight: number;
  contentFit?: VideoContentFit;
  canvasColor?: string;
  /** Full-screen feeds: stage fills the parent cell. Inline feeds: stage sizes to the frame. */
  fillParent?: boolean;
  player?: VideoPlayer | null;
  showVideo?: boolean;
  thumbnail?: string | null;
  posterAnimatedStyle?: object;
  onFirstFrameRender?: () => void;
  onPosterLoad?: (event: unknown) => void;
  posterFallbackStyle?: ViewStyle;
  children?: ReactNode;
};

export function VerticalVideoFrame({
  frameWidth,
  frameHeight,
  contentFit = "cover",
  canvasColor = DEFAULT_CANVAS,
  fillParent = true,
  player,
  showVideo = false,
  thumbnail,
  posterAnimatedStyle,
  onFirstFrameRender,
  onPosterLoad,
  posterFallbackStyle,
  children,
}: VerticalVideoFrameProps) {
  if (frameWidth <= 0 || frameHeight <= 0) {
    return null;
  }

  const stageStyle = fillParent
    ? [styles.mediaStageFill, { backgroundColor: canvasColor }]
    : [
        styles.mediaStageInline,
        { height: frameHeight, backgroundColor: canvasColor },
      ];

  return (
    <View style={stageStyle}>
      <View
        style={[
          styles.videoFrame,
          {
            width: frameWidth,
            height: frameHeight,
            backgroundColor: canvasColor,
          },
        ]}
      >
        {showVideo && player ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <VideoView
              style={StyleSheet.absoluteFill}
              player={player}
              contentFit={contentFit}
              nativeControls={false}
              allowsPictureInPicture={false}
              fullscreenOptions={{ enable: false }}
              useExoShutter={false}
              onFirstFrameRender={onFirstFrameRender}
            />
          </View>
        ) : null}

        {thumbnail ? (
          <Animated.View
            style={[StyleSheet.absoluteFill, posterAnimatedStyle]}
            pointerEvents="none"
          >
            <Image
              source={{ uri: thumbnail }}
              style={StyleSheet.absoluteFill}
              contentFit={contentFit}
              cachePolicy="disk"
              transition={0}
              onLoad={onPosterLoad}
            />
          </Animated.View>
        ) : (
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              styles.posterFallback,
              posterFallbackStyle,
              posterAnimatedStyle,
            ]}
            pointerEvents="none"
          />
        )}

        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mediaStageFill: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  mediaStageInline: {
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  videoFrame: {
    overflow: "hidden",
  },
  posterFallback: {
    backgroundColor: DEFAULT_CANVAS,
  },
});
