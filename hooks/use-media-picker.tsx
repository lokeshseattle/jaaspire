// src/hooks/useMediaPicker.ts

import { useActionSheet } from "@expo/react-native-action-sheet";
import * as ImagePicker from "expo-image-picker";

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

    const finalAspect = circular ? [1, 1] : aspect;
    const finalAllowsEditing = circular ? true : allowsEditing;

    showActionSheetWithOptions(
      {
        options: ["Camera", "Gallery", "Cancel"],
        cancelButtonIndex: 2,
      },
      async (selectedIndex?: number) => {
        if (selectedIndex === undefined || selectedIndex === 2) return;

        const type = selectedIndex === 0 ? "camera" : "gallery";

        const hasPermission = await requestPermission(type);
        if (!hasPermission) return;

        const pickerFn =
          type === "camera"
            ? ImagePicker.launchCameraAsync
            : ImagePicker.launchImageLibraryAsync;

        const result = await pickerFn({
          mediaTypes,
          allowsEditing: finalAllowsEditing,
          aspect:
            Array.isArray(finalAspect) && finalAspect.length === 2
              ? ([finalAspect[0], finalAspect[1]] as [number, number])
              : undefined,
          quality,
        });

        if (result.canceled) return;

        const file = normalizeFile(result.assets[0]);
        onChange(file);
      },
    );
  };

  return { openMediaPicker };
};
