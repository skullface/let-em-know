import { type ReactNode } from "react";

interface SubheadingProps {
  children: ReactNode;
}

export default function Subheading({ children }: SubheadingProps) {
  return (
    <h3 className="font-bold bg-blue-400 font-mono">{children}</h3>
  );
}
