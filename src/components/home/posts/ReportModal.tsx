import {
    useCreateReportMutation,
    useGetReport,
} from "@/src/features/post/post.hooks";
import { CreateReportPayload } from "@/src/services/api/api.types";
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
  postId: number;
  userId: number;
}

interface ReportFormData {
  reason: string;
  message: string;
}

const ReportModal: React.FC<ReportModalProps> = ({
  visible,
  onClose,
  postId,
  userId,
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
    if (!data.reason) {
      Alert.alert("Error", "Please select a reason for reporting.");
      return;
    }

    const payload: CreateReportPayload = {
      post_id: postId,
      details: data.message,
      type: data.reason,
      user_id: userId,
      message_id: "",
      stream_id: "",
    };

    try {
      await mutation.mutateAsync(payload);
      Alert.alert(
        "Reported Successfully",
        "The post has been reported successfully. Thank you for helping keep our community safe.",
      );
      reset();
      onClose();
    } catch (error) {
      Alert.alert("Error", "Failed to submit report. Please try again later.");
    }
  };

  // Convert reasons to options format.
  // Assuming reports is the object returned from useGetReport which is d.data.data from /report/types
  // We'll try to find the reasons array.
  const reasonsArray = Array.isArray(reports)
    ? reports
    : (reports as any)?.reasons || [];

  const reportOptions = reports?.types.map((r: string) => ({
    label: r,
    value: r,
  }));

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
              <Text style={styles.title}>Report Post</Text>
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
                    disabled={mutation.isPending}
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
