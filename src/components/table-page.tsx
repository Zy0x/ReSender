import { useEffect, useState } from "react";
import { supabase } from "@/lib/tg/client";
import { Button } from "@/components/ui/button";

export function TablePage({ title, table, columns, orderBy = "created_at", desc = true, limit = 100 }: {
  title: string; table: string; columns: string[]; orderBy?: string; desc?: boolean; limit?: number;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const reload = async () => {
    const { data, error } = await supabase.from(table).select("*").order(orderBy, { ascending: !desc }).limit(limit);
    if (error) setErr(error.message); else { setRows(data ?? []); setErr(null); }
  };
  useEffect(() => { reload(); }, [table]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <Button variant="outline" size="sm" onClick={reload}>Refresh</Button>
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="border border-border rounded-lg overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted/50">
            <tr>{columns.map(c => <th key={c} className="text-left p-2 font-medium">{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-border">
                {columns.map(c => (
                  <td key={c} className="p-2 align-top max-w-xs truncate">
                    {typeof r[c] === "object" ? JSON.stringify(r[c]) : String(r[c] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={columns.length} className="p-4 text-center text-muted-foreground">Belum ada data</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground">
        Tip: edit/insert lewat perintah Telegram (/addsource, /addrule, dll.) atau langsung di Supabase Table Editor.
      </p>
    </div>
  );
}