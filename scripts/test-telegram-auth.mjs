#!/usr/bin/env node
/**
 * Standalone Telegram auth diagnostic script.
 * Tests auth.SendCode directly via GramJS without browser/React.
 *
 * Usage:
 *   # Production DC (real phone number):
 *   node scripts/test-telegram-auth.mjs +79671992211
 *
 *   # Test DC (test phone number, code is always 22222 for DC2):
 *   node scripts/test-telegram-auth.mjs --test 9996621234
 *
 * Test phone format: 99966XYYYY where X=DC number, YYYY=any digits
 * Test login code:   XXXXX (DC number repeated 5 times, e.g., 22222 for DC2)
 *
 * This script:
 * 1. Connects to Telegram via GramJS (TCP)
 * 2. Sends auth.SendCode with full diagnostic logging
 * 3. Logs every field of the TL response
 * 4. Optionally waits for code input and signs in
 */

import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions/index.js";
import { createInterface } from "readline";

// ────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────

const API_ID = 33889652;
const API_HASH = "930501da71ffbf3fc54fdbb0a81a5c64";

// Parse args
const args = process.argv.slice(2);
const USE_TEST_DC = args.includes("--test");
const PHONE = args.find((a) => !a.startsWith("--"));

if (!PHONE) {
  process.stderr.write(
    [
      "Usage:",
      "  node scripts/test-telegram-auth.mjs +79671992211        # Production DC",
      "  node scripts/test-telegram-auth.mjs --test 9996621234   # Test DC",
      "",
      "Test phone format: 99966XYYYY  (X = DC number 1-3, YYYY = any 4 digits)",
      "Test login code:   XXXXX       (DC number repeated 5 times)",
      "  DC1: 99966XYYYY → code 11111",
      "  DC2: 99966XYYYY → code 22222",
      "  DC3: 99966XYYYY → code 33333",
      "",
    ].join("\n") + "\n"
  );
  process.exit(1);
}

// Detect test DC from phone number
const testDcId = USE_TEST_DC && PHONE.match(/^99966(\d)/) ? parseInt(PHONE[5], 10) : null;
const testCode = testDcId ? String(testDcId).repeat(5) : null;

