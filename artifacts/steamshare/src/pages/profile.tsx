import { Layout } from "@/components/layout";
import { useGetUser, useGetUserAccounts, useGetMe } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountCard } from "@/components/account-card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CalendarDays, Heart, Gamepad2, Award, Ban, Shield, MessageCircle, Coins } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

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

const BAN_DURATIONS = [
  { label: "1 hour", hours: 1 },
  { label: "1 day", hours: 24 },
  { label: "3 days", hours: 72 },
  { label: "1 week", hours: 168 },
  { label: "1 month", hours: 720 },
  { label: "Permanent", hours: null },
];

export default function Profile() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data: user, isLoading: userLoading } = useGetUser(id, { query: { enabled: !!id } });
  const { data: accounts, isLoading: accountsLoading } = useGetUserAccounts(id, { query: { enabled: !!id } });
  const { data: me } = useGetMe();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [banOpen, setBanOpen] = useState(false);
  const [banDuration, setBanDuration] = useState<number | null>(24);
  const [banReason, setBanReason] = useState("");

  const xpProgress = user ? (user.xp % 100) : 0;
  const canManage = me && (me.isAdmin || (me as any).isModerator) && me.id !== id;

  const banMutation = useMutation({
    mutationFn: () => banUser(id, banDuration, banReason),
    onSuccess: () => {
      setBanOpen(false);
      setBanReason("");
      queryClient.invalidateQueries({ queryKey: [`/api/users/${id}`] });
      toast({ title: "User banned" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unbanMutation = useMutation({
    mutationFn: () => unbanUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/users/${id}`] });
      toast({ title: "User unbanned" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (userLoading) return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <Skeleton className="h-48 w-full rounded-xl mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 col-span-2 rounded-xl" />
        </div>
      </div>
    </Layout>
  );

  if (!user) return (
    <Layout>
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold">User Not Found</h2>
      </div>
    </Layout>
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">

        {/* Profile Header */}
        <div className="bg-card border border-border rounded-xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />

          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
            <Avatar className="h-28 w-28 border-4 border-background shadow-xl">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="text-4xl bg-secondary">{user.username.substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>

            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <h1 className="text-3xl font-black mb-2 flex items-center justify-center md:justify-start gap-3 flex-wrap">
                  {user.username}
                  {user.isBanned && <Badge variant="destructive">BANNED</Badge>}
                  {(user as any).isAdmin && <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 flex items-center gap-1"><Shield className="h-3 w-3" />ADMIN</Badge>}
                  {(user as any).isModerator && !((user as any).isAdmin) && <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 flex items-center gap-1"><Shield className="h-3 w-3" />MOD</Badge>}
                </h1>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1"><CalendarDays className="h-4 w-4" /> Joined {format(new Date(user.createdAt), "MMMM yyyy")}</div>
                  {user.badgeName && (
                    <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 flex items-center gap-1">
                      <Award className="h-3 w-3" /> {user.badgeName}
                    </Badge>
                  )}
                </div>
              </div>

              <div className="bg-background/50 border border-border rounded-lg p-4 max-w-md">
                <div className="flex justify-between items-end mb-2">
                  <span className="font-bold text-lg">Level {user.level}</span>
                  <span className="text-xs text-primary font-mono">{user.xp} XP</span>
                </div>
                <Progress value={xpProgress} className="h-3" />
                <div className="text-[10px] text-muted-foreground mt-1 text-right">{100 - xpProgress} XP to next level</div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 w-full md:w-auto shrink-0">
              <div className="bg-background/50 border border-border rounded-lg p-4 text-center">
                <Gamepad2 className="h-5 w-5 mx-auto text-primary mb-1" />
                <div className="text-2xl font-bold">{user.totalAccounts}</div>
                <div className="text-xs text-muted-foreground uppercase">Uploads</div>
              </div>
              <div className="bg-background/50 border border-border rounded-lg p-4 text-center">
                <Heart className="h-5 w-5 mx-auto text-red-500 mb-1" />
                <div className="text-2xl font-bold">{user.totalLikesReceived}</div>
                <div className="text-xs text-muted-foreground uppercase">Likes Rcvd</div>
              </div>
            </div>
          </div>

          {/* Action buttons for admin/mod */}
          {canManage && (
            <div className="mt-6 pt-6 border-t border-border flex flex-wrap gap-3">
              {!user.isBanned ? (
                <Dialog open={banOpen} onOpenChange={setBanOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="destructive" className="gap-2">
                      <Ban className="h-4 w-4" /> Ban User
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="bg-card border-border max-w-sm">
                    <DialogHeader><DialogTitle>Ban {user.username}</DialogTitle></DialogHeader>
                    <div className="space-y-4 pt-2">
                      <div className="space-y-1">
                        <label className="text-sm font-medium">Duration</label>
                        <div className="grid grid-cols-3 gap-2">
                          {BAN_DURATIONS.map((d) => (
                            <button
                              key={d.label}
                              onClick={() => setBanDuration(d.hours)}
                              className={`text-xs border rounded-lg px-2 py-2 font-medium transition-colors ${banDuration === d.hours ? "bg-primary text-white border-primary" : "border-border text-muted-foreground hover:border-primary/50"}`}
                            >
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
              ) : (
                <Button size="sm" variant="outline" className="gap-2 text-green-600 border-green-600/30" onClick={() => unbanMutation.mutate()} disabled={unbanMutation.isPending}>
                  <Ban className="h-4 w-4" /> Unban User
                </Button>
              )}

              {me.isAdmin && (
                <Link href={`/admin?tab=users&id=${id}`}>
                  <Button size="sm" variant="outline" className="gap-2">
                    <Coins className="h-4 w-4" /> Manage Points
                  </Button>
                </Link>
              )}
            </div>
          )}

          {/* Message button for non-self users */}
          {me && me.id !== id && (
            <div className="mt-4 pt-4 border-t border-border">
              <Link href={`/messages?user=${id}&username=${encodeURIComponent(user.username)}`}>
                <Button size="sm" variant="outline" className="gap-2">
                  <MessageCircle className="h-4 w-4" /> Send Message
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* User's Accounts */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary rounded-sm inline-block" /> Upload History
          </h2>
          {accountsLoading ? (
            <div className="flex flex-col gap-3">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
            </div>
          ) : accounts?.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border border-dashed rounded-xl">
              <p className="text-muted-foreground">This user hasn't uploaded any accounts yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {accounts?.map(account => <AccountCard key={account.id} account={account} />)}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
