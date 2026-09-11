import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { listen as tauriListen } from "@tauri-apps/api/event";

/**
 * Thin wrapper over Tauri APIs so the UI can also run in a plain browser
 * during development (mocked backend, see dev-mock.ts). Under Tauri the
 * behavior is identical to calling @tauri-apps/api directly.
 */
export const isTauri = "__TAURI_INTERNALS__" in window;

export async function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  if (isTauri) return tauriInvoke<T>(cmd, args);
  const { mockInvoke } = await import("./dev-mock");
  return mockInvoke<T>(cmd, args);
}

export async function listen<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  if (isTauri) {
    return tauriListen<T>(event, (e) => handler(e.payload));
  }
  // No file watching in browser dev mode
  return () => {};
}
