import { Layout } from "@/components/layout";
import {
  useGetMe,
  useListAccounts,
  useDeleteAccount,
  useListAdLinks,
  useCreateAdLink,
  useDeleteAdLink,
  getListAccountsQueryKey,
  getListAdLinksQueryKey,
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Shield, Trash, Copy, Ban, CheckCircle, UserCheck, Flag, Coins, UserX } from "lucide-react";
import { Link } from "wouter";

// --- API helpers ---
async function fetchAdminUsers() {
  const res = await fetch("/api/admin/users", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load users");
  return res.json() as Promise<any[]>;
}

async function banUser(userId: number, durationHours: number | null, reason: string) {
  const res = await fetch(`/api/admin/users/${userId}/ban`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ durationHours, reason }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function unbanUser(userId: number) {
  const res = await fetch(`/api/admin/users/${userId}/ban`, { method: "DELETE", credentials: "include" });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function setModerator(userId: number, promote: boolean) {
  const res = await fetch(`/api/admin/users/${userId}/moderator`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ promote }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function adjustPoints(userId: number, delta: number) {
  const res = await fetch(`/api/admin/users/${userId}/points`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ delta }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function fetchReports() {
  const res = await fetch("/api/admin/reports", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load reports");
  return res.json() as Promise<any[]>;
}

async function dismissReport(reportId: number) {
  const res = await fetch(`/api/admin/reports/${reportId}/dismiss`, { method: "PATCH", credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

const BAN_DURATIONS = [
  { label: "1 hr", hours: 1 },
  { label: "24 hrs", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
  { label: "1 month", hours: 720 },
  { label: "Permanent", hours: null },
];

// --- Main component ---
export default function Admin() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetMe();

  if (!userLoading && (!user || (!user.isAdmin && !(user as any).isModerator))) {
    setLocation("/");
    return null;
  }

  const tabs = [
    { value: "users", label: "Users" },
    { value: "accounts", label: "Accounts" },
    { value: "reports", label: "Reports" },
    ...(user?.isAdmin ? [{ value: "ads", label: "Ad Links" }] : []),
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-3xl font-black">Command Center</h1>
            <p className="text-sm text-muted-foreground">{user?.isAdmin ? "Administrator" : "Moderator"} Panel</p>
          </div>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className={`grid w-full grid-cols-${tabs.length} mb-8 bg-card border border-border h-12`}>
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="users"><UsersTab isAdmin={!!user?.isAdmin} /></TabsContent>
          <TabsContent value="accounts"><AccountsTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          {user?.isAdmin && <TabsContent value="ads"><AdLinksTab /></TabsContent>}
        </Tabs>
      </div>
    </Layout>
  );
}

// --- Users Tab ---
function UsersTab({ isAdmin }: { isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [banTarget, setBanTarget] = useState<any>(null);
  const [banDuration, setBanDuration] = useState<number | null>(24);
  const [banReason, setBanReason] = useState("");
  const [pointsTarget, setPointsTarget] = useState<any>(null);
  const [pointsDelta, setPointsDelta] = useState(0);

  const { data: users = [], isLoading } = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers });

  const banMutation = useMutation({
    mutationFn: () => banUser(banTarget.id, banDuration, banReason),
    onSuccess: () => { setBanTarget(null); setBanReason(""); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "User banned" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: number) => unbanUser(userId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "User unbanned" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const modMutation = useMutation({
    mutationFn: ({ userId, promote }: { userId: number; promote: boolean }) => setModerator(userId, promote),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pointsMutation = useMutation({
    mutationFn: () => adjustPoints(pointsTarget.id, pointsDelta),
    onSuccess: () => { setPointsTarget(null); setPointsDelta(0); queryClient.invalidateQueries({ queryKey: ["admin-users"] }); toast({ title: "Points updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = users.filter((u: any) => u.username.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />

      <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Points / XP</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : filtered.map((u: any) => (
              <TableRow key={u.id}>
                <TableCell>
                  <Link href={`/profile/${u.id}`} className="font-medium hover:text-primary">{u.username}</Link>
                  <div className="text-xs text-muted-foreground">#{u.id}</div>
                </TableCell>
                <TableCell>
                  <span className="text-primary font-mono text-sm">{u.points} pts</span>
                  <div className="text-xs text-muted-foreground">{u.xp} XP</div>
                </TableCell>
                <TableCell>
                  {u.isAdmin && <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px]">ADMIN</Badge>}
                  {u.isModerator && !u.isAdmin && <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[10px]">MOD</Badge>}
                  {!u.isAdmin && !u.isModerator && <span className="text-xs text-muted-foreground">User</span>}
                </TableCell>
                <TableCell>
                  {u.isBanned
                    ? <div>
                        <Badge variant="destructive" className="text-[10px]">Banned</Badge>
                        {u.banReason && <div className="text-xs text-muted-foreground mt-0.5 max-w-[120px] truncate" title={u.banReason}>{u.banReason}</div>}
                      </div>
                    : <Badge className="bg-green-500/10 text-green-600 border-green-500/30 text-[10px]">Active</Badge>
                  }
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1 flex-wrap">
                    {/* Points (admin only) */}
                    {isAdmin && !u.isAdmin && (
                      <Button size="sm" variant="outline" className="gap-1 h-7 text-xs" onClick={() => { setPointsTarget(u); setPointsDelta(0); }}>
                        <Coins className="h-3 w-3" /> Points
                      </Button>
                    )}

                    {/* Mod toggle (admin only) */}
                    {isAdmin && !u.isAdmin && (
                      <Button
                        size="sm"
                        variant="outline"
                        className={`gap-1 h-7 text-xs ${u.isModerator ? "text-blue-600 border-blue-500/30" : ""}`}
                        onClick={() => modMutation.mutate({ userId: u.id, promote: !u.isModerator })}
                        disabled={modMutation.isPending}
                      >
                        {u.isModerator ? <UserX className="h-3 w-3" /> : <UserCheck className="h-3 w-3" />}
                        {u.isModerator ? "Demote" : "Mod"}
                      </Button>
                    )}

                    {/* Ban / Unban */}
                    {!u.isAdmin && (
                      u.isBanned ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600 border-green-500/30"
                          onClick={() => unbanMutation.mutate(u.id)} disabled={unbanMutation.isPending}>
                          <CheckCircle className="h-3 w-3" /> Unban
                        </Button>
                      ) : (
                        <Button size="sm" variant="destructive" className="h-7 text-xs gap-1"
                          onClick={() => { setBanTarget(u); setBanDuration(24); setBanReason(""); }}>
                          <Ban className="h-3 w-3" /> Ban
                        </Button>
                      )
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Ban Dialog */}
      <Dialog open={!!banTarget} onOpenChange={(open) => !open && setBanTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Ban {banTarget?.username}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Duration</label>
              <div className="grid grid-cols-3 gap-2">
                {BAN_DURATIONS.map((d) => (
                  <button key={d.label} onClick={() => setBanDuration(d.hours)}
                    className={`text-xs border rounded-lg px-2 py-2 font-medium transition-colors ${banDuration === d.hours ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}>
                    {d.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Reason</label>
              <Input placeholder="Reason for ban..." value={banReason} onChange={(e) => setBanReason(e.target.value)} />
            </div>
            <Button variant="destructive" className="w-full" onClick={() => banMutation.mutate()} disabled={!banReason || banMutation.isPending}>
              {banMutation.isPending ? "Banning..." : "Confirm Ban"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Points Dialog */}
      <Dialog open={!!pointsTarget} onOpenChange={(open) => !open && setPointsTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Adjust Points — {pointsTarget?.username}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Current: <strong className="text-primary">{pointsTarget?.points} pts</strong></p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Delta (positive = add, negative = remove)</label>
              <Input type="number" value={pointsDelta} onChange={(e) => setPointsDelta(Number(e.target.value))} placeholder="e.g. 100 or -50" />
            </div>
            <div className="flex gap-2">
              {[100, 500, -100, -500].map((d) => (
                <button key={d} onClick={() => setPointsDelta((prev) => prev + d)}
                  className={`text-xs border rounded px-2 py-1 ${d > 0 ? "border-green-500/30 text-green-600" : "border-red-500/30 text-red-500"} hover:opacity-80`}>
                  {d > 0 ? "+" : ""}{d}
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={() => pointsMutation.mutate()} disabled={!pointsDelta || pointsMutation.isPending}>
              {pointsMutation.isPending ? "Saving..." : `Apply ${pointsDelta > 0 ? "+" : ""}${pointsDelta} pts`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// --- Accounts Tab ---
function AccountsTab() {
  const { data: accountsData, isLoading } = useListAccounts({ limit: 100 });
  const deleteAccount = useDeleteAccount();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this account permanently?")) return;
    try {
      await deleteAccount.mutateAsync({ accountId: id });
      queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      toast({ title: "Account deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Poster</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
          ) : accountsData?.accounts?.map(a => (
            <TableRow key={a.id}>
              <TableCell className="font-mono text-xs">{a.id}</TableCell>
              <TableCell className="font-medium max-w-[200px] truncate">
                <Link href={`/accounts/${a.id}`} className="hover:text-primary">{a.title}</Link>
              </TableCell>
              <TableCell>{(a as any).posterUsername}</TableCell>
              <TableCell>
                {a.isAvailable ? <Badge variant="secondary">Available</Badge> : <Badge variant="outline" className="text-muted-foreground">Claimed</Badge>}
              </TableCell>
              <TableCell className="text-right">
                <Button variant="destructive" size="sm" onClick={() => handleDelete(a.id)}>
                  <Trash className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// --- Reports Tab ---
function ReportsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [showDismissed, setShowDismissed] = useState(false);

  const { data: reports = [], isLoading } = useQuery({ queryKey: ["admin-reports"], queryFn: fetchReports });

  const dismissMutation = useMutation({
    mutationFn: (reportId: number) => dismissReport(reportId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-reports"] }); toast({ title: "Report dismissed" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = reports.filter((r: any) => showDismissed || !r.isDismissed);
  const pendingCount = reports.filter((r: any) => !r.isDismissed).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Flag className="h-5 w-5 text-primary" />
          <h2 className="font-bold">User Reports</h2>
          {pendingCount > 0 && <Badge variant="destructive">{pendingCount} pending</Badge>}
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={showDismissed} onChange={(e) => setShowDismissed(e.target.checked)} className="rounded" />
          Show dismissed
        </label>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading reports...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <Flag className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
          <p className="text-muted-foreground">{showDismissed ? "No reports yet." : "No pending reports."}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report: any) => (
            <div key={report.id} className={`bg-card border rounded-xl p-4 ${report.isDismissed ? "opacity-50 border-border" : "border-red-500/20 bg-red-500/5"}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{report.targetType}</Badge>
                    <span className="text-sm font-medium">#{report.targetId}</span>
                    <span className="text-xs text-muted-foreground">by <strong>{report.reporterUsername}</strong></span>
                    <span className="text-xs text-muted-foreground">{new Date(report.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-semibold">{report.reason}</p>
                  {report.details && <p className="text-sm text-muted-foreground">{report.details}</p>}
                </div>
                <div className="flex gap-2 shrink-0">
                  {report.targetType === "account" && (
                    <Link href={`/accounts/${report.targetId}`}>
                      <Button size="sm" variant="outline" className="h-7 text-xs">View</Button>
                    </Link>
                  )}
                  {!report.isDismissed && (
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => dismissMutation.mutate(report.id)} disabled={dismissMutation.isPending}>
                      <CheckCircle className="h-3 w-3" /> Dismiss
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Ad Links Tab ---
function AdLinksTab() {
  const { data: links, isLoading } = useListAdLinks();
  const createLink = useCreateAdLink();
  const deleteLink = useDeleteAdLink();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [desc, setDesc] = useState("");
  const [reward, setReward] = useState(50);
  const [max, setMax] = useState(10);

  const handleCreate = async () => {
    try {
      await createLink.mutateAsync({ data: { description: desc, pointsReward: reward, maxUses: max } });
      setDesc("");
      queryClient.invalidateQueries({ queryKey: getListAdLinksQueryKey() });
      toast({ title: "Link created" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (code: string) => {
    const url = `${window.location.origin}/api/ad-links/${code}/redeem`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-8">
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-bold text-lg mb-4">Generate New Link</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Description / Campaign Name</label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Discord Drop July" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Points Reward</label>
            <Input type="number" value={reward} onChange={(e) => setReward(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Uses</label>
            <Input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} />
          </div>
        </div>
        <Button className="mt-4" onClick={handleCreate} disabled={createLink.isPending}>Generate Link</Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : links?.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">{l.code}</TableCell>
                <TableCell>{l.description}</TableCell>
                <TableCell className="font-bold text-primary">+{l.pointsReward}</TableCell>
                <TableCell>{l.usesCount} / {l.maxUses}</TableCell>
                <TableCell>
                  {l.isActive ? <Badge variant="secondary" className="bg-green-500/10 text-green-500">Active</Badge> : <Badge variant="outline">Depleted</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(l.code)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={async () => {
                    await deleteLink.mutateAsync({ linkId: l.id });
                    queryClient.invalidateQueries({ queryKey: getListAdLinksQueryKey() });
                  }}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
