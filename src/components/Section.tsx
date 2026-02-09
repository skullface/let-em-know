import { type ReactNode } from "react";

const DEFAULT_WRAPPER_CLASS = "bg-gray-800 rounded-lg p-4";
const DEFAULT_HEADING_CLASS = "text-xl font-bold mb-4 text-cavaliers-gold";

interface SectionProps {
  title: ReactNode;
  children: ReactNode;
  /** Override wrapper div className (default: bg-gray-800 rounded-lg p-4) */
  className?: string;
  /** Override h2 className (default: text-xl font-bold mb-4 text-cavaliers-gold) */
  headingClassName?: string;
}

export default function Section({
  title,
  children,
  className = DEFAULT_WRAPPER_CLASS,
  headingClassName = DEFAULT_HEADING_CLASS,
}: SectionProps) {
  return (
    <div className={className}>
      <h2 className={headingClassName}>{title}</h2>
      {children}
    </div>
  );
}
