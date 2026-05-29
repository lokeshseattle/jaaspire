import { VideoView } from "expo-video";
import { StyleSheet, View } from "react-native";

type PostVideoProps = {
  player: any;
  onFirstFrameRender?: () => void;
};

export function PostVideo({ player, onFirstFrameRender }: PostVideoProps) {
  if (!player) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <VideoView
        style={StyleSheet.absoluteFill}
        player={player}
        contentFit="contain"
        nativeControls={false}
        allowsPictureInPicture={false}
        fullscreenOptions={{ enable: false }}
        useExoShutter={false}
        onFirstFrameRender={onFirstFrameRender}
      />
    </View>
  );
}
