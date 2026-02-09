import { type ReactNode } from "react";

interface SectionProps {
  title: ReactNode;
  children: ReactNode;
}

export default function Section({ title, children }: SectionProps) {
  return (
    <section>
      <h2 className="text-lg leading-none mb-8">{title}.</h2>
      {children}
    </section>
  );
}
