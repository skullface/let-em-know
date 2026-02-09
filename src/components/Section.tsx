import { type ReactNode } from "react";

interface SectionProps {
  title: ReactNode;
  children: ReactNode;
}

export default function Section({ title, children }: SectionProps) {
  return (
    <div className="p-4 border border-gray-700">
      <h2 className="text-[40px] leading-none mb-6">{title}.</h2>
      {children}
    </div>
  );
}
