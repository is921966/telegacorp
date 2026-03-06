#!/usr/bin/env node
/**
 * Standalone Telegram auth diagnostic script.
 * Tests auth.SendCode directly via GramJS without browser/React.
 *
 * Usage:
 *   node scripts/test-telegram-auth.mjs +79671992211
 *
 * This script:
 * 1. Connects to Telegram via GramJS (TCP, not WebSocket)
 * 2. Cancels any previous auth attempt
 * 3. Sends auth.SendCode with full diagnostic logging
 * 4. Logs every field of the response
 * 5. Optionally waits for code input and signs in
 */

import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { createInterface } from "readline";

// ────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────

const API_ID = 33889652;
const API_HASH = "930501da71ffbf3fc54fdbb0a81a5c64";
const PHONE = process.argv[2];

if (!PHONE) {
  process.stderr.write("Usage: node scripts/test-telegram-auth.mjs +79671992211\n");
  process.exit(1);
}

console.log("═══════════════════════════════════════════════════════");
console.log("  TELEGRAM AUTH DIAGNOSTIC TOOL");
console.log("═══════════════════════════════════════════════════════");
console.log(`Phone:     ${PHONE}`);
console.log(`API ID:    ${API_ID}`);
console.log(`API Hash:  ${API_HASH.slice(0, 8)}...`);
console.log(`Time:      ${new Date().toISOString()}`);
console.log(`Transport: TCP (not WebSocket)`);
console.log("═══════════════════════════════════════════════════════\n");

// ────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────

function inspectTL(obj, prefix = "  ") {
  if (!obj || typeof obj !== "object") {
    console.log(`${prefix}= ${obj}`);
    return;
  }
  if (obj.className) {
    console.log(`${prefix}className: ${obj.className}`);
  }
  for (const key of Object.keys(obj)) {
    if (key === "className" || key.startsWith("_") || key === "CONSTRUCTOR_ID" || key === "SUBCLASS_OF_ID") continue;
    const val = obj[key];
    if (val && typeof val === "object" && val.className) {
      console.log(`${prefix}${key}:`);
      inspectTL(val, prefix + "  ");
    } else if (typeof val === "bigint") {
      console.log(`${prefix}${key}: ${val.toString()} (bigint)`);
    } else if (Buffer.isBuffer(val)) {
      console.log(`${prefix}${key}: <Buffer ${val.length} bytes>`);
    } else if (val !== undefined && val !== null) {
      console.log(`${prefix}${key}: ${JSON.stringify(val)}`);
    }
  }
}

function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────

