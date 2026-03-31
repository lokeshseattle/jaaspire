import { ThemedText as Text } from "@/src/components/themed-text";
import { useToast } from "@/src/components/toast/ToastProvider";
import { useUpdateAvatar } from "@/src/features/profile/profile.hooks";
import { AppTheme, appThemes } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import * as ImageManipulator from "expo-image-manipulator";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const AVATAR_OUTPUT = 1024;
const MAX_ZOOM = 5;

/** Single dark canvas for crop UI (matches `appThemes.dark.colors.background`). */
const CROP_CANVAS = appThemes.dark.colors.background;

/** 6-digit hex → rgba for overlays. */
function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

const TEXT_ON_DARK = "rgba(255,255,255,0.94)";
const TEXT_ON_DARK_MUTED = "rgba(255,255,255,0.72)";

function parseUriParam(raw: string | string[] | undefined): string {
  if (raw == null) return "";
  const s = Array.isArray(raw) ? raw[0] : raw;
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

export default function ProfileCropScreen() {
  const { uri: uriParam } = useLocalSearchParams<{ uri?: string | string[] }>();
  const uri = parseUriParam(uriParam);
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { width: W, height: H } = useWindowDimensions();
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  const cropOverlayScrim = useMemo(
    () => hexToRgba(CROP_CANVAS, 0.62),
    [],
  );
  /** Light label on primary button. */
  const onPrimaryLabel = appThemes.light.colors.background;

  const updateAvatar = useUpdateAvatar();

  const [naturalSize, setNaturalSize] = useState({ w: 0, h: 0 });
  const [loadingSize, setLoadingSize] = useState(true);

  const CIRCLE_SIZE = Math.min(W, H) * 0.78;
  const R = CIRCLE_SIZE / 2;

  const { displayW, displayH } = useMemo(() => {
    const iw = naturalSize.w;
    const ih = naturalSize.h;
    if (!iw || !ih) {
      return { displayW: 0, displayH: 0 };
    }
    const s = Math.min(W / iw, H / ih);
    return {
      displayW: iw * s,
      displayH: ih * s,
    };
  }, [naturalSize.w, naturalSize.h, W, H]);

  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const pinchStartScale = useSharedValue(1);

  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const panStartX = useSharedValue(0);
  const panStartY = useSharedValue(0);

  const minScale = useSharedValue(1);

  useEffect(() => {
    if (!uri) return;
    setLoadingSize(true);
    Image.getSize(
      uri,
      (w, h) => {
        setNaturalSize({ w, h });
        setLoadingSize(false);
      },
      () => {
        setLoadingSize(false);
        toast.trigger("Could not read this image", "error");
      },
    );
  }, [uri, toast]);

  useEffect(() => {
    if (!displayW || !displayH || !CIRCLE_SIZE) return;
    const ms = CIRCLE_SIZE / Math.min(displayW, displayH);
    minScale.value = ms;
    scale.value = ms;
    savedScale.value = ms;
    translateX.value = 0;
    translateY.value = 0;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, [
    displayW,
    displayH,
    CIRCLE_SIZE,
    minScale,
    scale,
    savedScale,
    translateX,
    translateY,
    savedTranslateX,
    savedTranslateY,
  ]);

  const pinch = Gesture.Pinch()
    .onStart(() => {
      pinchStartScale.value = savedScale.value;
    })
    .onUpdate((e) => {
      const next = pinchStartScale.value * e.scale;
      const lo = minScale.value;
      const hi = MAX_ZOOM;
      scale.value = Math.min(hi, Math.max(lo, next));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
    });

  const pan = Gesture.Pan()
    .onStart(() => {
      panStartX.value = savedTranslateX.value;
      panStartY.value = savedTranslateY.value;
    })
    .onUpdate((e) => {
      translateX.value = panStartX.value + e.translationX;
      translateY.value = panStartY.value + e.translationY;
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const composed = Gesture.Simultaneous(pinch, pan);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  const handleConfirm = useCallback(async () => {
    if (!uri || !naturalSize.w || !displayW || !displayH) return;

    const s = scale.value;
    const tx = translateX.value;
    const ty = translateY.value;
    const iw = naturalSize.w;
    const ih = naturalSize.h;

    const u = displayW / 2 - tx / s;
    const v = displayH / 2 - ty / s;

    const cropSizePx = (CIRCLE_SIZE * iw) / (s * displayW);
    const cx = (u / displayW) * iw;
    const cy = (v / displayH) * ih;

    let originX = Math.round(cx - cropSizePx / 2);
    let originY = Math.round(cy - cropSizePx / 2);
    let side = Math.round(cropSizePx);

    originX = Math.max(0, Math.min(originX, iw - 1));
    originY = Math.max(0, Math.min(originY, ih - 1));
    side = Math.max(
      1,
      Math.min(side, Math.round(Math.min(iw - originX, ih - originY))),
    );

    try {
      const saved = await ImageManipulator.manipulateAsync(
        uri,
        [
          {
            crop: {
              originX,
              originY,
              width: side,
              height: side,
            },
          },
          { resize: { width: AVATAR_OUTPUT, height: AVATAR_OUTPUT } },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );

      const fileName = saved.uri.split("/").pop() ?? `avatar_${Date.now()}.jpg`;

      await updateAvatar.mutateAsync({
        uri: saved.uri,
        name: fileName,
        type: "image/jpeg",
      });

      toast.trigger("Profile photo updated", "success");
      router.back();
    } catch {
      toast.trigger("Could not update profile photo", "error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reanimated shared values read at confirm tap
  }, [
    uri,
    naturalSize.w,
    naturalSize.h,
    displayW,
    displayH,
    CIRCLE_SIZE,
    updateAvatar,
    toast,
    router,
  ]);

  if (!uri) {
    return (
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top,
            backgroundColor: theme.colors.background,
            paddingHorizontal: theme.spacing.lg,
          },
        ]}
      >
        <Text style={{ color: theme.colors.textSecondary }}>No image</Text>
        <Pressable onPress={() => router.back()} style={styles.textButton}>
          <Text type="link">Go back</Text>
        </Pressable>
      </View>
    );
  }

  const topFadeHeight = insets.top + 88;
  const bottomFadeHeight = insets.bottom + 140;

  return (
    <View style={[styles.screen, { backgroundColor: CROP_CANVAS }]}>
      <View style={styles.fullStage}>
        {loadingSize || !displayW ? (
          <ActivityIndicator color={TEXT_ON_DARK_MUTED} />
        ) : (
          <>
            <GestureDetector gesture={composed}>
              <Animated.View
                style={[
                  {
                    position: "absolute",
                    left: (W - displayW) / 2,
                    top: (H - displayH) / 2,
                    width: displayW,
                    height: displayH,
                  },
                  animatedStyle,
                ]}
              >
                <Image
                  source={{ uri }}
                  style={{ width: displayW, height: displayH }}
                  resizeMode="contain"
                />
              </Animated.View>
            </GestureDetector>

            <View style={styles.overlay} pointerEvents="none">
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: W,
                  height: H / 2 - R,
                  backgroundColor: cropOverlayScrim,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: H / 2 + R,
                  width: W,
                  height: H / 2 - R,
                  backgroundColor: cropOverlayScrim,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: 0,
                  top: H / 2 - R,
                  width: W / 2 - R,
                  height: CIRCLE_SIZE,
                  backgroundColor: cropOverlayScrim,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: W / 2 + R,
                  top: H / 2 - R,
                  width: W / 2 - R,
                  height: CIRCLE_SIZE,
                  backgroundColor: cropOverlayScrim,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  left: W / 2 - R,
                  top: H / 2 - R,
                  width: CIRCLE_SIZE,
                  height: CIRCLE_SIZE,
                  borderRadius: R,
                  borderWidth: 2,
                  borderColor: "rgba(255,255,255,0.88)",
                }}
              />
            </View>
          </>
        )}
      </View>

      <LinearGradient
        pointerEvents="none"
        colors={[hexToRgba(CROP_CANVAS, 0.82), "transparent"]}
        style={[styles.edgeFade, { height: topFadeHeight }]}
      />
      <LinearGradient
        pointerEvents="none"
        colors={["transparent", hexToRgba(CROP_CANVAS, 0.88)]}
        style={[styles.edgeFadeBottom, { height: bottomFadeHeight }]}
      />

      <View
        pointerEvents="box-none"
        style={[
          styles.header,
          {
            paddingTop: insets.top + theme.spacing.sm,
            paddingHorizontal: theme.spacing.lg,
          },
        ]}
      >
        <Pressable onPress={() => router.back()} hitSlop={12}>
          <Text
            style={{
              color: TEXT_ON_DARK_MUTED,
              fontSize: 16,
              fontFamily: theme.typography.fontFamily?.sans,
            }}
          >
            Cancel
          </Text>
        </Pressable>
        <Text
          style={{
            color: TEXT_ON_DARK,
            fontWeight: "600",
            fontSize: 17,
            fontFamily: theme.typography.fontFamily?.sans,
          }}
        >
          Move and scale
        </Text>
        <View style={{ width: 56 }} />
      </View>

      <View
        pointerEvents="box-none"
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + theme.spacing.lg,
            paddingHorizontal: theme.spacing.xl,
          },
        ]}
      >
        <Pressable
          style={[
            styles.confirm,
            {
              backgroundColor: theme.colors.primary,
              borderRadius: theme.radius.md,
              opacity: updateAvatar.isPending || loadingSize ? 0.6 : 1,
            },
          ]}
          disabled={updateAvatar.isPending || loadingSize || !displayW}
          onPress={handleConfirm}
        >
          {updateAvatar.isPending ? (
            <ActivityIndicator color={onPrimaryLabel} />
          ) : (
            <Text
              style={{
                color: onPrimaryLabel,
                fontWeight: "600",
                fontSize: 16,
                fontFamily: theme.typography.fontFamily?.sans,
              }}
            >
              Save photo
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    screen: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    fullStage: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: "center",
      alignItems: "center",
    },
    header: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 11,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    edgeFade: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      zIndex: 9,
    },
    edgeFadeBottom: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 9,
    },
    overlay: {
      ...StyleSheet.absoluteFillObject,
    },
    footer: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 11,
    },
    confirm: {
      paddingVertical: theme.spacing.md + 2,
      alignItems: "center",
      justifyContent: "center",
    },
    textButton: {
      marginTop: theme.spacing.lg,
    },
  });
