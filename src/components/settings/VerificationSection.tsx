import { useToast } from "@/src/components/toast/ToastProvider";
import {
  verificationDisplayStatus,
  verificationStatusColor,
  verificationStatusLabel,
} from "@/src/components/settings/verification.utils";
import { useResendEmailVerification } from "@/src/features/auth/auth.hooks";
import {
  useSubmitVerificationMutation,
  useVerificationQuery,
  VerificationUploadFile,
} from "@/src/features/settings/settings.hooks";
import { getApiErrorMessage } from "@/src/services/api/api.error";
import type { VerificationFile } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { useActionSheet } from "@expo/react-native-action-sheet";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const RESEND_EMAIL_COOLDOWN_SEC = 30;
const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "application/pdf",
]);

function isAllowedFile(name: string, mimeType: string): boolean {
  const lower = mimeType.toLowerCase();
  if (ALLOWED_MIME_TYPES.has(lower)) return true;
  const ext = name.split(".").pop()?.toLowerCase();
  return ext === "jpg" || ext === "jpeg" || ext === "pdf";
}

function normalizeMimeType(name: string, mimeType: string): string {
  const lower = mimeType.toLowerCase();
  if (ALLOWED_MIME_TYPES.has(lower)) return lower;
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "pdf") return "application/pdf";
  return lower;
}

function normalizeVerificationFiles(files: unknown): VerificationFile[] {
  if (Array.isArray(files)) return files;
  if (files && typeof files === "object") {
    return Object.values(files as Record<string, VerificationFile>);
  }
  return [];
}

function isVerificationImageFile(
  file: VerificationFile | VerificationUploadFile,
): boolean {
  if (file.type === "image") return true;
  if (file.type.startsWith("image/")) return true;

  const fileName =
    "name" in file ? file.name : file.path.split("/").pop() ?? "";
  const lower = fileName.toLowerCase();
  return (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".png")
  );
}

function getVerificationPreviewUri(
  file: VerificationFile | VerificationUploadFile,
  preferPath = false,
): string | undefined {
  if ("uri" in file) return file.uri;

  const serverFile = file as VerificationFile;
  if (!preferPath && serverFile.thumbnail) return serverFile.thumbnail;
  if (isVerificationImageFile(file) && serverFile.path) return serverFile.path;
  return undefined;
}

function validateFileSize(size: number | undefined | null): boolean {
  if (size == null) return true;
  return size <= MAX_FILE_SIZE;
}

function FileThumbnail({
  file,
  theme,
  onRemove,
  removable,
}: {
  file: VerificationFile | VerificationUploadFile;
  theme: AppTheme;
  onRemove?: () => void;
  removable?: boolean;
}) {
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [usePathFallback, setUsePathFallback] = useState(false);
  const isImage = isVerificationImageFile(file);
  const previewUri = getVerificationPreviewUri(file, usePathFallback);

  return (
    <View style={styles.thumbWrap}>
      {previewUri && isImage ? (
        <Image
          source={{ uri: previewUri }}
          style={styles.thumbImage}
          contentFit="cover"
          recyclingKey={"id" in file ? file.id : previewUri}
          onError={() => {
            if (!usePathFallback && "path" in file && file.thumbnail) {
              setUsePathFallback(true);
            }
          }}
        />
      ) : (
        <View style={[styles.thumbImage, styles.thumbPlaceholder]}>
          <Ionicons
            name="document-text-outline"
            size={28}
            color={theme.colors.textSecondary}
          />
        </View>
      )}
      {removable && onRemove ? (
        <Pressable
          style={styles.thumbRemove}
          onPress={onRemove}
          hitSlop={8}
          accessibilityLabel="Remove file"
        >
          <Ionicons name="close-circle" size={22} color="#ef4444" />
        </Pressable>
      ) : null}
    </View>
  );
}

