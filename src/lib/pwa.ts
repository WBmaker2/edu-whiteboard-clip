import { registerSW } from "virtual:pwa-register";

let started = false;

export function startPwa(
  onNeedRefresh: (applyUpdate: () => void) => void,
  onOfflineReady: () => void,
): void {
  if (started || !import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  started = true;
  const update: { apply?: () => void } = {};
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh: () => onNeedRefresh(() => update.apply?.()),
    onOfflineReady,
  });
  update.apply = () => void updateSW(true);
}
