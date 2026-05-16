import { createFileRoute } from "@tanstack/react-router";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";

export const Route = createFileRoute("/dashboard/rules")({
  component: () => (
    <DashboardPlaceholder
      title="Rules"
      description="Atur mapping source ke target, mode forward, filter, transformasi, prioritas, dan rate limit."
      nextAction="Add rule editor"
      metrics={[
        { label: "Forward rules", table: "tg_rules" },
        { label: "Rate buckets", table: "tg_rate_buckets" },
      ]}
    />
  ),
});