export function VerificationSection() {
  const { theme } = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { trigger } = useToast();
  const { showActionSheetWithOptions } = useActionSheet();

  const { data, isLoading, isError, refetch, isRefetching } =
    useVerificationQuery();
  const submitVerification = useSubmitVerificationMutation();
  const resendEmail = useResendEmailVerification();

  const [localFiles, setLocalFiles] = useState<VerificationUploadFile[]>([]);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [mailSent, setMailSent] = useState(false);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => {
      setResendCooldown((seconds) => seconds - 1);
    }, 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const verification = data?.data;
  const displayStatus = verification
    ? verificationDisplayStatus(verification)
    : undefined;
  const submittedFiles = normalizeVerificationFiles(verification?.files);
  const canSubmit = verification?.can_submit === true;
  const canSubmitForm =
    canSubmit && localFiles.length >= 1 && !submitVerification.isPending;

  const addFile = useCallback((file: VerificationUploadFile) => {
    if (!isAllowedFile(file.name, file.type)) {
      Alert.alert(
        "Unsupported file",
        "Only JPG and PDF files are allowed.",
      );
      return;
    }
    if (!validateFileSize(file.size)) {
      Alert.alert("File too large", "Each file must be 4 MB or smaller.");
      return;
    }
    setLocalFiles((prev) => [...prev, file]);
  }, []);

  const pickImage = useCallback(
    async (source: "camera" | "gallery") => {
      const permission =
        source === "camera"
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (permission.status !== "granted") return;

      const pickerFn =
        source === "camera"
          ? ImagePicker.launchCameraAsync
          : ImagePicker.launchImageLibraryAsync;

      const result = await pickerFn({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.9,
      });

      if (result.canceled || !result.assets[0]) return;

      const asset = result.assets[0];
      const name = asset.fileName ?? asset.uri.split("/").pop() ?? "photo.jpg";
      const type = normalizeMimeType(
        name,
        asset.mimeType ?? "image/jpeg",
      );

      addFile({
        uri: asset.uri,
        name,
        type,
        size: asset.fileSize,
      });
    },
    [addFile],
  );

  const pickPdf = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    const name = asset.name ?? "document.pdf";
    const type = normalizeMimeType(name, asset.mimeType ?? "application/pdf");

    addFile({
      uri: asset.uri,
      name,
      type,
      size: asset.size,
    });
  }, [addFile]);

  const openPicker = useCallback(() => {
    showActionSheetWithOptions(
      {
        options: ["Take photo", "Choose photo", "Choose PDF", "Cancel"],
        cancelButtonIndex: 3,
      },
      (index) => {
        if (index === 0) void pickImage("camera");
        else if (index === 1) void pickImage("gallery");
        else if (index === 2) void pickPdf();
      },
    );
  }, [pickImage, pickPdf, showActionSheetWithOptions]);

  const handleSubmit = useCallback(() => {
    if (!canSubmitForm) return;

    submitVerification.mutate(localFiles, {
      onSuccess: (response) => {
        setLocalFiles([]);
        trigger(
          response.message ??
            "Request sent. You will be notified once your verification is processed.",
          "success",
        );
      },
      onError: (error) => {
        trigger(getApiErrorMessage(error, "Could not submit verification."), "error");
      },
    });
  }, [canSubmitForm, localFiles, submitVerification, trigger]);

  const handleResendEmail = useCallback(() => {
    if (resendCooldown > 0 || resendEmail.isPending) return;

    resendEmail.mutate(undefined, {
      onSuccess: (response) => {
        setMailSent(true);
        setResendCooldown(RESEND_EMAIL_COOLDOWN_SEC);
        trigger(
          response.message ?? "Verification email sent.",
          "success",
        );
      },
      onError: (error) => {
        trigger(
          getApiErrorMessage(error, "Could not resend verification email."),
          "error",
        );
      },
    });
  }, [resendCooldown, resendEmail, trigger]);

  const showRequirements =
    verification &&
    (!verification.email_confirmed || !verification.birthdate_set);
  const canResendEmail = resendCooldown === 0 && !resendEmail.isPending;

  if (isLoading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator size="small" color={theme.colors.primary} />
      </View>
    );
  }

  if (isError || !verification) {
    return (
      <View style={styles.errorWrap}>
        <Text style={styles.errorText}>Could not load verification status.</Text>
        <Pressable
          style={styles.retryButton}
          onPress={() => void refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? (
            <ActivityIndicator size="small" color={theme.colors.primary} />
          ) : (
            <Text style={styles.retryText}>Retry</Text>
          )}
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.statusRow}>
        <View style={styles.statusLeft}>
          <Ionicons
            name="shield-checkmark-outline"
            size={20}
            color={theme.colors.icon}
          />
          <Text style={styles.statusText}>Status</Text>
        </View>
        <View
          style={[
            styles.statusBadge,
            {
              backgroundColor: `${verificationStatusColor(displayStatus!, theme)}20`,
            },
          ]}
        >
          <Text
            style={[
              styles.statusBadgeText,
              { color: verificationStatusColor(displayStatus!, theme) },
            ]}
          >
            {verificationStatusLabel(displayStatus!)}
          </Text>
        </View>
      </View>

      {showRequirements ? (
        <View style={styles.requirementsBlock}>
          <Text style={styles.requirementsTitle}>Requirements</Text>

          {!verification.email_confirmed ? (
            <View style={styles.requirementRow}>
              <Ionicons
                name="mail-outline"
                size={20}
                color={theme.colors.icon}
              />
              <View style={styles.requirementContent}>
                <Text style={styles.requirementLabel}>Email not verified</Text>
                <Text style={styles.requirementSubtitle}>
                  Verify your email before submitting documents.
                </Text>
                {mailSent && resendCooldown > 0 ? (
                  <View style={styles.mailSentRow}>
                    <Ionicons
                      name="checkmark-circle"
                      size={16}
                      color="#22c55e"
                    />
                    <Text style={styles.mailSentText}>Mail sent</Text>
                  </View>
                ) : (
                  <Pressable
                    onPress={handleResendEmail}
                    disabled={!canResendEmail}
                    style={({ pressed }) => [
                      styles.resendButton,
                      !canResendEmail && styles.resendButtonDisabled,
                      pressed && canResendEmail && styles.resendButtonPressed,
                    ]}
                  >
                    {resendEmail.isPending ? (
                      <ActivityIndicator
                        size="small"
                        color={theme.colors.primary}
                      />
                    ) : (
                      <Text style={styles.resendButtonText}>
                        {resendCooldown > 0
                          ? `Resend in ${resendCooldown}s`
                          : "Resend verification email"}
                      </Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          ) : null}

          {!verification.birthdate_set ? (
            <Pressable
              style={({ pressed }) => [
                styles.requirementRow,
                styles.requirementRowTappable,
                pressed && styles.requirementRowPressed,
              ]}
              onPress={() => {
                router.navigate({
                  pathname: "/profile/edit-profile",
                  params: { returnTo: "/(app)/account-verification" },
                });
              }}
            >
              <Ionicons
                name="calendar-outline"
                size={20}
                color={theme.colors.icon}
              />
              <View style={styles.requirementContent}>
                <Text style={styles.requirementLabel}>Birthdate not added</Text>
                <Text style={styles.requirementSubtitle}>
                  Add your birthdate in Edit Profile to continue.
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={theme.colors.icon}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {verification.status === "rejected" && verification.rejection_reason ? (
        <View style={styles.rejectionBox}>
          <Ionicons name="alert-circle-outline" size={18} color="#ef4444" />
          <Text style={styles.rejectionText}>{verification.rejection_reason}</Text>
        </View>
      ) : null}

      {submittedFiles.length > 0 ? (
        <View style={styles.filesBlock}>
          <Text style={styles.filesTitle}>Submitted documents</Text>
          <View style={styles.filesRow}>
            {submittedFiles.map((file) => (
              <FileThumbnail key={file.id} file={file} theme={theme} />
            ))}
          </View>
        </View>
      ) : null}

      {canSubmit ? (
        <>
          <View style={styles.filesBlock}>
            <Text style={styles.filesTitle}>
              {localFiles.length > 0
                ? "Files to submit"
                : "Add at least one JPG or PDF (max 4 MB each)"}
            </Text>
            {localFiles.length > 0 ? (
              <View style={styles.filesRow}>
                {localFiles.map((file, index) => (
                  <FileThumbnail
                    key={`${file.uri}-${index}`}
                    file={file}
                    theme={theme}
                    removable
                    onRemove={() =>
                      setLocalFiles((prev) => prev.filter((_, i) => i !== index))
                    }
                  />
                ))}
              </View>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.addButton,
              pressed && styles.addButtonPressed,
            ]}
            onPress={openPicker}
          >
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={theme.colors.primary}
            />
            <Text style={styles.addButtonText}>Add document</Text>
          </Pressable>

          <Pressable
            disabled={!canSubmitForm}
            onPress={handleSubmit}
            style={({ pressed }) => [
              styles.submitButton,
              !canSubmitForm && styles.submitButtonDisabled,
              pressed && canSubmitForm && styles.submitButtonPressed,
            ]}
          >
            {submitVerification.isPending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.submitButtonText}>Submit verification</Text>
            )}
          </Pressable>
        </>
      ) : (
        <Text style={styles.blockedHint}>
          {verification.status === "pending"
            ? "Your verification is being reviewed. You will be notified when it is processed."
            : verification.status === "approved"
              ? "Your account is verified."
              : "You cannot submit verification at this time."}
        </Text>
      )}
    </View>
  );
}

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    loadingWrap: {
      paddingVertical: theme.spacing.lg,
      alignItems: "center",
    },
    errorWrap: {
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    errorText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
    },
    retryButton: {
      alignSelf: "flex-start",
      paddingVertical: theme.spacing.xs,
    },
    retryText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    statusRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    statusLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.md,
    },
    statusText: {
      fontSize: 15,
      color: theme.colors.textPrimary,
      fontWeight: "500",
    },
    statusBadge: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 4,
      borderRadius: theme.radius.sm,
    },
    statusBadgeText: {
      fontSize: 13,
      fontWeight: "600",
    },
    requirementsBlock: {
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.border,
    },
    requirementsTitle: {
      fontSize: 13,
      fontWeight: "600",
      color: theme.colors.textSecondary,
      textTransform: "uppercase",
      letterSpacing: 0.5,
      paddingHorizontal: theme.spacing.lg,
      paddingBottom: theme.spacing.sm,
    },
    requirementRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: theme.colors.border,
    },
    requirementRowTappable: {
      alignItems: "center",
    },
    requirementRowPressed: {
      opacity: 0.7,
    },
    requirementContent: {
      flex: 1,
      gap: 4,
    },
    requirementLabel: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.colors.textPrimary,
    },
    requirementSubtitle: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
    },
    resendButton: {
      alignSelf: "flex-start",
      marginTop: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
    },
    resendButtonDisabled: {
      opacity: 0.5,
    },
    resendButtonPressed: {
      opacity: 0.7,
    },
    resendButtonText: {
      fontSize: 14,
      fontWeight: "600",
      color: theme.colors.primary,
    },
    mailSentRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      marginTop: theme.spacing.xs,
    },
    mailSentText: {
      fontSize: 14,
      fontWeight: "600",
      color: "#22c55e",
    },
    rejectionBox: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg,
      marginVertical: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: "#ef444415",
    },
    rejectionText: {
      flex: 1,
      fontSize: 13,
      lineHeight: 18,
      color: "#ef4444",
    },
    filesBlock: {
      paddingTop: theme.spacing.sm,
      paddingBottom: theme.spacing.sm,
    },
    filesTitle: {
      fontSize: 13,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.lg,
      marginBottom: theme.spacing.sm,
    },
    filesRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingHorizontal: theme.spacing.lg,
      gap: theme.spacing.sm,
    },
    thumbWrap: {
      position: "relative",
    },
    thumbImage: {
      width: 72,
      height: 72,
      borderRadius: theme.radius.sm,
      overflow: "hidden",
    },
    thumbPlaceholder: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.surface,
    },
    thumbRemove: {
      position: "absolute",
      top: -6,
      right: -6,
      backgroundColor: theme.colors.card,
      borderRadius: 11,
    },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: theme.spacing.sm,
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.sm,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.colors.border,
      borderStyle: "dashed",
    },
    addButtonPressed: {
      opacity: 0.7,
    },
    addButtonText: {
      fontSize: 15,
      fontWeight: "500",
      color: theme.colors.primary,
    },
    submitButton: {
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      minHeight: 48,
    },
    submitButtonDisabled: {
      opacity: 0.45,
    },
    submitButtonPressed: {
      opacity: 0.85,
    },
    submitButtonText: {
      fontSize: 15,
      fontWeight: "600",
      color: "#fff",
    },
    blockedHint: {
      fontSize: 13,
      lineHeight: 18,
      color: theme.colors.textSecondary,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
    },
  });
