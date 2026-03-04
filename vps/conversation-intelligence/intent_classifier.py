"""
Intent Classifier — categorizes incoming messages using GPT-4o-mini.

Categories:
  - question: asking for information
  - task: assigning or requesting a task
  - data_request: asking for specific data/report
  - coordination: scheduling, meetings, approvals
  - complaint: issues, bugs, dissatisfaction
  - manual_routine: repetitive manual processes
  - small_talk: greetings, casual chat
"""

import json
import os
from typing import Optional
from openai import OpenAI

CATEGORIES = [
    "question",
    "task",
    "data_request",
    "coordination",
    "complaint",
    "manual_routine",
    "small_talk",
]

SYSTEM_PROMPT = """You are a message intent classifier for a corporate Telegram workspace.
Classify each message into exactly one category.
Reply with JSON: {"intent": "<category>", "confidence": <0.0-1.0>}

Categories:
- question: asking for information or clarification
- task: assigning, requesting, or reporting on a task
- data_request: asking for specific data, reports, or metrics
- coordination: scheduling, meetings, approvals, handoffs
- complaint: issues, bugs, problems, dissatisfaction
- manual_routine: repetitive manual processes that could be automated
- small_talk: greetings, casual chat, non-work messages

Focus on identifying "manual_routine" — these are messages where someone
is performing a repetitive task (e.g., "updating the spreadsheet again",
"forwarding this report like every Monday", "manually checking all orders").
"""


class IntentClassifier:
    def __init__(self, model: str = "gpt-4o-mini"):
        self.client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        self.model = model

    def classify(self, text: str) -> tuple[str, float]:
        """
        Classify a message text into an intent category.
        Returns (intent, confidence).
        """
        if not text or len(text.strip()) < 3:
            return "small_talk", 0.1

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": text[:500]},  # Truncate long messages
                ],
                temperature=0,
                max_tokens=50,
                response_format={"type": "json_object"},
            )

            content = response.choices[0].message.content or "{}"
            result = json.loads(content)

            intent = result.get("intent", "small_talk")
            confidence = float(result.get("confidence", 0.5))

            # Validate category
            if intent not in CATEGORIES:
                intent = "small_talk"
                confidence = 0.1

            return intent, confidence

        except Exception as e:
            print(f"[IntentClassifier] Error: {e}")
            return "small_talk", 0.0

    def classify_batch(
        self, texts: list[str]
    ) -> list[tuple[str, float]]:
        """Classify multiple texts (sequential for simplicity)."""
        return [self.classify(text) for text in texts]
