import { createFileRoute } from "@tanstack/react-router";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";

export const Route = createFileRoute("/dashboard/logs")({
  component: () => (
    <DashboardPlaceholder
      title="Logs"
      description="Audit update Telegram, hasil dedupe, event forward, dan perubahan konfigurasi admin."
      nextAction="Add log filters"
      metrics={[
        { label: "Message log", table: "tg_message_log" },
        { label: "Audit log", table: "tg_audit_log" },
      ]}
    />
  ),
});
