import { ActionSheetProvider } from "@expo/react-native-action-sheet";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFocusEffect } from "@react-navigation/native";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  Modal,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import {
  EnrichedTextInput,
  EnrichedTextInputInstance,
  OnChangeHtmlEvent,
  OnChangeMentionEvent,
  OnChangeStateEvent,
  OnChangeTextEvent,
} from "react-native-enriched";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";

import { PickedFile, useMediaPicker } from "@/hooks/use-media-picker";
import MentionSuggestionsList from "@/src/components/mentions/MentionSuggestionsList";
import { useToast } from "@/src/components/toast/ToastProvider";
import { useImageEditStore } from "@/src/features/post-editor/store/useImageEditorStore";
import { useVideoPostDraftStore } from "@/src/features/post-editor/store/useVideoPostDraftStore";
import { useGetProfile } from "@/src/features/profile/profile.hooks";
import {
  useUploadAndCreatePost,
  useUploadImageAndCreatePost,
} from "@/src/features/upload/upload.hooks";
import { queryClient } from "@/src/lib/query-client";
import { MentionUser } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { debounce } from "@/src/utils/helpers";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

type PostType = "regular" | "paid" | "subscription";

/** Returns only the content inside the outer <html> tag, or the string as-is if no wrapper. */
function getCaptionForPost(htmlOrCaption: string): string {
  const trimmed = (htmlOrCaption ?? "").trim();
  const match = trimmed.match(/^<html[^>]*>([\s\S]*?)<\/html>$/i);
  return match ? match[1].trim() : trimmed;
}

export default function CreateScreen() {
  return (
    <ActionSheetProvider>
      <CreateContent />
    </ActionSheetProvider>
  );
}

