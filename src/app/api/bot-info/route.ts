import { NextResponse } from "next/server";

/**
 * GET /api/bot-info
 * Returns the corporate bot's username and ID.
 * Used by client to invite the bot to newly created work groups/channels.
 * Public endpoint — bot username/ID are not sensitive.
 */

let cachedBotInfo: { username: string; id: number } | null = null;

export async function GET() {
  if (cachedBotInfo) {
    return NextResponse.json(cachedBotInfo);
  }

  const botToken = process.env.ADMIN_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json(
      { error: "ADMIN_BOT_TOKEN not configured" },
      { status: 500 }
    );
  }

  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`
    );
    const data = await res.json();

    if (!data.ok || !data.result) {
      return NextResponse.json(
        { error: "Failed to get bot info from Telegram" },
        { status: 500 }
      );
    }

    cachedBotInfo = {
      username: data.result.username,
      id: data.result.id,
    };

    return NextResponse.json(cachedBotInfo);
  } catch (err) {
    console.error("[bot-info] Failed:", err);
    return NextResponse.json(
      { error: "Failed to fetch bot info" },
      { status: 500 }
    );
  }
}
