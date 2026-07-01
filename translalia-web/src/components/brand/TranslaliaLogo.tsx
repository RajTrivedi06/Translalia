import { cn } from "@/lib/utils";
import { TranslaliaMark } from "./TranslaliaMark";

/** Wordmark sizes derived from the 46px design reference. */
const sizeStyles = {
  sm: "text-[1.0625rem]", // 17px - balanced in the 56px header
  md: "text-[2rem]", // 32px - auth screens
  lg: "text-[2.875rem]", // 46px - design reference
  hero: "text-[2.5rem] sm:text-[4.5rem] lg:text-[6.25rem]",
} as const;

export type TranslaliaLogoSize = keyof typeof sizeStyles;

interface TranslaliaLogoProps {
  size?: TranslaliaLogoSize;
  className?: string;
  showWordmark?: boolean;
  animateMark?: boolean;
}

/**
 * Full Translalia lockup: selection-handle mark plus Merriweather wordmark.
 * Mark and spacing scale in `em` from a single font size for a seamless fit.
 */
export function TranslaliaLogo({
  size = "sm",
  className,
  showWordmark = true,
  animateMark = false,
}: TranslaliaLogoProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[0.44em]",
        "font-serif font-normal [line-height:1] tracking-normal text-foreground",
        "select-none",
        sizeStyles[size],
        className,
      )}
    >
      <TranslaliaMark animated={animateMark} />
      {showWordmark ? (
        <span className="whitespace-nowrap">
          <span>Trans</span>
          <span className="italic text-accent">lalia</span>
        </span>
      ) : null}
    </span>
  );
}
