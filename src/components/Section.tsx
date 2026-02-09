import { type ReactNode } from "react";

interface SectionProps {
  title: ReactNode;
  children: ReactNode;
}

export default function Section({ title, children }: SectionProps) {
  return (
    <section>
      <h2 className="text-[40px] leading-none mb-8">{title}.</h2>
      {children}
    </section>
  );
}
