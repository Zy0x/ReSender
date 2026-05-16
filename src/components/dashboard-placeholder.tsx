type PlaceholderMetric = {
  label: string;
  table: string;
};

export function DashboardPlaceholder({
  title,
  description,
  metrics,
  nextAction,
}: {
  title: string;
  description: string;
  metrics?: PlaceholderMetric[];
  nextAction: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{description}</p>
      </div>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase text-muted-foreground">Status</div>
          <div className="mt-2 text-sm font-medium">Foundation ready</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Route tersedia agar dashboard tidak jatuh ke 404 saat fitur CRUD belum lengkap.
          </p>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase text-muted-foreground">Access</div>
          <div className="mt-2 text-sm font-medium">Supabase RLS</div>
          <p className="mt-1 text-xs text-muted-foreground">
            Data tetap dibatasi oleh session Supabase dan policy admin di database.
          </p>
        </div>
        <div className="border border-border bg-card p-4">
          <div className="text-xs font-medium uppercase text-muted-foreground">Next</div>
          <div className="mt-2 text-sm font-medium">{nextAction}</div>
        </div>
      </section>

      {metrics?.length ? (
        <section className="border border-border bg-card">
          <div className="border-b border-border px-4 py-3 text-sm font-medium">Primary tables</div>
          <div className="divide-y divide-border">
            {metrics.map((metric) => (
              <div
                key={metric.table}
                className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <span>{metric.label}</span>
                <code className="truncate text-xs text-muted-foreground">{metric.table}</code>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
