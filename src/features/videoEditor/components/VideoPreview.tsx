// src/features/videoEditor/components/VideoPreview.tsx

import { useEditorPreviewLayout } from "@/src/hooks/use-vertical-video-layout";
import { useVideoTrackSize } from "@/src/hooks/use-video-track-size";
import { Image } from "expo-image";
import { VideoPlayer, VideoView } from "expo-video";
import * as VideoThumbnails from "expo-video-thumbnails";
import React, { useEffect, useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { COLORS } from "../constants";

/** Cinematic letterbox backdrop — shared by thumbnail + story trim screens. */
const BACKDROP_BLUR_RADIUS = 48;
const BACKDROP_SCRIM_OPACITY = 0.45;

interface VideoPreviewProps {
  player: VideoPlayer;
  videoUri?: string;
  fallbackDimensions?: { width?: number; height?: number };
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({
  player,
  videoUri,
  fallbackDimensions,
}) => {
  const [stageBounds, setStageBounds] = useState({ width: 0, height: 0 });
  const [playerReady, setPlayerReady] = useState(false);
  const [backdropUri, setBackdropUri] = useState<string | null>(null);

  useEffect(() => {
    const syncReady = () => {
      try {
        setPlayerReady(player.status === "readyToPlay");
      } catch {
        setPlayerReady(false);
      }
    };
    syncReady();
    const sub = player.addListener("statusChange", syncReady);
    return () => sub.remove();
  }, [player]);

  useEffect(() => {
    if (!videoUri) {
      setBackdropUri(null);
      return;
    }

    let cancelled = false;

    VideoThumbnails.getThumbnailAsync(videoUri, { time: 0, quality: 0.3 })
      .then((result) => {
        if (!cancelled && result?.uri) {
          setBackdropUri(result.uri);
        }
      })
      .catch(() => {
        /* solid black fallback */
      });

    return () => {
      cancelled = true;
    };
  }, [videoUri]);

  const fallbackSize = useMemo(() => {
    const w = fallbackDimensions?.width;
    const h = fallbackDimensions?.height;
    if (w && w > 0 && h && h > 0) {
      return { width: w, height: h };
    }
    return null;
  }, [fallbackDimensions?.width, fallbackDimensions?.height]);

  const trackSize = useVideoTrackSize(player, playerReady, { fallbackSize });
  const layout = useEditorPreviewLayout(
    stageBounds.width,
    stageBounds.height,
    trackSize?.width,
    trackSize?.height,
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setStageBounds({ width, height });
  };

  const hasStage = stageBounds.width > 0 && stageBounds.height > 0;
  const showBackdrop = hasStage && layout.useBackdrop && !!backdropUri;

  return (
    <View style={styles.container} onLayout={handleLayout}>
      {showBackdrop && (
        <>
          <Image
            source={{ uri: backdropUri! }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            blurRadius={BACKDROP_BLUR_RADIUS}
          />
          <View
            style={[
              styles.scrim,
              { backgroundColor: `rgba(0,0,0,${BACKDROP_SCRIM_OPACITY})` },
            ]}
          />
        </>
      )}

      {hasStage &&
        (layout.isOptimistic ? (
          <VideoView
            player={player}
            style={styles.fullStage}
            contentFit="cover"
            nativeControls={false}
          />
        ) : (
          <View
            style={[
              styles.mediaFrame,
              {
                width: layout.frameWidth,
                height: layout.frameHeight,
              },
            ]}
          >
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              nativeControls={false}
            />
          </View>
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: "100%",
    backgroundColor: COLORS.previewBackground,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  fullStage: {
    ...StyleSheet.absoluteFillObject,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  mediaFrame: {
    overflow: "hidden",
  },
});
