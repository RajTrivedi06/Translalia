export const isVerifyEnabled = () =>
  process.env.NEXT_PUBLIC_FEATURE_VERIFY === "1";
export const isBacktranslateEnabled = () =>
  process.env.NEXT_PUBLIC_FEATURE_BACKTRANSLATE === "1";
export const VERIFY_DAILY_LIMIT = Number(process.env.VERIFY_DAILY_LIMIT ?? 20);
export const BACKTRANSLATE_DAILY_LIMIT = Number(
  process.env.BACKTRANSLATE_DAILY_LIMIT ?? 10
);