console.log("═══════════════════════════════════════════════════════");
console.log("  TELEGRAM AUTH DIAGNOSTIC TOOL");
console.log("═══════════════════════════════════════════════════════");
console.log(`Phone:       ${PHONE}`);
console.log(`API ID:      ${API_ID}`);
console.log(`API Hash:    ${API_HASH.slice(0, 8)}...`);
console.log(`Mode:        ${USE_TEST_DC ? "🧪 TEST DC" : "🔴 PRODUCTION DC"}`);
if (testDcId) {
  console.log(`Test DC:     ${testDcId}`);
  console.log(`Test code:   ${testCode}`);
}
console.log(`Time:        ${new Date().toISOString()}`);
console.log(`Transport:   TCP`);
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
  const clientOpts = {
    connectionRetries: 5,
    deviceModel: "TG Corp Diagnostic",
    systemVersion: "Node.js",
    appVersion: "1.0-diag",
  };

  // For test DCs, we need to set testServers flag
  // GramJS doesn't have a simple testServers flag for TCP,
  // but we can manually set the DC after creating the session
  const session = new StringSession("");

  if (USE_TEST_DC && testDcId) {
    // Set session to test DC IP
    // Test DCs use the same IP 149.154.167.40 on port 80
    session.setDC(testDcId, "149.154.167.40", 80);
    console.log(`  Set session DC to test DC ${testDcId} (149.154.167.40:80)`);
  }

  const client = new TelegramClient(session, API_ID, API_HASH, clientOpts);

  // Step 1: Connect
  console.log("[2/5] Connecting to Telegram...");
  try {
    await client.connect();
    console.log("  ✅ Connected");
    console.log(`  DC: ${client.session.dcId}`);
    console.log(`  Server: ${client.session.serverAddress}`);
  } catch (err) {
    console.error("  ❌ Connection failed:", err.message);
    if (USE_TEST_DC) {
      console.error("  💡 Test DC connection failed. Try without --test flag first.");
    }
    process.exit(1);
  }

  // Step 2: Check for stale auth
  console.log("\n[3/5] Checking auth state...");
  try {
    const authorized = await client.checkAuthorization();
    console.log(`  Already authorized: ${authorized}`);
    if (authorized) {
      const me = await client.getMe();
      console.log(`  Logged in as: ${me.firstName} (@${me.username || "N/A"})`);
      console.log("  ⚠️  Already logged in — sendCode may behave differently");
    }
  } catch {
    console.log("  Not authorized (expected for fresh session)");
  }

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
      console.log(`\n  📡 Phone requires DC ${dc}. GramJS auto-migrating...`);

      // GramJS handles PHONE_MIGRATE automatically, but just in case
      // it didn't trigger the auto-retry, fall back to wrapper
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
      console.log("\n  🔄 AUTH_RESTART — retrying...");
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
    } else if (rpcErr.errorMessage === "PHONE_NUMBER_FLOOD") {
      console.error("\n  🚫 PHONE_NUMBER_FLOOD — Too many login attempts!");
      console.error("  You've exceeded the daily login limit (~5 per day).");
      console.error("  Wait until tomorrow or use test DCs:");
      console.error("    node scripts/test-telegram-auth.mjs --test 9996621234");
      await client.disconnect();
      process.exit(1);
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

  // Delivery analysis — handle both "SentCodeTypeApp" and "auth.SentCodeTypeApp" formats
  const typeKey = (type?.className || "").replace(/^auth\./, "");
  const nextTypeKey = (nextType?.className || "").replace(/^auth\./, "");
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

  const deliveryLabel = deliveryMap[typeKey] || `❓ Unknown (${type?.className})`;
  console.log(`\n  🚀 DELIVERY METHOD: ${deliveryLabel}`);

  if (typeKey === "SentCodeTypeApp") {
    console.log("\n  ℹ️  Code sent to Telegram app. User MUST have an active");
    console.log("     Telegram session on another device to receive it.");
    console.log("     If code doesn't arrive: Telegram may be silently rate-limiting.");
    console.log("     Daily limit: ~5 sendCode calls per phone number.");
  }

  if (nextTypeKey) {
    const nextLabel = deliveryMap[nextTypeKey] || nextType.className;
    console.log(`\n  ⏭  After ${timeout}s timeout, resend will use: ${nextLabel}`);
  } else {
    console.log("\n  ⚠️  nextType is NULL — no fallback delivery method!");
    console.log("     auth.ResendCode will fail with SEND_CODE_UNAVAILABLE.");
    console.log("     This is normal for 3rd-party API apps — SMS/call fallback");
    console.log("     is often restricted to official Telegram apps.");
  }

  // Check for isCodeViaApp (simplified response from client.sendCode)
  if (sentCode?.isCodeViaApp !== undefined) {
    console.log(`\n  ⚠️  isCodeViaApp: ${sentCode.isCodeViaApp} (simplified response detected)`);
  }

  console.log("═══════════════════════════════════════════════════════\n");

  // Step 5: Optionally try signing in
  let codePrompt = "Enter verification code (or 'q' to quit, 'r' to resend): ";
  if (testCode) {
    codePrompt = `Enter verification code [test code: ${testCode}] (or 'q' to quit, 'r' to resend): `;
  }

  const proceed = await ask(codePrompt);

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
      if (err.errorMessage === "SEND_CODE_UNAVAILABLE") {
        console.error("\n  This is expected when nextType is null.");
        console.error("  No alternative delivery method is available.");
      }
    }
    await client.disconnect();
    process.exit(0);
  }

  // Try signing in
  const code = proceed || testCode;
  console.log(`\nSigning in with code: ${code}`);
  try {
    const signInResult = await client.invoke(
      new Api.auth.SignIn({
        phoneNumber: PHONE,
        phoneCodeHash: hash,
        phoneCode: code,
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
      if (USE_TEST_DC && testCode) {
        console.error(`   Expected test code: ${testCode}`);
        console.error(`   Try also: ${String(testDcId).repeat(6)} (6 digits)`);
      }
    } else if (rpcErr.errorMessage === "PHONE_CODE_EXPIRED") {
      console.error("❌ Code expired — re-run the script to request a new one");
    } else if (rpcErr.errorMessage === "PHONE_NUMBER_UNOCCUPIED") {
      console.log("📋 Phone not registered — this is a new test account");
      console.log("   Calling auth.SignUp to register...");
      try {
        const signUpResult = await client.invoke(
          new Api.auth.SignUp({
            phoneNumber: PHONE,
            phoneCodeHash: hash,
            firstName: "Test",
            lastName: "User",
          })
        );
        console.log("✅ Sign up successful!");
        inspectTL(signUpResult);
      } catch (signUpErr) {
        console.error("❌ Sign up failed:", signUpErr.message);
      }
    } else {
      console.error("❌ Sign in failed:", err.message, rpcErr.errorMessage || "");
    }
  }

  // Get user info
  try {
    const me = await client.getMe();
    console.log("\n✅ Logged in as:", me.firstName, me.lastName || "", `(@${me.username || "N/A"})`);
    console.log("   Session string:", client.session.save());
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
