"""
Interaction Graph — models employee communication patterns.

Nodes: employees (sender_id)
Edges: interactions (weighted by message count + response patterns)

Used for:
- Identifying bottleneck nodes (high betweenness centrality)
- Detecting clusters / teams
- Finding information flow patterns
"""

from collections import defaultdict
from typing import Optional
import networkx as nx


class InteractionGraph:
    def __init__(self):
        self.graph = nx.DiGraph()
        self._interaction_counts: dict[tuple[str, str], int] = defaultdict(int)

    def add_interaction(
        self,
        sender_id: str,
        chat_id: str,
        reply_to_sender: Optional[str] = None,
    ) -> None:
        """
        Record an interaction.
        If reply_to_sender is set, creates a directed edge.
        Otherwise, broadcasts to all known participants in the chat.
        """
        if not sender_id:
            return

        # Ensure node exists
        if not self.graph.has_node(sender_id):
            self.graph.add_node(sender_id, chats=set(), message_count=0)

        self.graph.nodes[sender_id]["chats"].add(chat_id)
        self.graph.nodes[sender_id]["message_count"] = (
            self.graph.nodes[sender_id].get("message_count", 0) + 1
        )

        if reply_to_sender and reply_to_sender != sender_id:
            # Direct reply → strong signal
            key = (sender_id, reply_to_sender)
            self._interaction_counts[key] += 1

            if self.graph.has_edge(sender_id, reply_to_sender):
                self.graph[sender_id][reply_to_sender]["weight"] += 1
            else:
                self.graph.add_edge(
                    sender_id,
                    reply_to_sender,
                    weight=1,
                    chat_ids={chat_id},
                )

            # Also add reverse edge (communication is bidirectional)
            edge_data = self.graph.get_edge_data(sender_id, reply_to_sender)
            if edge_data:
                edge_data.get("chat_ids", set()).add(chat_id)

    def get_bottleneck_nodes(self, top_n: int = 5) -> list[dict]:
        """
        Find bottleneck nodes — high betweenness centrality.
        These are people through whom much communication flows.
        """
        if len(self.graph.nodes) < 3:
            return []

        centrality = nx.betweenness_centrality(
            self.graph, weight="weight"
        )

        sorted_nodes = sorted(
            centrality.items(), key=lambda x: x[1], reverse=True
        )

        return [
            {
                "user_id": node_id,
                "centrality": round(score, 4),
                "message_count": self.graph.nodes[node_id].get(
                    "message_count", 0
                ),
                "chat_count": len(
                    self.graph.nodes[node_id].get("chats", set())
                ),
            }
            for node_id, score in sorted_nodes[:top_n]
        ]

    def get_clusters(self) -> list[set[str]]:
        """Find communication clusters (communities)."""
        if len(self.graph.nodes) < 3:
            return []

        # Convert to undirected for community detection
        undirected = self.graph.to_undirected()

        try:
            communities = nx.community.greedy_modularity_communities(
                undirected
            )
            return [set(c) for c in communities]
        except Exception:
            return []

    def get_stats(self) -> dict:
        """Return graph statistics."""
        return {
            "nodes": len(self.graph.nodes),
            "edges": len(self.graph.edges),
            "density": round(nx.density(self.graph), 4)
            if len(self.graph.nodes) > 1
            else 0,
            "bottlenecks": self.get_bottleneck_nodes(3),
        }

    def to_dict(self) -> dict:
        """Serialize the graph for storage."""
        nodes = []
        for node_id, data in self.graph.nodes(data=True):
            nodes.append({
                "id": node_id,
                "message_count": data.get("message_count", 0),
                "chat_count": len(data.get("chats", set())),
            })

        edges = []
        for u, v, data in self.graph.edges(data=True):
            edges.append({
                "source": u,
                "target": v,
                "weight": data.get("weight", 1),
            })

        return {"nodes": nodes, "edges": edges}
