import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Loader2, Plus, ShieldAlert, Gift,
  CheckCircle2, Clock, Trash2
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useRoles, useSession } from "@/lib/use-auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/vouchers-admin")({
  head: () => ({ meta: [{ title: "Voucher admin — Kikabila" }] }),
  component: VoucherAdmin,
});

const NETWORKS = ["Tigo", "Airtel", "Vodacom", "Halotel"] as const;
type Network = typeof NETWORKS[number];

const NETWORK_COLORS: Record<Network, string> = {
  Tigo:     "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Airtel:   "bg-red-500/15 text-red-400 border-red-500/30",
  Vodacom:  "bg-red-600/15 text-red-300 border-red-600/30",
  Halotel:  "bg-orange-500/15 text-orange-400 border-orange-500/30",
};

function NetworkBadge({ network }: { network: string }) {
  const cls = NETWORK_COLORS[network as Network] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${cls}`}>
      {network}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "available")
    return <span className="flex items-center gap-1 text-xs text-accent"><Clock size={11} /> Available</span>;
  if (status === "claimed")
    return <span className="flex items-center gap-1 text-xs text-primary"><CheckCircle2 size={11} /> Claimed</span>;
  return <span className="text-xs text-muted-foreground">{status}</span>;
}

function VoucherAdmin() {
  const { user, ready } = useSession();
  const { data: roles } = useRoles(user?.id);
  const isAdmin = !!roles?.some((r) => r === "admin");
  const qc = useQueryClient();

  // ── Upload form state ──
  const [network, setNetwork] = useState<Network>("Tigo");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkMode, setBulkMode] = useState(false);

  // ── Queries ──
  const stats = useQuery({
    queryKey: ["voucher-stats"],
    enabled: isAdmin,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("voucher_stats" as any);
      if (error) throw error;
      return data as { total: number; available: number; claimed: number; expired: number };
    },
  });

  const vouchers = useQuery({
    queryKey: ["vouchers-list"],
    enabled: isAdmin,
    staleTime: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vouchers")
        .select("id, network, code, face_value, status, claimed_at, created_at")
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const milestones = useQuery({
    queryKey: ["reward-milestones"],
    enabled: isAdmin,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reward_milestones")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  async function uploadSingle() {
    if (!code.trim()) return;
    setBusy(true);
    const { error } = await supabase.from("vouchers").insert({
      network,
      code: code.trim(),
      face_value: 500,
      uploaded_by: user!.id,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${network} voucher uploaded`);
    setCode("");
    qc.invalidateQueries({ queryKey: ["vouchers-list"] });
    qc.invalidateQueries({ queryKey: ["voucher-stats"] });
  }

  async function uploadBulk() {
    // Format: one per line — "Tigo:123456789012" or "Airtel:987654321098"
    const lines = bulkText.trim().split("\n").map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBusy(true);
    const rows = lines.map((line) => {
      const [net, ...rest] = line.split(":");
      const vcode = rest.join(":").trim();
      return { network: net.trim(), code: vcode, face_value: 500, uploaded_by: user!.id };
    }).filter((r) => NETWORKS.includes(r.network as Network) && r.code);

    if (rows.length !== lines.length) {
      toast.error(`${lines.length - rows.length} lines had invalid format. Expected "Network:Code"`);
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("vouchers").insert(rows as any);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`${rows.length} vouchers uploaded`);
    setBulkText("");
    qc.invalidateQueries({ queryKey: ["vouchers-list"] });
    qc.invalidateQueries({ queryKey: ["voucher-stats"] });
  }

  async function deleteVoucher(id: string, status: string) {
    if (status === "claimed") { toast.error("Cannot delete a claimed voucher"); return; }
    const { error } = await supabase.from("vouchers").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Voucher deleted");
    qc.invalidateQueries({ queryKey: ["vouchers-list"] });
    qc.invalidateQueries({ queryKey: ["voucher-stats"] });
  }

  if (!ready) {
    return <main className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-muted-foreground" /></main>;
  }

  if (!user || !isAdmin) {
    return (
      <main className="mx-auto max-w-md px-4 py-20 text-center">
        <ShieldAlert size={32} className="mx-auto text-destructive" />
        <h1 className="mt-4 font-display text-2xl">Admin access required</h1>
        <p className="mt-2 text-sm text-muted-foreground">Only admins can access the voucher panel.</p>
      </main>
    );
  }

  const s = stats.data;

  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <div className="flex items-center gap-3">
        <Gift size={22} className="text-accent" />
        <h1 className="font-display text-3xl text-primary">Voucher Admin</h1>
      </div>

      {/* ── Stats bar ── */}
      {s && (
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Total", value: s.total, color: "text-foreground" },
            { label: "Available", value: s.available, color: "text-accent" },
            { label: "Claimed", value: s.claimed, color: "text-primary" },
            { label: "Expired", value: s.expired, color: "text-muted-foreground" },
          ].map((stat) => (
            <Card key={stat.label} className="p-4 text-center">
              <p className={`font-display text-3xl tabular-nums ${stat.color}`}>{stat.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{stat.label}</p>
            </Card>
          ))}
        </div>
      )}

      {/* ── Upload section ── */}
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-xl">Upload Vouchers</h2>
          <button
            onClick={() => setBulkMode((v) => !v)}
            className="text-xs text-accent underline"
          >
            {bulkMode ? "Single mode" : "Bulk mode"}
          </button>
        </div>

        <Card className="mt-3 p-5">
          {bulkMode ? (
            <div className="space-y-3">
              <div>
                <Label>Bulk upload (one per line: Network:Code)</Label>
                <p className="mb-2 text-xs text-muted-foreground">Example: Tigo:123456789012</p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"Tigo:123456789012\nAirtel:987654321098\nVodacom:112233445566"}
                  rows={8}
                  className="w-full rounded-lg border border-border bg-secondary/40 p-3 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <Button onClick={uploadBulk} disabled={busy || !bulkText.trim()} className="w-full">
                {busy ? <Loader2 className="animate-spin" /> : <><Plus size={16} className="mr-1" /> Upload all</>}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <Label>Network</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {NETWORKS.map((n) => (
                    <button
                      key={n}
                      onClick={() => setNetwork(n)}
                      className={`rounded-full border px-3 py-1.5 text-sm transition-all active:scale-95 ${
                        network === n
                          ? NETWORK_COLORS[n]
                          : "border-border text-muted-foreground hover:border-foreground/20"
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="vcode">Voucher Code</Label>
                <Input
                  id="vcode"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. 123456789012"
                  className="mt-1 font-mono"
                  onKeyDown={(e) => e.key === "Enter" && uploadSingle()}
                />
              </div>
              <Button onClick={uploadSingle} disabled={busy || !code.trim()} className="w-full">
                {busy ? <Loader2 className="animate-spin" /> : <><Plus size={16} className="mr-1" /> Upload {network} voucher</>}
              </Button>
            </div>
          )}
        </Card>
      </section>

      {/* ── Milestones ── */}
      <section className="mt-8">
        <h2 className="font-display text-xl">Reward Milestones</h2>
        <div className="mt-3 space-y-2">
          {milestones.isLoading ? (
            <div className="h-32 animate-pulse rounded-xl bg-muted" />
          ) : (
            milestones.data?.map((m: any) => (
              <Card key={m.id} className="flex items-center gap-4 px-4 py-3">
                <Gift size={16} className="shrink-0 text-accent" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{m.label_en}</p>
                  <p className="text-xs text-muted-foreground">{m.label_sw}</p>
                </div>
                <span className="shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                  {m.verified_words.toLocaleString()} words
                </span>
              </Card>
            ))
          )}
        </div>
      </section>

      {/* ── Voucher list ── */}
      <section className="mt-8">
        <h2 className="font-display text-xl">All Vouchers</h2>
        <div className="mt-3 space-y-2">
          {vouchers.isLoading ? (
            [1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />)
          ) : !vouchers.data?.length ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              No vouchers uploaded yet. Add some above.
            </Card>
          ) : (
            vouchers.data.map((v: any) => (
              <Card key={v.id} className="flex min-w-0 items-center gap-3 px-4 py-3">
                <NetworkBadge network={v.network} />
                <span className="min-w-0 flex-1 truncate font-mono text-sm">
                  {v.status === "available" ? v.code : "••••••••••••"}
                </span>
                <StatusBadge status={v.status} />
                {v.status === "available" && (
                  <button
                    onClick={() => deleteVoucher(v.id, v.status)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    title="Delete voucher"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
                {v.status === "claimed" && v.claimed_at && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(v.claimed_at).toLocaleDateString()}
                  </span>
                )}
              </Card>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
