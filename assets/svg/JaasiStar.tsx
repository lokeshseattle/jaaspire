import { Image } from "expo-image";
import type { ImageStyle, StyleProp } from "react-native";

type JaasiStarProps = {
  width?: number;
  height?: number;
  style?: StyleProp<ImageStyle>;
};

export default function JaasiStar({
  width = 48,
  height = 48,
  style,
}: JaasiStarProps) {
  return (
    <Image
      source={require("../../assets/svg/svgviewer-output.svg")}
      style={[{ width, height }, style]}
      contentFit="contain"
    />
  );
}
