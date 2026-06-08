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
import { Shield, Trash, Copy, Ban, CheckCircle, UserCheck, Flag, Coins, UserX, Megaphone, Pin, PinOff, Plus, ShoppingBag, Package, Star } from "lucide-react";
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
    ...(user?.isAdmin ? [{ value: "store", label: "Store" }] : []),
    ...(user?.isAdmin ? [{ value: "announcements", label: "News" }] : []),
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
          <TabsList className="flex w-full mb-8 bg-card border border-border h-12 overflow-x-auto">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="users"><UsersTab isAdmin={!!user?.isAdmin} /></TabsContent>
          <TabsContent value="accounts"><AccountsTab /></TabsContent>
          <TabsContent value="reports"><ReportsTab /></TabsContent>
          {user?.isAdmin && <TabsContent value="ads"><AdLinksTab /></TabsContent>}
          {user?.isAdmin && <TabsContent value="store"><StoreTab /></TabsContent>}
          {user?.isAdmin && <TabsContent value="announcements"><AnnouncementsTab /></TabsContent>}
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

  const { data: users = [], isLoading, isError, error } = useQuery({ queryKey: ["admin-users"], queryFn: fetchAdminUsers });

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

      {isError && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          Failed to load users: {(error as any)?.message ?? "Unknown error"}
        </div>
      )}

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
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No users found.</TableCell></TableRow>
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

  const { data: reports = [], isLoading, isError, error } = useQuery({ queryKey: ["admin-reports"], queryFn: fetchReports });

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

      {isError && (
        <div className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
          Failed to load reports: {(error as any)?.message ?? "Unknown error"}
        </div>
      )}

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
        <h3 className="font-bold text-lg mb-4">Generate New Ad Link</h3>
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

