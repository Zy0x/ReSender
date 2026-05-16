import { createFileRoute } from "@tanstack/react-router";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";

export const Route = createFileRoute("/dashboard/settings")({
  component: () => (
    <DashboardPlaceholder
      title="Settings"
      description="Lihat status runtime, webhook URL, admin web, admin Telegram, health check, dan konfigurasi aman tanpa membuka secret."
      nextAction="Set Telegram admin IDs"
      metrics={[
        { label: "Admin users", table: "app_users" },
        { label: "Telegram admins", table: "tg_admins" },
      ]}
    />
  ),
});