function CreateContent() {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { openMediaPicker } = useMediaPicker();
  const { data: me } = useGetProfile();
  const username = me?.data?.username;
  // const router = useRouter();
  const headerHeight = useHeaderHeight();
  const {
    editedImage,
    setOriginalImage,
    originalImage,
    reset,
    setEditedImage,
  } = useImageEditStore();
  const {
    video: selectedVideo,
    thumbnail: selectedVideoThumbnail,
    setVideo,
    setThumbnail,
    reset: resetVideoDraft,
  } = useVideoPostDraftStore();
  const uploadAndCreatePost = useUploadAndCreatePost();
  const uploadImageAndCreatePost = useUploadImageAndCreatePost();

  const [postType, setPostType] = useState<PostType>("regular");
  const [caption, setCaption] = useState("");
  const [html, setHtml] = useState("");
  const [price, setPrice] = useState("");
  const [selectedImage, setSelectedImage] = useState<PickedFile | null>(null);
  const [stylesState, setStylesState] = useState<OnChangeStateEvent | null>(
    null,
  );
  const [isFocused, setIsFocused] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [captionInputKey, setCaptionInputKey] = useState(0);
  const inputRef = useRef<EnrichedTextInputInstance>(null);
  /** After closing the mention modal, native focus + active @ session re-fire mention events; ignore briefly. */
  const mentionModalSuppressRef = useRef(false);
  const mentionSuppressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const initialValue = useRef(caption).current;
  const [mentionIndicator, setMentionIndicator] = useState<string | null>(null);
  const [mentionQuery, setMentionQuery] = useState("");
  const [debouncedMentionQuery, setDebouncedMentionQuery] = useState("");
  const { trigger } = useToast();
  const debouncedSetMentionQuery = useMemo(
    () => debounce((q: string) => setDebouncedMentionQuery(q), 200),
    [],
  );

  useEffect(() => {
    if (mentionIndicator === "@") {
      debouncedSetMentionQuery(mentionQuery);
    }
  }, [mentionQuery, mentionIndicator, debouncedSetMentionQuery]);

  useEffect(() => {
    return () => {
      if (mentionSuppressTimerRef.current) {
        clearTimeout(mentionSuppressTimerRef.current);
      }
    };
  }, []);

  const resetMentionSession = useCallback(() => {
    setMentionIndicator(null);
    setMentionQuery("");
    setDebouncedMentionQuery("");
  }, []);

  const handleStartMention = useCallback((indicator: string) => {
    if (indicator === "@" && mentionModalSuppressRef.current) {
      return;
    }
    if (indicator === "@") {
      setMentionIndicator("@");
      setMentionQuery("");
      setDebouncedMentionQuery("");
    } else {
      setMentionIndicator(null);
      setMentionQuery("");
      setDebouncedMentionQuery("");
    }
  }, []);

  const handleChangeMention = useCallback((e: OnChangeMentionEvent) => {
    const { indicator, text } = e;
    if (indicator === "@" && mentionModalSuppressRef.current) {
      return;
    }
    if (indicator === "@") {
      setMentionIndicator("@");
      setMentionQuery(text);
    }
  }, []);

  const handleSelectMention = useCallback(
    (user: MentionUser) => {
      inputRef.current?.setMention("@", user.username, {
        user_id: String(user.id),
      });
      resetMentionSession();
    },
    [resetMentionSession],
  );

  const handleDismissMentionPicker = useCallback(() => {
    if (mentionSuppressTimerRef.current) {
      clearTimeout(mentionSuppressTimerRef.current);
    }
    mentionModalSuppressRef.current = true;
    resetMentionSession();
    Keyboard.dismiss();
    mentionSuppressTimerRef.current = setTimeout(() => {
      mentionModalSuppressRef.current = false;
      mentionSuppressTimerRef.current = null;
    }, 450);
  }, [resetMentionSession]);

  // Use editedImage if available, otherwise use selectedImage or originalImage
  const displayImage = editedImage || selectedImage || originalImage;

  // Listen for when user returns from editor
  useFocusEffect(
    useCallback(() => {
      // This runs when screen comes into focus
      // If we have an edited image from the store, use it
      if (editedImage) {
        setSelectedImage(editedImage);
        // Reset the edited image in the store after using it
        setEditedImage(null);
      }
      return () => {
        // Cleanup if needed
      };
    }, [editedImage, setEditedImage]),
  );

  const handlePickMedia = () => {
    openMediaPicker({
      mediaTypes: ["images", "videos"],
      allowsEditing: false,
      onChange: (file) => {
        const isVideo =
          typeof file.type === "string" && file.type.startsWith("video/");

        if (isVideo) {
          // Start video draft flow (thumbnail required)
          setVideo(file as any);
          setThumbnail(null);
          setSelectedImage(null);
          router.push({ pathname: "/post-video-thumbnail" });
          return;
        }

        // Image flow -> image editor
        resetVideoDraft();
        setOriginalImage(file);
        router.push({ pathname: "/post-image-editor" });
      },
    });
  };

  const isPriceValid = (val: string) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 1 && num <= 200;
  };

  const handleChangeText = (e: NativeSyntheticEvent<OnChangeTextEvent>) => {
    setCaption(e.nativeEvent.value);
  };

  const handleChangeHtml = (e: NativeSyntheticEvent<OnChangeHtmlEvent>) => {
    setHtml(e.nativeEvent.value);
  };

  const canPost =
    (!!selectedImage || (!!selectedVideo && !!selectedVideoThumbnail)) &&
    (postType !== "paid" || isPriceValid(price));

  const computedIsExclusive = postType === "subscription";
  const computedPrice =
    postType === "paid" ? Math.max(0, Number.parseFloat(price || "0")) : 0;

  const handlePostPress = useCallback(async () => {
    try {
      if (selectedVideo && selectedVideoThumbnail) {
        setUploadProgress(0);
        try {
          await uploadAndCreatePost.mutateAsync(
            {
              fileUri: selectedVideo.uri,
              fileName: selectedVideo.name,
              text: getCaptionForPost(html || caption),
              price: computedPrice,
              is_exclusive: computedIsExclusive,
              previewDuration: 6,
              selectedThumbnailFile: {
                uri: selectedVideoThumbnail.uri,
                name: selectedVideoThumbnail.name,
                type: selectedVideoThumbnail.type,
              },
              onProgress: (p) => setUploadProgress(p),
            },
            {
              onSuccess: () => {
                setUploadProgress(null);
                setCaption("");
                setHtml("");
                setCaptionInputKey((k) => k + 1);
                resetMentionSession();
                resetVideoDraft();
                trigger("Post created successfully", "success");
                router.push({ pathname: "/(app)/(tabs)/profile" });
                queryClient.invalidateQueries({
                  queryKey: ["user_feed", username],
                });
              },
            },
          );
        } catch {
          setUploadProgress(null);
          throw undefined;
        }
        return;
      }

      if (selectedImage) {
        setUploadProgress(0);
        try {
          await uploadImageAndCreatePost.mutateAsync(
            {
              fileUri: selectedImage.uri,
              fileName: selectedImage.name,
              fileType: selectedImage.type,
              text: getCaptionForPost(html || caption),
              price: computedPrice,
              is_exclusive: computedIsExclusive,
            },
            {
              onSuccess: () => {
                setUploadProgress(null);
                setCaption("");
                setHtml("");
                setCaptionInputKey((k) => k + 1);
                resetMentionSession();
                setSelectedImage(null);
                reset();
                router.push({ pathname: "/(app)/(tabs)/profile" });

                trigger("Post created successfully", "success");
                queryClient.invalidateQueries({
                  queryKey: ["user_feed", username],
                });
              },
            },
          );
        } catch {
          setUploadProgress(null);
          throw undefined;
        }
        return;
      }
    } catch (e) {
      console.error("Post failed:", e);
    }
  }, [
    selectedVideo,
    selectedVideoThumbnail,
    selectedImage,
    caption,
    html,
    computedPrice,
    computedIsExclusive,
    uploadAndCreatePost,
    uploadImageAndCreatePost,
    resetVideoDraft,
    reset,
    resetMentionSession,
  ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>New Post</Text>
        <Pressable
          disabled={
            !canPost ||
            uploadAndCreatePost.isPending ||
            uploadImageAndCreatePost.isPending
          }
          onPress={handlePostPress}
          style={({ pressed }) => [
            styles.postButton,
            !canPost && styles.disabledButton,
            pressed && styles.pressed,
          ]}
        >
          {uploadAndCreatePost.isPending ||
          uploadImageAndCreatePost.isPending ? (
            <ActivityIndicator size="small" color={"#FFFFFF"} />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </Pressable>
      </View>

      {(uploadAndCreatePost.isPending ||
        uploadImageAndCreatePost.isPending) && (
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBarFill,
              {
                width: `${Math.min(100, (uploadProgress ?? 0) * 100)}%`,
              },
            ]}
          />
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Enriched Caption Input */}
          <View style={styles.section}>
            <View style={styles.captionBoxWrapper}>
              <View style={styles.toolbar}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.toolbarContent}
                >
                  <ToolbarButton
                    type="material"
                    icon="format-bold"
                    active={stylesState?.bold.isActive}
                    onPress={() => inputRef.current?.toggleBold()}
                  />
                  <ToolbarButton
                    type="material"
                    icon="format-italic"
                    active={stylesState?.italic.isActive}
                    onPress={() => inputRef.current?.toggleItalic()}
                  />
                  <ToolbarButton
                    type="material"
                    icon="at"
                    onPress={() => inputRef.current?.startMention("@")}
                  />
                  <ToolbarButton
                    type="material"
                    icon="pound"
                    onPress={() => inputRef.current?.startMention("#")}
                  />
                </ScrollView>
              </View>
              <View style={styles.editorContainer}>
                <EnrichedTextInput
                  key={captionInputKey}
                  ref={inputRef}
                  defaultValue={initialValue}
                  onChangeText={handleChangeText}
                  onChangeHtml={handleChangeHtml}
                  onChangeState={(e) => setStylesState(e.nativeEvent)}
                  onStartMention={handleStartMention}
                  onChangeMention={handleChangeMention}
                  onEndMention={resetMentionSession}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="Write a caption..."
                  placeholderTextColor={theme.colors.textSecondary}
                  style={styles.captionInput}
                  mentionIndicators={["@", "#"]}
                  htmlStyle={{
                    a: { color: theme.colors.primary },
                    mention: {
                      "@": { color: theme.colors.primary },
                      "#": { color: theme.colors.primary },
                    },
                  }}
                  contextMenuItems={[
                    {
                      text: "Bold",
                      onPress: () => inputRef.current?.toggleBold(),
                    },
                    {
                      text: "Italic",
                      onPress: () => inputRef.current?.toggleItalic(),
                    },
                    // {
                    //   text: "Link",
                    //   onPress: ({ selection, text }) => {
                    //     console.log("Link requested for:", text);
                    //   },
                    // },
                  ]}
                />
              </View>
            </View>
            <Text style={styles.hint}>
              Supports @mentions, #hashtags, and links
            </Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Post Type</Text>
            <View style={styles.typeSelector}>
              {(["regular", "paid", "subscription"] as PostType[]).map(
                (type) => (
                  <Pressable
                    key={type}
                    onPress={() => setPostType(type)}
                    style={[
                      styles.typeOption,
                      postType === type && styles.typeOptionSelected,
                    ]}
                  >
                    <Text
                      style={[
                        styles.typeText,
                        postType === type && styles.typeTextSelected,
                      ]}
                    >
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </Text>
                  </Pressable>
                ),
              )}
            </View>
          </View>

          {postType === "paid" && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Price (USD)</Text>
              <View style={styles.inputWrapper}>
                <Text style={styles.currencyPrefix}>$</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0.00"
                  placeholderTextColor={theme.colors.textSecondary}
                  keyboardType="decimal-pad"
                  value={price}
                  onChangeText={setPrice}
                />
              </View>
              <Text style={styles.hint}>Set a price between $1 and $200</Text>
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Media</Text>
            {selectedImage || selectedVideo ? (
              <View style={styles.imagePreviewContainer}>
                <Image
                  source={{
                    uri: selectedImage
                      ? displayImage?.uri
                      : selectedVideoThumbnail?.uri,
                  }}
                  style={styles.imagePreview}
                  resizeMode="contain"
                />
                <Pressable
                  style={styles.removeImageButton}
                  onPress={() => {
                    setSelectedImage(null);
                    reset();
                    resetVideoDraft();
                  }}
                >
                  <Ionicons name="close-circle" size={24} color="#FF3B30" />
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={({ pressed }) => [
                  styles.uploadPlaceholder,
                  pressed && styles.pressed,
                ]}
                onPress={handlePickMedia}
              >
                <Ionicons
                  name="images-outline"
                  size={32}
                  color={theme.colors.textSecondary}
                />
                <Text style={styles.uploadText}>Select Image or Video</Text>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={mentionIndicator === "@"}
        animationType="slide"
        presentationStyle={Platform.OS === "ios" ? "fullScreen" : undefined}
        onRequestClose={handleDismissMentionPicker}
      >
        <SafeAreaView
          style={[
            styles.mentionModalRoot,
            { backgroundColor: theme.colors.background },
          ]}
          edges={["top", "left", "right"]}
        >
          <KeyboardAvoidingView
            style={styles.mentionModalKeyboard}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <View style={styles.mentionModalHeader}>
              <View style={styles.mentionModalHeaderRow}>
                <View style={styles.mentionModalHeaderLeft}>
                  <Pressable
                    onPress={handleDismissMentionPicker}
                    hitSlop={12}
                    accessibilityRole="button"
                    accessibilityLabel="Cancel mention picker"
                    style={styles.mentionModalCancelHit}
                  >
                    <Text
                      style={[
                        styles.mentionModalCancelLabel,
                        { color: theme.colors.primary },
                      ]}
                    >
                      Cancel
                    </Text>
                  </Pressable>
                </View>
                <Text style={styles.mentionModalTitle} pointerEvents="none">
                  Mention
                </Text>
                <View style={styles.mentionModalHeaderRightSpacer} />
              </View>
            </View>
            <TextInput
              value={mentionQuery}
              onChangeText={setMentionQuery}
              placeholder="Search users"
              placeholderTextColor={theme.colors.textSecondary}
              style={[
                styles.mentionModalSearch,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: theme.colors.border,
                  color: theme.colors.textPrimary,
                },
              ]}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="default"
              returnKeyType="search"
              {...Platform.select({
                ios: { clearButtonMode: "while-editing" as const },
                default: {},
              })}
            />
            <MentionSuggestionsList
              query={debouncedMentionQuery}
              onSelect={handleSelectMention}
              variant="fullScreen"
              showQueryHeader={false}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function ToolbarButton({
  icon,
  active,
  onPress,
  label,
  type = "material",
}: {
  icon: any;
  active?: boolean;
  onPress: () => void;
  label?: string;
  type?: "ionicons" | "material";
}) {
  const { theme } = useTheme();
  const styles = createStyles(theme);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.toolbarButton, active && styles.toolbarButtonActive]}
    >
      {label ? (
        <Text
          style={[
            styles.toolbarButtonLabel,
            active && styles.toolbarButtonLabelActive,
          ]}
        >
          {label}
        </Text>
      ) : type === "material" ? (
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={active ? "#FFFFFF" : theme.colors.textPrimary}
        />
      ) : (
        <Ionicons
          name={icon}
          size={20}
          color={active ? "#FFFFFF" : theme.colors.textPrimary}
        />
      )}
    </Pressable>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    keyboardAvoid: {
      flex: 1,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    progressBarContainer: {
      height: 4,
      backgroundColor: theme.colors.border,
      width: "100%",
      overflow: "hidden",
    },
    progressBarFill: {
      height: "100%",
      backgroundColor: theme.colors.primary,
    },
    postButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
      borderRadius: theme.radius.pill,
    },
    postButtonText: {
      color: "#FFFFFF",
      fontWeight: "600",
      fontSize: 16,
    },
    disabledButton: {
      opacity: 0.5,
    },
    pressed: {
      opacity: 0.7,
    },
    scrollContent: {
      padding: theme.spacing.lg,
      paddingBottom: 70,
    },
    section: {
      marginBottom: theme.spacing.xl,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.sm,
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    captionBoxWrapper: {
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      overflow: "hidden",
    },
    editorContainer: {
      backgroundColor: theme.colors.card,
      padding: theme.spacing.md,
    },
    captionInput: {
      fontSize: 18,
      color: theme.colors.textPrimary,
      minHeight: 120,
      textAlignVertical: "top",
    },
    hint: {
      fontSize: 12,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
      marginLeft: theme.spacing.xs,
    },
    typeSelector: {
      flexDirection: "row",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      padding: 4,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    typeOption: {
      flex: 1,
      paddingVertical: theme.spacing.sm,
      alignItems: "center",
      borderRadius: theme.radius.sm,
    },
    typeOptionSelected: {
      backgroundColor: theme.colors.primary,
    },
    typeText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.textSecondary,
    },
    typeTextSelected: {
      color: "#FFFFFF",
      fontWeight: "600",
    },
    inputWrapper: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: theme.spacing.md,
      height: 56,
    },
    currencyPrefix: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      marginRight: theme.spacing.xs,
    },
    input: {
      flex: 1,
      fontSize: 18,
      color: theme.colors.textPrimary,
      fontWeight: "600",
    },
    uploadPlaceholder: {
      height: 200,
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderStyle: "dashed",
      justifyContent: "center",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    uploadText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      fontWeight: "500",
    },
    imagePreviewContainer: {
      position: "relative",
      borderRadius: theme.radius.md,
      overflow: "hidden",
      width: "100%",
    },
    imagePreview: {
      width: "100%",
      minHeight: 200,
      maxHeight: 500,
      aspectRatio: undefined,
    },
    removeImageButton: {
      position: "absolute",
      top: theme.spacing.sm,
      right: theme.spacing.sm,
      backgroundColor: "rgba(255, 255, 255, 0.9)",
      borderRadius: 999,
    },
    // Toolbar as sticky header of caption box (no spacing)
    toolbar: {
      height: 50,
      backgroundColor: theme.colors.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
      paddingHorizontal: theme.spacing.sm,
    },
    toolbarContent: {
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingRight: theme.spacing.lg,
      justifyContent: "space-evenly",
      // backgroundColor: "red",
      width: "100%",
    },
    toolbarButton: {
      width: 40,
      height: 40,
      justifyContent: "center",
      alignItems: "center",
      borderRadius: theme.radius.sm,
    },
    toolbarButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    toolbarButtonLabel: {
      fontSize: 14,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    toolbarButtonLabelActive: {
      color: "#FFFFFF",
    },
    mentionModalRoot: {
      flex: 1,
    },
    mentionModalKeyboard: {
      flex: 1,
    },
    mentionModalHeader: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    mentionModalHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      minHeight: 44,
    },
    mentionModalHeaderLeft: {
      minWidth: 72,
      zIndex: 1,
    },
    mentionModalCancelHit: {
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    mentionModalCancelLabel: {
      fontSize: 17,
      fontWeight: "400",
    },
    mentionModalTitle: {
      position: "absolute",
      left: 0,
      right: 0,
      fontSize: 17,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      textAlign: "center",
    },
    mentionModalHeaderRightSpacer: {
      minWidth: 72,
    },
    mentionModalSearch: {
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: Platform.OS === "ios" ? 12 : 10,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      fontSize: 16,
    },
  });
