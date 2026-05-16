import { createFileRoute } from "@tanstack/react-router";
import { DashboardPlaceholder } from "@/components/dashboard-placeholder";

export const Route = createFileRoute("/dashboard/sources")({
  component: () => (
    <DashboardPlaceholder
      title="Sources"
      description="Kelola chat, grup, supergroup, channel, dan bot/chat update yang menjadi asal pesan Telegram."
      nextAction="Add source CRUD"
      metrics={[{ label: "Source registry", table: "tg_sources" }]}
    />
  ),
});
