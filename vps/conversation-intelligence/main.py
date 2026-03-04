"""
Conversation Intelligence Layer — Main Consumer

Reads messages from Redis Stream (corp:messages), processes them through:
1. Intent Classification (GPT-4o-mini)
2. Embedding Generation (sentence-transformers → Qdrant)
3. Interaction Graph Update
4. Pattern Mining

Discovered patterns are saved to Supabase (automation_patterns table).
"""

import asyncio
import json
import os
import signal
import sys
from datetime import datetime

import redis
import yaml

from intent_classifier import IntentClassifier
from embeddings import MessageEmbeddings
from interaction_graph import InteractionGraph
from pattern_miner import PatternMiner
from roi_estimator import ROIEstimator


def load_config() -> dict:
    with open("config.yaml") as f:
        return yaml.safe_load(f)


class ConversationIntelligence:
    def __init__(self):
        self.cfg = load_config()
        self.running = True

        # Redis connection
        redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
        self.redis = redis.from_url(redis_url, decode_responses=True)

        # Components
        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        self.classifier = IntentClassifier(
            model=self.cfg["intent_classifier"]["model"]
        )
        self.embeddings = MessageEmbeddings(
            qdrant_url=qdrant_url,
            collection_name=self.cfg["qdrant"]["collection_name"],
            model_name=self.cfg["embeddings"]["model"],
            embedding_dim=self.cfg["qdrant"]["embedding_dim"],
        )
        self.graph = InteractionGraph()
        self.miner = PatternMiner()
        self.roi = ROIEstimator(
            hourly_rate_usd=self.cfg["pattern_miner"]["hourly_rate_usd"]
        )

        # Stream config
        self.stream_key = self.cfg["redis"]["stream_key"]
        self.group_name = os.getenv(
            "CI_CONSUMER_GROUP", self.cfg["redis"]["consumer_group"]
        )
        self.consumer_name = os.getenv(
            "CI_CONSUMER_NAME", self.cfg["redis"]["consumer_name"]
        )
        self.batch_size = int(
            os.getenv("CI_BATCH_SIZE", str(self.cfg["redis"]["batch_size"]))
        )
        self.block_ms = int(
            os.getenv("CI_BLOCK_MS", str(self.cfg["redis"]["block_ms"]))
        )

        # Accumulator for pattern analysis
        self._message_buffer: list[dict] = []
        self._buffer_limit = 100
        self._processed_count = 0

    def _ensure_consumer_group(self) -> None:
        """Create consumer group if it doesn't exist."""
        try:
            self.redis.xgroup_create(
                self.stream_key,
                self.group_name,
                id="0",
                mkstream=True,
            )
            print(f"[Consumer] Created group: {self.group_name}")
        except redis.ResponseError as e:
            if "BUSYGROUP" in str(e):
                pass  # Group already exists
            else:
                raise

    def _process_message(self, msg_id: str, fields: dict) -> None:
        """Process a single message through the CI pipeline."""
        text = fields.get("text", "")
        chat_id = fields.get("chat_id", "")
        sender_id = fields.get("sender_id", "")
        message_id = fields.get("message_id", "")
        date = fields.get("date", "")
        reply_to = fields.get("reply_to_msg_id", "")

        # 1. Classify intent
        intent, confidence = self.classifier.classify(text)

        # 2. Embed message in Qdrant
        if text and len(text.strip()) >= 3:
            self.embeddings.embed_message(
                text=text,
                metadata={
                    "chat_id": chat_id,
                    "sender_id": sender_id,
                    "message_id": message_id,
                    "date": date,
                    "intent": intent,
                    "confidence": confidence,
                },
            )

        # 3. Update interaction graph
        self.graph.add_interaction(
            sender_id=sender_id,
            chat_id=chat_id,
            reply_to_sender=None,  # Would need lookup for reply-to sender
        )

        # 4. Add to pattern analysis buffer
        self._message_buffer.append({
            "chat_id": chat_id,
            "sender_id": sender_id,
            "text": text,
            "date": date,
            "intent": intent,
            "confidence": confidence,
        })

        self._processed_count += 1

        # Log high-confidence manual routines
        if intent == "manual_routine" and confidence >= 0.7:
            print(
                f"[CI] 🔍 Manual routine detected (conf={confidence:.2f}): "
                f"{text[:80]}..."
            )

    async def _analyze_patterns(self) -> None:
        """Run pattern analysis on accumulated messages."""
        if len(self._message_buffer) < self._buffer_limit:
            return

        print(f"[CI] Analyzing {len(self._message_buffer)} buffered messages...")

        patterns = self.miner.analyze_messages(self._message_buffer)

        for pattern in patterns:
            if pattern.get("confidence", 0) >= self.cfg["pattern_miner"]["min_confidence"]:
                pattern_id = await self.miner.save_pattern(pattern)
                if pattern_id:
                    print(
                        f"[CI] ✅ New pattern saved: {pattern['description'][:60]}... "
                        f"(ROI: ${pattern.get('estimated_roi_monthly', 0):.0f}/mo)"
                    )

        # Clear buffer
        self._message_buffer = []

    def run(self) -> None:
        """Main consumer loop."""
        print("=== Conversation Intelligence Layer ===")
        print(f"Stream: {self.stream_key}")
        print(f"Group: {self.group_name} / Consumer: {self.consumer_name}")

        self._ensure_consumer_group()

        # Signal handling for graceful shutdown
        def shutdown(signum, frame):
            print(f"\n[CI] Received signal {signum}, shutting down...")
            self.running = False

        signal.signal(signal.SIGINT, shutdown)
        signal.signal(signal.SIGTERM, shutdown)

        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        while self.running:
            try:
                # Read from stream
                messages = self.redis.xreadgroup(
                    groupname=self.group_name,
                    consumername=self.consumer_name,
                    streams={self.stream_key: ">"},
                    count=self.batch_size,
                    block=self.block_ms,
                )

                if not messages:
                    continue

                for stream_name, msg_list in messages:
                    for msg_id, fields in msg_list:
                        try:
                            self._process_message(msg_id, fields)
                            # Acknowledge the message
                            self.redis.xack(
                                self.stream_key, self.group_name, msg_id
                            )
                        except Exception as e:
                            print(f"[CI] Error processing {msg_id}: {e}")

                # Periodically analyze patterns
                loop.run_until_complete(self._analyze_patterns())

            except redis.ConnectionError as e:
                print(f"[CI] Redis connection error: {e}")
                import time
                time.sleep(5)
            except Exception as e:
                print(f"[CI] Unexpected error: {e}")
                import time
                time.sleep(1)

        # Final stats
        print(f"\n[CI] Processed {self._processed_count} messages total")
        graph_stats = self.graph.get_stats()
        print(f"[CI] Graph: {graph_stats['nodes']} nodes, {graph_stats['edges']} edges")

        loop.close()


if __name__ == "__main__":
    ci = ConversationIntelligence()
    ci.run()
