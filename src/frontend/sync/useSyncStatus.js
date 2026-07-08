import { useCallback, useSyncExternalStore } from 'react';

/**
 * useSyncStatus — React glue over a SyncCoordinator's observable status.
 * Returns the current status string ('idle' | 'pending' | 'saving') and
 * re-renders on change. The coordinator itself is a plain JS class; this hook
 * just subscribes a component to it.
 *
 * @param {SyncCoordinator} coordinator
 * @returns {'idle' | 'pending' | 'saving'}
 */
export function useSyncStatus(coordinator) {
  const subscribe = useCallback(
    (onChange) => coordinator.subscribe(onChange),
    [coordinator],
  );
  const getSnapshot = useCallback(() => coordinator.getSnapshot(), [coordinator]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export default useSyncStatus;