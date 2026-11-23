"use client";

import { useEffect } from "react";
import { markReadAction } from "../actions";

/**
 * Marks what you've just seen as read. It runs as an action after the page is shown (rendering a page never
 * writes to the database), and only up to the newest item shown, so anything newer stays unread.
 */
export function MarkRead({ upTo }: { upTo: string }) {
  useEffect(() => {
    void markReadAction(upTo);
  }, [upTo]);
  return null;
}