// --- Announcements Tab ---
async function fetchAnnouncements() {
  const res = await fetch("/api/announcements", { credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json() as Promise<any[]>;
}

async function createAnnouncement(title: string, description: string, pinned: boolean) {
  const res = await fetch("/api/announcements", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, pinned }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function deleteAnnouncement(id: number) {
  const res = await fetch(`/api/announcements/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function togglePin(id: number, pinned: boolean) {
  const res = await fetch(`/api/announcements/${id}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pinned }),
  });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

// ── Store Tab ──
async function fetchAdminProducts() {
  const res = await fetch("/api/store/products", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load products");
  return res.json() as Promise<any[]>;
}

async function fetchAdminPurchases() {
  const res = await fetch("/api/store/admin/purchases", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load purchases");
  return res.json() as Promise<any[]>;
}

async function createProduct(title: string, description: string, imageUrl: string, price: number, stock: number) {
  const res = await fetch("/api/store/products", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, imageUrl, price, stock }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function addStock(id: number, amount: number) {
  const res = await fetch(`/api/store/products/${id}/stock`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed"); }
  return res.json();
}

async function deleteProduct(id: number) {
  const res = await fetch(`/api/store/products/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function StoreTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [stockTarget, setStockTarget] = useState<any>(null);
  const [stockAmount, setStockAmount] = useState(10);

  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [imgUrl, setImgUrl] = useState("");
  const [price, setPrice] = useState(100);
  const [stock, setStock] = useState(10);

  const { data: products = [], isLoading: productsLoading } = useQuery({ queryKey: ["admin-products"], queryFn: fetchAdminProducts });
  const { data: purchases = [], isLoading: purchasesLoading } = useQuery({ queryKey: ["admin-purchases"], queryFn: fetchAdminPurchases });

  const createMutation = useMutation({
    mutationFn: () => createProduct(title, desc, imgUrl, price, stock),
    onSuccess: () => {
      setTitle(""); setDesc(""); setImgUrl(""); setPrice(100); setStock(10);
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Product created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const stockMutation = useMutation({
    mutationFn: () => addStock(stockTarget.id, stockAmount),
    onSuccess: () => {
      setStockTarget(null);
      setStockAmount(10);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Stock added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteProduct(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      toast({ title: "Product deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-8">
      {/* Products Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <h3 className="font-bold text-lg">Products</h3>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-1"><Plus className="h-4 w-4" /> Add Product</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-w-md">
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-5 w-5 text-primary" /> New Product</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <label className="text-sm font-medium block mb-1">Title</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Steam Gift Card $10" />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Description</label>
                  <textarea className="w-full min-h-[80px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring" placeholder="Describe the product..." value={desc} onChange={(e) => setDesc(e.target.value)} />
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">Image URL (optional)</label>
                  <Input value={imgUrl} onChange={(e) => setImgUrl(e.target.value)} placeholder="https://..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium block mb-1">Price (pts)</label>
                    <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="text-sm font-medium block mb-1">Initial Stock</label>
                    <Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
                  </div>
                </div>
                <Button className="w-full" disabled={!title.trim() || !desc.trim() || price <= 0 || createMutation.isPending} onClick={() => createMutation.mutate()}>
                  {createMutation.isPending ? "Creating..." : "Create Product"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Reviews</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {productsLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : products.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No products yet.</TableCell></TableRow>
              ) : products.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.id}</TableCell>
                  <TableCell className="font-medium max-w-[200px] truncate">{p.title}</TableCell>
                  <TableCell className="font-bold text-primary">{p.price} pts</TableCell>
                  <TableCell>{p.stock}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
                      <span className="text-sm">{p.avgRating || 0} ({p.reviewsCount || 0})</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setStockTarget(p); setStockAmount(10); }}>
                        + Stock
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => { if (confirm("Delete this product?")) deleteMutation.mutate(p.id); }}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Purchases Section */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-lg">Purchase History</h3>
        </div>
        <div className="bg-card border border-border rounded-xl overflow-hidden overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Qty</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {purchasesLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
              ) : purchases.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No purchases yet.</TableCell></TableRow>
              ) : purchases.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium max-w-[200px] truncate">{p.productTitle}</TableCell>
                  <TableCell>{p.username}</TableCell>
                  <TableCell>{p.quantity}</TableCell>
                  <TableCell className="font-bold text-primary">{p.totalPrice} pts</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Add Stock Dialog */}
      <Dialog open={!!stockTarget} onOpenChange={(open) => !open && setStockTarget(null)}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle>Add Stock — {stockTarget?.title}</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">Current stock: <strong className="text-primary">{stockTarget?.stock}</strong></p>
            <div className="space-y-1">
              <label className="text-sm font-medium">Amount to add</label>
              <Input type="number" value={stockAmount} onChange={(e) => setStockAmount(Number(e.target.value))} min={1} />
            </div>
            <Button className="w-full" onClick={() => stockMutation.mutate()} disabled={stockAmount <= 0 || stockMutation.isPending}>
              {stockMutation.isPending ? "Adding..." : `Add ${stockAmount} units`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AnnouncementsTab() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [pinned, setPinned] = useState(true);
  const [open, setOpen] = useState(false);

  const { data: announcements = [], isLoading } = useQuery({ queryKey: ["announcements"], queryFn: fetchAnnouncements });

  const createMutation = useMutation({
    mutationFn: () => createAnnouncement(title, description, pinned),
    onSuccess: () => {
      setTitle(""); setDescription(""); setPinned(true); setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["announcements"] });
      toast({ title: "Announcement posted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => deleteAnnouncement(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["announcements"] }); toast({ title: "Deleted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const pinMutation = useMutation({
    mutationFn: ({ id, pinned }: { id: number; pinned: boolean }) => togglePin(id, pinned),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["announcements"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-bold text-lg">Site Announcements</h3>
          <p className="text-sm text-muted-foreground">Posts that appear on the home page and every account page.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="gap-1.5"><Plus className="h-4 w-4" /> New Post</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-w-md">
            <DialogHeader><DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" /> New Announcement</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-sm font-medium block mb-1">Title</label>
                <Input placeholder="e.g. Maintenance Tonight" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div>
                <label className="text-sm font-medium block mb-1">Description</label>
                <textarea
                  className="w-full min-h-[100px] resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                  placeholder="Full details of the announcement..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pinned"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                  className="accent-primary"
                />
                <label htmlFor="pinned" className="text-sm cursor-pointer">Pin this announcement</label>
              </div>
              <Button
                className="w-full"
                disabled={!title.trim() || !description.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? "Posting..." : "Post Announcement"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : announcements.length === 0 ? (
        <div className="text-center py-12 bg-card border border-dashed border-border rounded-xl text-muted-foreground">
          No announcements yet. Click "New Post" to create one.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {announcements.map((a: any) => (
            <div key={a.id} className="bg-card border border-border rounded-xl px-5 py-4 flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-bold text-foreground">{a.title}</span>
                  {a.pinned && (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] flex items-center gap-1">
                      <Pin className="h-2.5 w-2.5 rotate-45" /> Pinned
                    </Badge>
                  )}
                  <span className="text-[11px] text-muted-foreground">by {a.authorUsername}</span>
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{a.description}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  variant="ghost" size="icon"
                  className={a.pinned ? "text-primary" : "text-muted-foreground"}
                  onClick={() => pinMutation.mutate({ id: a.id, pinned: !a.pinned })}
                  title={a.pinned ? "Unpin" : "Pin"}
                >
                  {a.pinned ? <Pin className="h-4 w-4 rotate-45" /> : <PinOff className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost" size="icon"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(a.id)}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
