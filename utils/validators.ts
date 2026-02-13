export const minLength = (
  value: string,
  minLength: number = 8,
): string | boolean =>
  value.length >= minLength || "Must be at least 8 characters";

export const hasUppercase = (value: string) => {
  const regex = /[A-Z]/;
  return regex.test(value) || "Must include at least one uppercase letter";
};

export const hasNumber = (value: string) => {
  const reg = /\d/;
  return reg.test(value) || "Must include at least one number";
};

export const hasSpecialChar = (value: string) =>
  /[^A-Za-z0-9]/.test(value) || "Must include at least one special character";
