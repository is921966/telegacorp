"""
Pattern Miner — discovers automation patterns from classified messages.

Pattern types:
1. Temporal patterns: same action at same time repeatedly
2. Sequence patterns: predictable chains (A→B→C)
3. Bottleneck patterns: requests waiting for manual processing
"""

import os
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Optional
import httpx
import yaml


class PatternMiner:
    def __init__(self, config_path: str = "config.yaml"):
        with open(config_path) as f:
            cfg = yaml.safe_load(f)

        self.min_frequency = cfg["pattern_miner"]["min_frequency"]
        self.lookback_days = cfg["pattern_miner"]["lookback_days"]
        self.min_confidence = cfg["pattern_miner"]["min_confidence"]
        self.hourly_rate = cfg["pattern_miner"]["hourly_rate_usd"]
        self.supabase_url = os.getenv("SUPABASE_URL", "")
        self.supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

    def analyze_messages(
        self,
        messages: list[dict],
    ) -> list[dict]:
        """
        Analyze a batch of classified messages for automation patterns.
        Returns list of discovered patterns.
        """
        # Group by intent + chat for pattern detection
        patterns = []

        # 1. Temporal patterns
        temporal = self._find_temporal_patterns(messages)
        patterns.extend(temporal)

        # 2. Sequence patterns
        sequences = self._find_sequence_patterns(messages)
        patterns.extend(sequences)

        # 3. Manual routine patterns
        routines = self._find_routine_patterns(messages)
        patterns.extend(routines)

        return patterns

    def _find_temporal_patterns(
        self, messages: list[dict]
    ) -> list[dict]:
        """Find actions that repeat at the same time/day."""
        patterns = []

        # Group by (chat_id, intent, day_of_week, hour)
        temporal_groups: dict[tuple, list] = defaultdict(list)
        for msg in messages:
            if msg.get("intent") not in ("task", "data_request", "manual_routine"):
                continue

            try:
                dt = datetime.fromisoformat(msg["date"].replace("Z", "+00:00"))
                key = (msg["chat_id"], msg["intent"], dt.weekday(), dt.hour)
                temporal_groups[key].append(msg)
            except (ValueError, KeyError):
                continue

        for key, group in temporal_groups.items():
            if len(group) >= self.min_frequency:
                chat_id, intent, weekday, hour = key
                days_map = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

                participants = list(set(m.get("sender_id", "") for m in group))
                avg_duration = 5  # Estimated minutes per occurrence

                patterns.append({
                    "description": f"Повторяющийся {intent} в {days_map[weekday]} ~{hour}:00 (чат {chat_id})",
                    "frequency": f"{days_map[weekday]} {hour}:00",
                    "avg_duration_minutes": avg_duration,
                    "participants": [int(p) for p in participants if p.lstrip("-").isdigit()],
                    "sample_messages": [
                        {"text": m.get("text", "")[:200], "date": m.get("date", "")}
                        for m in group[:3]
                    ],
                    "estimated_roi_monthly": self._estimate_roi(
                        len(group), avg_duration
                    ),
                    "confidence": min(len(group) / 10, 0.95),
                })

        return patterns

    def _find_sequence_patterns(
        self, messages: list[dict]
    ) -> list[dict]:
        """Find predictable message sequences (A→B→C)."""
        patterns = []

        # Sort by chat and time
        by_chat: dict[str, list] = defaultdict(list)
        for msg in messages:
            by_chat[msg.get("chat_id", "")].append(msg)

        for chat_id, chat_msgs in by_chat.items():
            chat_msgs.sort(key=lambda m: m.get("date", ""))

            # Look for repeated intent sequences of length 2-3
            intent_sequence = [m.get("intent", "") for m in chat_msgs]
            seq_counts: dict[tuple, int] = defaultdict(int)

            for i in range(len(intent_sequence) - 1):
                pair = (intent_sequence[i], intent_sequence[i + 1])
                seq_counts[pair] += 1

            for seq, count in seq_counts.items():
                if count >= self.min_frequency and "manual_routine" in seq:
                    patterns.append({
                        "description": f"Последовательность {seq[0]}→{seq[1]} повторяется {count} раз (чат {chat_id})",
                        "frequency": f"{count} раз за период",
                        "avg_duration_minutes": 10,
                        "participants": [],
                        "sample_messages": [],
                        "estimated_roi_monthly": self._estimate_roi(count, 10),
                        "confidence": min(count / 15, 0.9),
                    })

        return patterns

    def _find_routine_patterns(
        self, messages: list[dict]
    ) -> list[dict]:
        """Find explicit manual_routine intents."""
        patterns = []

        routine_msgs = [m for m in messages if m.get("intent") == "manual_routine"]
        if len(routine_msgs) < self.min_frequency:
            return patterns

        # Group by chat
        by_chat: dict[str, list] = defaultdict(list)
        for msg in routine_msgs:
            by_chat[msg.get("chat_id", "")].append(msg)

        for chat_id, chat_msgs in by_chat.items():
            if len(chat_msgs) < self.min_frequency:
                continue

            participants = list(set(
                int(m.get("sender_id", "0"))
                for m in chat_msgs
                if m.get("sender_id", "").lstrip("-").isdigit()
            ))

            patterns.append({
                "description": f"Ручная рутина в чате {chat_id}: {len(chat_msgs)} сообщений",
                "frequency": f"{len(chat_msgs)} за {self.lookback_days} дн.",
                "avg_duration_minutes": 15,
                "participants": participants,
                "sample_messages": [
                    {"text": m.get("text", "")[:200], "date": m.get("date", "")}
                    for m in chat_msgs[:5]
                ],
                "estimated_roi_monthly": self._estimate_roi(
                    len(chat_msgs), 15
                ),
                "confidence": min(len(chat_msgs) / 20, 0.85),
            })

        return patterns

    def _estimate_roi(
        self, frequency: int, avg_duration_min: int
    ) -> float:
        """
        ROI = (frequency * avg_time * hourly_rate) - agent_cost
        Returns monthly estimate in USD.
        """
        monthly_frequency = frequency * (30 / self.lookback_days)
        hours_saved = (monthly_frequency * avg_duration_min) / 60
        human_cost = hours_saved * self.hourly_rate
        agent_cost = monthly_frequency * 0.02  # ~$0.02 per LLM call
        return round(max(0, human_cost - agent_cost), 2)

    async def save_pattern(self, pattern: dict) -> Optional[str]:
        """Save discovered pattern to Supabase."""
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{self.supabase_url}/rest/v1/automation_patterns",
                headers={
                    "apikey": self.supabase_key,
                    "Authorization": f"Bearer {self.supabase_key}",
                    "Content-Type": "application/json",
                    "Prefer": "return=representation",
                },
                json={
                    "description": pattern["description"],
                    "frequency": pattern.get("frequency"),
                    "avg_duration_minutes": pattern.get("avg_duration_minutes"),
                    "participants": pattern.get("participants", []),
                    "sample_messages": pattern.get("sample_messages"),
                    "estimated_roi_monthly": pattern.get("estimated_roi_monthly"),
                    "confidence": pattern.get("confidence"),
                    "status": "new",
                },
            )

            if res.status_code in (200, 201):
                data = res.json()
                if isinstance(data, list) and data:
                    return data[0].get("id")
            else:
                print(f"[PatternMiner] Failed to save pattern: {res.status_code}")
            return None
