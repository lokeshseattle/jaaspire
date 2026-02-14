// utils/formErrors.ts
import { FieldValues, Path, UseFormSetError } from "react-hook-form";

export function setServerErrors<T extends FieldValues>(
  serverErrors: Record<string, string[]> | undefined,
  setError: UseFormSetError<T>,
  fieldMap?: Record<string, string>,
) {
  if (!serverErrors) return;

  Object.entries(serverErrors).forEach(([serverField, messages]) => {
    // Map to form field name or use original
    const formField = fieldMap?.[serverField] || serverField;

    setError(formField as Path<T>, {
      type: "server",
      message: messages[0],
    });
  });
}
