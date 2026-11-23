"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A bottom sheet (native <dialog>): focus is trapped, Escape and the backdrop close it, and the page behind
 * can't be scrolled. `trigger` renders the button that opens it.
 */
export function Sheet({
  title,
  trigger,
  children,
  open: controlled,
  onClose,
}: {
  title: string;
  trigger?: (open: () => void) => React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  open?: boolean;
  onClose?: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const isOpen = controlled ?? open;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (isOpen && !d.open) d.showModal();
    if (!isOpen && d.open) d.close();
  }, [isOpen]);

  const close = () => {
    setOpen(false);
    onClose?.();
  };

  return (
    <>
      {trigger?.(() => setOpen(true))}
      <dialog
        ref={ref}
        className="sheet"
        aria-label={title}
        onClose={close}
        onClick={(e) => {
          if (e.target === ref.current) close(); // a click on the backdrop
        }}
      >
        <div className="grabber" aria-hidden="true" />
        <h2>{title}</h2>
        {isOpen && (typeof children === "function" ? children(close) : children)}
      </dialog>
    </>
  );
}
