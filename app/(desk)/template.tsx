import type { ReactNode } from "react";

/** Remounts on every navigation (unlike the layout), so each screen settles in (styles/motion.css). */
export default function DeskTemplate({ children }: { children: ReactNode }) {
  return <div data-page>{children}</div>;
}
