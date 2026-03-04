"""
ROI Estimator — calculates return on investment for automating a pattern.

Formula: ROI = (frequency * avg_time * hourly_rate) - agent_cost
"""


class ROIEstimator:
    def __init__(
        self,
        hourly_rate_usd: float = 25.0,
        cost_per_llm_call_usd: float = 0.02,
        monthly_infra_cost_usd: float = 5.0,
    ):
        self.hourly_rate = hourly_rate_usd
        self.cost_per_call = cost_per_llm_call_usd
        self.monthly_infra = monthly_infra_cost_usd

    def estimate_monthly(
        self,
        frequency_per_period: int,
        period_days: int,
        avg_duration_minutes: int,
        calls_per_execution: int = 1,
    ) -> dict:
        """
        Estimate monthly ROI for automating a pattern.

        Args:
            frequency_per_period: How many times the pattern occurs in period
            period_days: Length of observation period in days
            avg_duration_minutes: Average time per manual occurrence
            calls_per_execution: LLM API calls per automated execution

        Returns:
            Dict with monthly estimates
        """
        # Scale to monthly
        monthly_frequency = frequency_per_period * (30 / max(period_days, 1))

        # Human cost saved
        hours_saved = (monthly_frequency * avg_duration_minutes) / 60
        human_cost_saved = hours_saved * self.hourly_rate

        # Agent cost
        llm_cost = monthly_frequency * calls_per_execution * self.cost_per_call
        total_agent_cost = llm_cost + self.monthly_infra

        # Net ROI
        net_roi = human_cost_saved - total_agent_cost

        return {
            "monthly_frequency": round(monthly_frequency, 1),
            "hours_saved_monthly": round(hours_saved, 1),
            "human_cost_saved_usd": round(human_cost_saved, 2),
            "agent_cost_usd": round(total_agent_cost, 2),
            "net_roi_monthly_usd": round(net_roi, 2),
            "payback_positive": net_roi > 0,
            "roi_percentage": round(
                (net_roi / total_agent_cost * 100) if total_agent_cost > 0 else 0, 1
            ),
        }

    def should_automate(
        self,
        frequency: int,
        period_days: int,
        avg_duration_minutes: int,
        min_roi_usd: float = 10.0,
    ) -> bool:
        """Check if automation is worth it based on minimum ROI threshold."""
        estimate = self.estimate_monthly(
            frequency, period_days, avg_duration_minutes
        )
        return estimate["net_roi_monthly_usd"] >= min_roi_usd
