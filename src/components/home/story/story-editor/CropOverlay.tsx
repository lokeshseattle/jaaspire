import React from "react";
import { Dimensions, StyleSheet, View } from "react-native";

const { width } = Dimensions.get("window");
const CROP_SIZE = width;

export default function CropOverlay() {
  return (
    <View style={styles.container} pointerEvents="none">
      <View style={styles.top} />
      <View style={styles.middleRow}>
        <View style={styles.side} />
        <View style={styles.cropBox} />
        <View style={styles.side} />
      </View>
      <View style={styles.bottom} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  top: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  middleRow: {
    flexDirection: "row",
  },
  side: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  cropBox: {
    width: CROP_SIZE,
    height: CROP_SIZE,
    borderWidth: 2,
    borderColor: "white",
  },
  bottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
});
