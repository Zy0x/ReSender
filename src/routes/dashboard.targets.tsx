import { createFileRoute } from "@tanstack/react-router";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";

export const Route = createFileRoute("/dashboard/targets")({
  component: () => (
    <DashboardPlaceholder
      title="Targets"
      description="Kelola chat, grup, supergroup, atau channel tujuan yang akan menerima hasil forward."
      nextAction="Add target CRUD"
      metrics={[{ label: "Target registry", table: "tg_targets" }]}
    />
  ),
});
