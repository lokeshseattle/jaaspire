import { useTheme } from "@/src/theme/ThemeProvider";
import { View } from "react-native";

interface SkeletonBlockProps {
  width?: number | string;
  height: number;
  borderRadius?: number;
  style?: any;
}

export const SkeletonBlock = ({
  width = "100%",
  height,
  borderRadius = 8,
  style,
}: SkeletonBlockProps) => {
  const { theme } = useTheme();

  return (
    <View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.border + "40",
        },
        style,
      ]}
    />
  );
};
