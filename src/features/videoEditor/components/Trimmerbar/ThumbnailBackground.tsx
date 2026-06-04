import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { ThumbnailFrame } from "../../types";

interface ThumbnailBackgroundProps {
  thumbnails: (ThumbnailFrame | undefined)[];
  placeholderCount?: number;
  isLoading?: boolean;
}

export const ThumbnailBackground: React.FC<ThumbnailBackgroundProps> = ({
  thumbnails,
  placeholderCount = 10,
  isLoading = false,
}) => {
  const cellCount =
    thumbnails.length > 0 ? thumbnails.length : placeholderCount;

  return (
    <View style={styles.container}>
      {Array.from({ length: cellCount }).map((_, index) => {
        const thumb = thumbnails[index];
        return (
          <View key={index} style={styles.cell}>
            {thumb?.uri ? (
              <Image
                source={{ uri: thumb.uri }}
                style={styles.thumbnail}
                resizeMode="cover"
              />
            ) : (
              <View
                style={[
                  styles.placeholder,
                  isLoading && styles.placeholderLoading,
                ]}
              />
            )}
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
  },
  cell: {
    flex: 1,
    height: "100%",
    overflow: "hidden",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  placeholder: {
    flex: 1,
    backgroundColor: "#374151",
  },
  placeholderLoading: {
    opacity: 0.7,
  },
});
