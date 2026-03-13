/**
 * Push notification setup for Expo.
 * Uses expo-notifications for local + remote push.
 * Expo Push Token is registered with the backend for delivery.
 */

import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { getPlatformConfig } from "@corp/shared";

// ─── Configuration ────────────────────────────────────────────────────

/** Configure how notifications appear when app is in foreground */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ─── Registration ────────────────────────────────────────────────────

/**
 * Register for push notifications and return the Expo Push Token.
 * Must be called after user authentication.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Push only works on physical devices
  if (!Device.isDevice) {
    console.log("[Push] Skipping: not a physical device");
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } =
    await Notifications.getPermissionsAsync();

  let finalStatus = existingStatus;

  // Request if not determined
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("[Push] Permission not granted");
    return null;
  }

  // iOS-specific: set notification categories
  if (Platform.OS === "ios") {
    await Notifications.setNotificationCategoryAsync("message", [
      {
        identifier: "reply",
        buttonTitle: "Ответить",
        options: { opensAppToForeground: false },
        textInput: {
          submitButtonTitle: "Отправить",
          placeholder: "Сообщение...",
        },
      },
      {
        identifier: "read",
        buttonTitle: "Прочитано",
        options: { opensAppToForeground: false },
      },
    ]);
  }

  // Get Expo Push Token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "telegram-corp-mobile", // Must match app.json
    });
    console.log("[Push] Token:", tokenData.data);
    return tokenData.data;
  } catch (err) {
    console.error("[Push] Failed to get token:", err);
    return null;
  }
}

/**
 * Send push token to our backend for push delivery.
 */
export async function registerPushTokenWithBackend(
  pushToken: string,
  telegramUserId: string
): Promise<void> {
  const { apiBaseUrl } = getPlatformConfig();

  try {
    const response = await fetch(`${apiBaseUrl}/api/push/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        token: pushToken,
        telegramUserId,
        platform: Platform.OS,
      }),
    });

    if (!response.ok) {
      console.error("[Push] Backend registration failed:", response.status);
    }
  } catch (err) {
    console.error("[Push] Backend registration error:", err);
  }
}

// ─── Listeners ───────────────────────────────────────────────────────

/**
 * Add a listener for when a notification is tapped (app opened from notification).
 * Returns cleanup function.
 */
export function addNotificationResponseListener(
  handler: (chatId: string | null) => void
): () => void {
  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const chatId =
        response.notification.request.content.data?.chatId as string | undefined;
      handler(chatId || null);
    }
  );

  return () => subscription.remove();
}

/**
 * Set app badge count.
 */
export async function setBadgeCount(count: number): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch {
    // Ignore on unsupported platforms
  }
}

/**
 * Schedule a local notification (for testing).
 */
export async function scheduleLocalNotification(
  title: string,
  body: string,
  data?: Record<string, unknown>
): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      data,
      categoryIdentifier: "message",
    },
    trigger: null, // Immediately
  });
}
