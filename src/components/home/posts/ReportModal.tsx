import {
    useCreateReportMutation,
    useGetReport,
} from "@/src/features/post/post.hooks";
import {
    CreateReportPayload,
    ReportTarget,
} from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";
import { useTheme } from "@/src/theme/ThemeProvider";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { useForm } from "react-hook-form";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import FormInput from "../../ui/input";

interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  target: ReportTarget | null;
}

interface ReportFormData {
  reason: string;
  message: string;
}

const TARGET_LABELS: Record<
  ReportTarget["kind"],
  { title: string; success: string }
> = {
  post: {
    title: "Report Post",
    success:
      "The post has been reported successfully. Thank you for helping keep our community safe.",
  },
  comment: {
    title: "Report Comment",
    success:
      "The comment has been reported successfully. Thank you for helping keep our community safe.",
  },
  story: {
    title: "Report Story",
    success:
      "The story has been reported successfully. Thank you for helping keep our community safe.",
  },
  user: {
    title: "Report User",
    success:
      "This user has been reported successfully. Thank you for helping keep our community safe.",
  },
  message: {
    title: "Report Message",
    success:
      "This message has been reported successfully. Thank you for helping keep our community safe.",
  },
};

function buildPayload(
  target: ReportTarget,
  reason: string,
  message: string,
): CreateReportPayload {
  const base = {
    type: reason,
    user_id: target.userId,
    ...(message.trim() ? { details: message.trim() } : {}),
  };

  switch (target.kind) {
    case "post":
      return { ...base, post_id: target.postId };
    case "comment":
      return { ...base, comment_id: target.commentId };
    case "story":
      return { ...base, story_id: target.storyId };
    case "message":
      return { ...base, message_id: target.messageId };
    case "user":
      return base;
  }
}

const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  target,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(theme);
  const { data: reports, isLoading: isLoadingReasons } = useGetReport();
  const mutation = useCreateReportMutation();

  const { control, handleSubmit, reset } = useForm<ReportFormData>({
    defaultValues: {
      reason: "",
      message: "",
    },
  });

  const onSubmit = async (data: ReportFormData) => {
    if (!target) return;

    if (!data.reason) {
      Alert.alert("Error", "Please select a reason for reporting.");
      return;
    }

    const payload = buildPayload(target, data.reason, data.message);

    try {
      await mutation.mutateAsync(payload);
      Alert.alert("Reported Successfully", TARGET_LABELS[target.kind].success);
      reset();
      onClose();
    } catch {
      Alert.alert("Error", "Failed to submit report. Please try again later.");
    }
  };

  const reportOptions = reports?.types.map((r: string) => ({
    label: r,
    value: r,
  }));

  const title = target ? TARGET_LABELS[target.kind].title : "Report";

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.keyboardView}
        >
          <View style={styles.container}>
            <View style={styles.header}>
              <Text style={styles.title}>{title}</Text>
              <TouchableOpacity onPress={onClose}>
                <Ionicons name="close" size={24} color={theme.colors.icon} />
              </TouchableOpacity>
            </View>

            <View style={styles.content}>
              {isLoadingReasons ? (
                <ActivityIndicator
                  size="large"
                  color={theme.colors.primary}
                  style={styles.loader}
                />
              ) : (
                <>
                  <FormInput
                    control={control}
                    name="reason"
                    label="Reason"
                    pickerType="select"
                    options={reportOptions ?? []}
                    placeholder="Select a reason"
                    rules={{ required: "Reason is required" }}
                  />

                  <FormInput
                    control={control}
                    name="message"
                    label="Details (Optional)"
                    placeholder="Provide more information..."
                    multiline
                    numberOfLines={4}
                  />

                  <TouchableOpacity
                    style={[
                      styles.submitButton,
                      mutation.isPending && styles.submitButtonDisabled,
                    ]}
                    onPress={handleSubmit(onSubmit)}
                    disabled={mutation.isPending || !target}
                  >
                    {mutation.isPending ? (
                      <ActivityIndicator color={theme.colors.background} />
                    ) : (
                      <Text style={styles.submitButtonText}>Submit Report</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

export default ReportModal;

const createStyles = (theme: AppTheme) =>
  StyleSheet.create({
    overlay: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    backdrop: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: "rgba(0, 0, 0, 0.5)",
    },
    keyboardView: {
      width: "100%",
      alignItems: "center",
    },
    container: {
      width: "90%",
      backgroundColor: theme.colors.card,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.xl,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 10,
      elevation: 5,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: theme.spacing.xl,
    },
    title: {
      fontSize: 18,
      fontWeight: "bold",
      color: theme.colors.textPrimary,
    },
    content: {
      gap: theme.spacing.lg,
    },
    loader: {
      marginVertical: theme.spacing.xl,
    },
    submitButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: theme.spacing.lg,
      borderRadius: theme.radius.md,
      alignItems: "center",
      marginTop: theme.spacing.md,
    },
    submitButtonDisabled: {
      opacity: 0.6,
    },
    submitButtonText: {
      color: theme.colors.background,
      fontSize: 16,
      fontWeight: "bold",
    },
  });
