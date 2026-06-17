import type { VerificationStatusData } from "@/src/services/api/api.types";
import { AppTheme } from "@/src/theme";

export const ACTION_REQUIRED_STATUS = "action_required";

export function hasVerificationPrerequisites(
  data: Pick<VerificationStatusData, "email_confirmed" | "birthdate_set">,
): boolean {
  return data.email_confirmed && data.birthdate_set;
}

export function verificationDisplayStatus(
  data: VerificationStatusData,
): string {
  if (!hasVerificationPrerequisites(data)) {
    return ACTION_REQUIRED_STATUS;
  }
  return data.status;
}

export function verificationStatusLabel(status: string): string {
  switch (status) {
    case ACTION_REQUIRED_STATUS:
      return "Action required";
    case "pending":
      return "Under review";
    case "approved":
      return "Verified";
    case "rejected":
      return "Rejected";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function verificationStatusColor(
  status: string,
  theme: AppTheme,
): string {
  switch (status) {
    case ACTION_REQUIRED_STATUS:
      return "#f59e0b";
    case "approved":
      return "#22c55e";
    case "rejected":
      return "#ef4444";
    case "pending":
      return theme.colors.primary;
    default:
      return theme.colors.textSecondary;
  }
}
