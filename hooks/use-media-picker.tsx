// src/hooks/useMediaPicker.ts

import { useActionSheet } from "@expo/react-native-action-sheet";
import * as ImagePicker from "expo-image-picker";
import { Alert, Platform } from "react-native";

const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; //2gb;
const MAX_VIDEO_DURATION = 2 * 60 * 60 * 1000; //2hours;
/**
 * Normalized file returned to the consumer
 * Safe for FormData, uploads, React Query, etc.
 */
export type MediaType = "images" | "videos";

export interface PickedFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
  width?: number;
  height?: number;
}

export interface UseMediaPickerOptions {
  /**
   * Allowed media types
   * Default: ["images"]
   */
  mediaTypes?: MediaType[];

  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
  circular?: boolean;

  onChange: (file: PickedFile) => void;
}

export const useMediaPicker = () => {
  const { showActionSheetWithOptions } = useActionSheet();

  const requestPermission = async (
    type: "camera" | "gallery",
  ): Promise<boolean> => {
    if (type === "camera") {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      return status === "granted";
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    return status === "granted";
  };

  const normalizeFile = (asset: ImagePicker.ImagePickerAsset): PickedFile => {
    const fileName = asset.fileName ?? asset.uri.split("/").pop() ?? "file";

    const fileType =
      asset.mimeType ?? `image/${fileName.split(".").pop() ?? "jpeg"}`;

    return {
      uri: asset.uri,
      name: fileName,
      type: fileType,
      size: asset.fileSize,
      width: asset.width > 0 ? asset.width : undefined,
      height: asset.height > 0 ? asset.height : undefined,
    };
  };

  const openMediaPicker = (options: UseMediaPickerOptions) => {
    const {
      mediaTypes,
      allowsEditing = true,
      aspect,
      quality = 0.8,
      circular = false,
      onChange,
    } = options;

    const allowedMediaTypes = mediaTypes ?? ["images"];
    const wantsBoth =
      allowedMediaTypes.includes("images") &&
      allowedMediaTypes.includes("videos");
    const isAndroidSplitCamera =
      Platform.OS === "android" && wantsBoth;

    const finalAspect = circular ? [1, 1] : aspect;
    /** Native square crop is skipped when circular — app uses profile-crop for pan/zoom. */
    const finalAllowsEditing = circular ? false : allowsEditing;

    const sheetOptions = isAndroidSplitCamera
      ? ["Take Photo", "Record Video", "Gallery", "Cancel"]
      : ["Camera", "Gallery", "Cancel"];
    const cancelButtonIndex = isAndroidSplitCamera ? 3 : 2;

    showActionSheetWithOptions(
      {
        options: sheetOptions,
        cancelButtonIndex,
      },
      async (selectedIndex?: number) => {
        if (selectedIndex === undefined || selectedIndex === cancelButtonIndex) {
          return;
        }

        let source: "camera" | "gallery";
        let pickerMediaTypes: MediaType[];

        if (isAndroidSplitCamera) {
          if (selectedIndex === 0) {
            source = "camera";
            pickerMediaTypes = ["images"];
          } else if (selectedIndex === 1) {
            source = "camera";
            pickerMediaTypes = ["videos"];
          } else {
            source = "gallery";
            pickerMediaTypes = allowedMediaTypes;
          }
        } else {
          source = selectedIndex === 0 ? "camera" : "gallery";
          pickerMediaTypes = allowedMediaTypes;
        }

        const hasPermission = await requestPermission(source);
        if (!hasPermission) return;

        const pickerFn =
          source === "camera"
            ? ImagePicker.launchCameraAsync
            : ImagePicker.launchImageLibraryAsync;

        const result = await pickerFn({
          mediaTypes: pickerMediaTypes,
          allowsEditing: finalAllowsEditing,
          aspect:
            Array.isArray(finalAspect) && finalAspect.length === 2
              ? ([finalAspect[0], finalAspect[1]] as [number, number])
              : undefined,
          quality,
        });

        if (
          result?.assets?.[0]?.duration &&
          result.assets[0].duration > MAX_VIDEO_DURATION
        ) {
          Alert.alert("Error", "Video duration is too long", [
            { text: "OK", style: "destructive" },
          ]);
          return;
        }

        if (result.canceled) return;

        const file = normalizeFile(result.assets[0]);

        if (file.size && file.size > MAX_FILE_SIZE) {
          Alert.alert("Error", "File size is too large", [
            { text: "OK", style: "destructive" },
          ]);
          return;
        }

        onChange(file);
      },
    );
  };

  return { openMediaPicker };
};
