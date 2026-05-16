import { createFileRoute } from "@tanstack/react-router";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";

export const Route = createFileRoute("/dashboard/queue")({
  component: () => (
    <DashboardPlaceholder
      title="Queue"
      description="Pantau pesan pending, failed, sent, dropped, retry/backoff, dan recovery row processing yang macet."
      nextAction="Add guarded retry controls"
      metrics={[{ label: "Forward queue", table: "tg_forward_queue" }]}
    />
  ),
});
