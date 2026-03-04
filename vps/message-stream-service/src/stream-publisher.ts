import Redis from "ioredis";
import { config } from "./config";

export interface StreamMessage {
  chat_id: string;
  message_id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  date: string; // ISO 8601
  media_type: string | null;
  reply_to_msg_id: string | null;
  forward_from: string | null;
  is_edit: boolean;
  raw_entities: string; // JSON serialized
}

/**
 * Redis Stream publisher.
 * Publishes normalized Telegram messages to `corp:messages` stream.
 */
export class StreamPublisher {
  private redis: Redis;
  private streamKey: string;

  constructor() {
    this.redis = new Redis(config.redis.url);
    this.streamKey = config.redis.streamKey;
  }

  /**
   * Publish a message to the Redis Stream.
   * Uses XADD with MAXLEN ~ to auto-trim the stream.
   */
  async publish(msg: StreamMessage): Promise<string> {
    const fields: string[] = [];
    for (const [key, value] of Object.entries(msg)) {
      fields.push(key, value === null ? "" : String(value));
    }

    const id = await this.redis.xadd(
      this.streamKey,
      "MAXLEN",
      "~",
      String(config.redis.maxLen),
      "*",
      ...fields
    );

    return id;
  }

  /**
   * Publish a batch of messages using a Redis pipeline.
   */
  async publishBatch(messages: StreamMessage[]): Promise<void> {
    const pipeline = this.redis.pipeline();

    for (const msg of messages) {
      const fields: string[] = [];
      for (const [key, value] of Object.entries(msg)) {
        fields.push(key, value === null ? "" : String(value));
      }

      pipeline.xadd(
        this.streamKey,
        "MAXLEN",
        "~",
        String(config.redis.maxLen),
        "*",
        ...fields
      );
    }

    await pipeline.exec();
  }

  /**
   * Get stream info (length, etc.)
   */
  async getStreamLength(): Promise<number> {
    return this.redis.xlen(this.streamKey);
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}
