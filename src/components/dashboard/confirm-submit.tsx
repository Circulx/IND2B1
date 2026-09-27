"use client";

import type { ReactNode } from "react";

/** Wraps a submit button and asks for confirmation before the form is sent. */
export function ConfirmSubmit({ message, children }: { message: string; children: ReactNode }) {
  return (
    <span onClickCapture={(e) => { if (!window.confirm(message)) { e.preventDefault(); e.stopPropagation(); } }} className="contents">
      {children}
    </span>
  );
}
