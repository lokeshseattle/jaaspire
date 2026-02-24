import React from "react";
import { Image, StyleSheet, View } from "react-native";

interface Props {
  uri: string;
}

const StoryMedia = ({ uri }: Props) => {
  return (
    <View style={styles.container}>
      <Image
        source={{ uri }}
        style={styles.image}
        resizeMode="contain"
      />
    </View>
  );
};

export default StoryMedia;

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "black",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});
