import type { ReactNode } from "react";

/** Other platforms render the list without Android's floating action button. */
export function AndroidHomeFabLayout(props: {
  /** Absent when the list belongs to thread guests, who cannot start tasks. */
  readonly onStartNewTask: (() => void) | undefined;
  readonly children: ReactNode;
  readonly sidebar?: boolean;
}) {
  return <>{props.children}</>;
}
