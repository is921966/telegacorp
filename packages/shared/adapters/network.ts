/**
 * Network adapter — platform-specific implementations must be injected.
 *
 * Web: navigator.connection API
 * Mobile: @react-native-community/netinfo
 */

export interface NetworkAdapter {
  isSlowConnection: () => boolean;
}

let _adapter: NetworkAdapter = {
  isSlowConnection: () => false,
};

export function setNetworkAdapter(adapter: NetworkAdapter): void {
  _adapter = adapter;
}

export function isSlowConnection(): boolean {
  return _adapter.isSlowConnection();
}
