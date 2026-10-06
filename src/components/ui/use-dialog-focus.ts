import { useEffect, useRef, type KeyboardEvent } from "react";

/** Keyboard focus for the two dispute dialogs; never changes their submit flow. */
export function useDialogFocus(busy: boolean, onClose: () => void) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof document === "undefined") return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.querySelector<HTMLTextAreaElement>("textarea:not([disabled])")?.focus();
    return () => { if (previous?.isConnected) previous.focus?.(); };
  }, []);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof document === "undefined") return;
    if (busy) dialog.focus();
    else if (document.activeElement === dialog) dialog.querySelector<HTMLTextAreaElement>("textarea:not([disabled])")?.focus();
  }, [busy]);

  const onDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!busy) onClose();
      return;
    }
    if (event.key !== "Tab" || typeof document === "undefined") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const controls = [...dialog.querySelectorAll<HTMLElement>(
      'button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    )].filter((control) => control.tabIndex >= 0 && !control.hidden && control.getAttribute("aria-hidden") !== "true");
    const first = controls[0], last = controls.at(-1);
    if (!controls.length) {
      event.preventDefault();
      dialog.focus();
    } else if (!controls.includes(document.activeElement as HTMLElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first)?.focus();
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return { dialogRef, onDialogKeyDown };
}
