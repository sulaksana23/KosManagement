export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export type PasswordRule = {
  id: string;
  label: string;
  valid: boolean;
};

export function getPasswordStrength(password: string) {
  const hasMixedCase = /[a-z]/.test(password) && /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const meetsMinimum = password.length >= MIN_PASSWORD_LENGTH;

  const score = !password
    ? 0
    : !meetsMinimum
      ? 1
      : Math.min(
          4,
          1 +
            Number(password.length >= 16) +
            Number(hasMixedCase) +
            Number(hasNumber) +
            Number(hasSymbol),
        );

  const label = !password
    ? "Belum diisi"
    : !meetsMinimum
      ? "Belum memenuhi"
      : score <= 1
        ? "Lemah"
        : score === 2
          ? "Cukup"
          : score === 3
            ? "Kuat"
            : "Sangat kuat";

  const tone = !password
    ? "neutral"
    : !meetsMinimum || score <= 1
      ? "danger"
      : score === 2
        ? "warning"
        : score === 3
          ? "good"
          : "strong";

  const rules: PasswordRule[] = [
    {
      id: "minimum",
      label: `Minimal ${MIN_PASSWORD_LENGTH} karakter`,
      valid: meetsMinimum,
    },
    {
      id: "longer",
      label: "16 karakter atau lebih",
      valid: password.length >= 16,
    },
    {
      id: "mixed-case",
      label: "Huruf besar dan kecil",
      valid: hasMixedCase,
    },
    {
      id: "number",
      label: "Mengandung angka",
      valid: hasNumber,
    },
    {
      id: "symbol",
      label: "Mengandung simbol",
      valid: hasSymbol,
    },
  ];

  return { score, label, tone, rules };
}