async function main() {
  // Step 0: Create client
  console.log("[1/5] Creating GramJS client...");
  const client = new TelegramClient(new StringSession(""), API_ID, API_HASH, {
    connectionRetries: 5,
    deviceModel: "TG Corp Diagnostic",
    systemVersion: "Node.js",
    appVersion: "1.0-diag",
  });

  // Step 1: Connect
  console.log("[2/5] Connecting to Telegram...");
  try {
    await client.connect();
    console.log("  ✅ Connected");
    console.log(`  DC: ${client.session.dcId}`);
    console.log(`  Server: ${client.session.serverAddress}`);
  } catch (err) {
    console.error("  ❌ Connection failed:", err.message);
    process.exit(1);
  }

  // Step 2: Try to cancel any previous auth
  console.log("\n[3/5] Checking for stale auth sessions...");
  // We don't have a previous hash, so we'll skip cancel and go straight to sendCode

  // Step 3: Send code via direct TL API
  console.log("\n[4/5] Invoking auth.SendCode...");
  console.log("  Request params:");
  console.log(`    phoneNumber: "${PHONE}"`);
  console.log(`    apiId: ${API_ID}`);
  console.log(`    apiHash: "${API_HASH}"`);

  let sentCode;
  try {
    sentCode = await client.invoke(
      new Api.auth.SendCode({
        phoneNumber: PHONE,
        apiId: API_ID,
        apiHash: API_HASH,
        settings: new Api.CodeSettings({
          allowFlashcall: false,
          currentNumber: false,
          allowAppHash: true,
          allowMissedCall: false,
          allowFirebase: false,
        }),
      })
    );
  } catch (err) {
    const rpcErr = err;
    console.error(`  ❌ auth.SendCode FAILED`);
    console.error(`  Error: ${err.message}`);
    console.error(`  RPC Error: ${rpcErr.errorMessage || "N/A"}`);
    console.error(`  Code: ${rpcErr.code || "N/A"}`);

    if (rpcErr.errorMessage?.startsWith("PHONE_MIGRATE_")) {
      const dc = parseInt(rpcErr.errorMessage.replace("PHONE_MIGRATE_", ""), 10);
      console.log(`\n  📡 Phone requires DC ${dc}. Migrating...`);

      // Use client.sendCode which handles migration automatically
      try {
        sentCode = await client.sendCode({ apiId: API_ID, apiHash: API_HASH }, PHONE);
        console.log("  ✅ Migrated and code sent via client.sendCode()");
        console.log("\n  client.sendCode() response (simplified):");
        inspectTL(sentCode);
      } catch (err2) {
        console.error("  ❌ Migration/sendCode failed:", err2.message);
        await client.disconnect();
        process.exit(1);
      }
    } else if (rpcErr.errorMessage === "AUTH_RESTART") {
      console.log("\n  🔄 AUTH_RESTART — Telegram wants us to restart auth");
      console.log("  This usually means the previous session is stale.");
      console.log("  Retrying with fresh sendCode...");
      try {
        sentCode = await client.invoke(
          new Api.auth.SendCode({
            phoneNumber: PHONE,
            apiId: API_ID,
            apiHash: API_HASH,
            settings: new Api.CodeSettings({}),
          })
        );
      } catch (retryErr) {
        console.error("  ❌ Retry failed:", retryErr.message);
        await client.disconnect();
        process.exit(1);
      }
    } else {
      await client.disconnect();
      process.exit(1);
    }
  }

  // Step 4: Analyze response
  console.log("\n[5/5] RESPONSE ANALYSIS");
  console.log("═══════════════════════════════════════════════════════");
  console.log("\nFull TL Object:");
  inspectTL(sentCode);

  const type = sentCode?.type;
  const nextType = sentCode?.nextType;
  const hash = sentCode?.phoneCodeHash;
  const timeout = sentCode?.timeout;

  console.log("\n───────────────────────────────────────────────────────");
  console.log("SUMMARY:");
  console.log(`  phoneCodeHash: ${hash || "MISSING ⚠️"}`);
  console.log(`  type:          ${type?.className || "MISSING ⚠️"}`);
  console.log(`  type.length:   ${type?.length || "N/A"}`);
  console.log(`  nextType:      ${nextType?.className || "none"}`);
  console.log(`  timeout:       ${timeout || "N/A"} seconds`);

  // Delivery analysis
  const deliveryMap = {
    SentCodeTypeSms: "📱 SMS",
    SentCodeTypeApp: "📲 Telegram App (existing session required!)",
    SentCodeTypeCall: "📞 Phone call",
    SentCodeTypeFlashCall: "⚡ Flash call",
    SentCodeTypeMissedCall: "📵 Missed call",
    SentCodeTypeFragmentSms: "💎 Fragment SMS",
    SentCodeTypeEmailCode: "📧 Email",
    SentCodeTypeFirebaseSms: "🔥 Firebase SMS",
  };

  const deliveryLabel = deliveryMap[type?.className] || `❓ Unknown (${type?.className})`;
  console.log(`\n  🚀 DELIVERY METHOD: ${deliveryLabel}`);

  if (type?.className === "SentCodeTypeApp") {
    console.log("\n  ℹ️  Code sent to Telegram app. User MUST have an active");
    console.log("     Telegram session on another device to receive it.");
    console.log("     If they don't see it: code may be silently rate-limited.");
  }

  if (nextType?.className) {
    const nextLabel = deliveryMap[nextType.className] || nextType.className;
    console.log(`\n  ⏭  After ${timeout}s timeout, resend will use: ${nextLabel}`);
  }

  // Check for isCodeViaApp (simplified response from client.sendCode)
  if (sentCode?.isCodeViaApp !== undefined) {
    console.log(`\n  ⚠️  isCodeViaApp: ${sentCode.isCodeViaApp} (simplified response detected)`);
  }

  console.log("═══════════════════════════════════════════════════════\n");

  // Step 5: Optionally try signing in
  const proceed = await ask("Enter verification code (or 'q' to quit, 'r' to resend): ");

  if (proceed === "q") {
    console.log("Disconnecting...");
    await client.disconnect();
    process.exit(0);
  }

  if (proceed === "r") {
    console.log("\nResending code (auth.ResendCode)...");
    try {
      const resendResult = await client.invoke(
        new Api.auth.ResendCode({
          phoneNumber: PHONE,
          phoneCodeHash: hash,
        })
      );
      console.log("Resend response:");
      inspectTL(resendResult);
    } catch (err) {
      console.error("Resend failed:", err.message, err.errorMessage || "");
    }
    await client.disconnect();
    process.exit(0);
  }

  // Try signing in
  console.log(`\nSigning in with code: ${proceed}`);
  try {
    const signInResult = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: PHONE,
        phoneCodeHash: hash,
        phoneCode: proceed,
      })
    );
    console.log("✅ Sign in successful!");
    inspectTL(signInResult);
  } catch (err) {
    const rpcErr = err;
    if (rpcErr.errorMessage === "SESSION_PASSWORD_NEEDED") {
      console.log("🔐 2FA password required");
      const pwd = await ask("Enter 2FA password: ");

      const { computeCheck } = await import("telegram/Password.js");
      const pwdInfo = await client.invoke(new Api.account.GetPassword());
      const srpCheck = await computeCheck(pwdInfo, pwd);
      const checkResult = await client.invoke(
        new Api.auth.CheckPassword({ password: srpCheck })
      );
      console.log("✅ 2FA verified!");
      inspectTL(checkResult);
    } else if (rpcErr.errorMessage === "PHONE_CODE_INVALID") {
      console.error("❌ Invalid code");
    } else if (rpcErr.errorMessage === "PHONE_CODE_EXPIRED") {
      console.error("❌ Code expired");
    } else {
      console.error("❌ Sign in failed:", err.message, rpcErr.errorMessage || "");
    }
  }

  // Get user info
  try {
    const me = await client.getMe();
    console.log("\n✅ Logged in as:", me.firstName, me.lastName || "", `(@${me.username || "N/A"})`);
  } catch {
    // Not logged in
  }

  await client.disconnect();
  console.log("Disconnected.");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
