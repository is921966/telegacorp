/**
 * Network adapter for React Native.
 * Uses expo-network to detect connection quality.
 * Implements NetworkAdapter from @corp/shared (synchronous API).
 *
 * Since the shared interface is synchronous but expo-network is async,
 * we poll the network state periodically and cache it.
 */

import * as Network from "expo-network";
import { setNetworkAdapter } from "@corp/shared";

let _isSlow = false;
let _pollInterval: ReturnType<typeof setInterval> | null = null;

async function updateNetworkState(): Promise<void> {
  try {
    const state = await Network.getNetworkStateAsync();
    _isSlow =
      !state.isConnected ||
      !state.isInternetReachable ||
      state.type === Network.NetworkStateType.CELLULAR;
  } catch {
    _isSlow = false;
  }
}

/**
 * Initialize the mobile network adapter.
 * Starts polling network state every 10 seconds.
 */
export function initMobileNetworkAdapter(): void {
  // Initial check
  updateNetworkState();

  // Poll periodically
  _pollInterval = setInterval(updateNetworkState, 10_000);

  setNetworkAdapter({
    isSlowConnection: () => _isSlow,
  });
}

/**
 * Stop network polling (cleanup).
 */
export function stopNetworkAdapter(): void {
  if (_pollInterval) {
    clearInterval(_pollInterval);
    _pollInterval = null;
  }
}
