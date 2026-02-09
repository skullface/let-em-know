import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SubheadingProps {
  children: ReactNode;
  className?: string;
}

export default function Subheading({ children, className }: SubheadingProps) {
  return (
    <h3
      className={cn(
        "w-auto font-semibold font-mono border-b border-subtle pb-3 mb-5",
        className
      )}
    >
      {children}
    </h3>
  );
}
