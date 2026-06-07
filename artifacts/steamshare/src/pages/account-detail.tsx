import { Layout } from "@/components/layout";
import {
  useGetAccount,
  getGetAccountQueryKey,
  useLikeAccount,
  useUnlikeAccount,
  useClaimAccount,
  useListComments,
  getListCommentsQueryKey,
  useCreateComment,
  useLikeComment,
  useUnlikeComment,
  useDeleteComment,
  useDeleteAccount,
  useGetMe,
  getGetMeQueryKey,
  useGetUser,
} from "@workspace/api-client-react";
import { useParams, Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import {
  Heart, Coins, MessageSquare, Trash, Lock,
  Copy, CheckCheck, ChevronDown, ChevronUp,
  ThumbsUp, ThumbsDown, Flag, Edit2, Check, X, Shield, MessageCircle, Eye,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); };
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
        <span className="flex-1 font-mono text-sm break-all select-all">{value}</span>
        <button onClick={copy} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <CheckCheck className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-sm font-medium">
        <span className="flex items-center gap-2 text-muted-foreground"><span className="text-primary">≡</span> {title} ({items.length})</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="divide-y divide-border">
          {items.map((item, i) => (
            <div key={i} className="px-4 py-2 text-sm flex items-center gap-3">
              <span className="text-muted-foreground font-mono text-xs">#{i + 1}</span>
              <span className="text-primary font-medium">{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

async function submitVote(accountId: number, vote: "working" | "not_working") {
  const res = await fetch(`/api/accounts/${accountId}/vote`, {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ vote }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed to vote"); }
  return res.json();
}

async function submitReport(targetType: string, targetId: number, reason: string, details: string) {
  const res = await fetch("/api/reports", {
    method: "POST", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType, targetId, reason, details }),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed to report"); }
  return res.json();
}

async function patchAccount(accountId: number, data: Record<string, unknown>) {
  const res = await fetch(`/api/accounts/${accountId}`, {
    method: "PATCH", credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Failed to update"); }
  return res.json();
}

export default function AccountDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const [, navigate] = useLocation();
  const { data: user } = useGetMe();
  const { data: account, isLoading: accountLoading } = useGetAccount(id);
  const { data: comments, isLoading: commentsLoading } = useListComments(id);

  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [commentContent, setCommentContent] = useState("");
  const [claimResult, setClaimResult] = useState<{ username: string; password: string } | null>(null);
  const [claimError, setClaimError] = useState("");
  const [likeError, setLikeError] = useState("");
  const [commentError, setCommentError] = useState("");

  // Edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editGames, setEditGames] = useState("");
  const [editCost, setEditCost] = useState(0);

  // Report dialog
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  const likeAccount = useLikeAccount();
  const unlikeAccount = useUnlikeAccount();
  const claimAccount = useClaimAccount();
  const createComment = useCreateComment();
  const likeComment = useLikeComment();
  const unlikeComment = useUnlikeComment();
  const deleteComment = useDeleteComment();
  const deleteAccount = useDeleteAccount();

  const voteMutation = useMutation({
    mutationFn: ({ vote }: { vote: "working" | "not_working" }) => submitVote(id, vote),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) }),
    onError: (e: any) => toast({ title: "Vote failed", description: e.message, variant: "destructive" }),
  });

  const reportMutation = useMutation({
    mutationFn: () => submitReport("account", id, reportReason, reportDetails),
    onSuccess: () => { setReportOpen(false); setReportReason(""); setReportDetails(""); toast({ title: "Report submitted" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: () => patchAccount(id, { title: editTitle, description: editDesc, games: editGames.split(",").map(s => s.trim()).filter(Boolean), pointsCost: editCost }),
    onSuccess: () => { setEditing(false); queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) }); toast({ title: "Account updated" }); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleLike = async () => {
    if (!user) { setLikeError("You must be logged in."); return; }
    setLikeError("");
    try {
      if (account?.userHasLiked) await unlikeAccount.mutateAsync({ accountId: id });
      else await likeAccount.mutateAsync({ accountId: id });
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
    } catch (e: any) { setLikeError(e.message || "Failed"); }
  };

  const handleClaim = async () => {
    if (!user) { setClaimError("You must be logged in."); return; }
    if (!account) return;
    if (user.points < account.pointsCost) { setClaimError(`You need ${account.pointsCost} points but only have ${user.points}.`); return; }
    setClaimError("");
    try {
      const res = await claimAccount.mutateAsync({ accountId: id });
      setClaimResult({ username: res.steamUsername, password: res.steamPassword });
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch (e: any) {
      const raw: string = e.message || "Failed to claim";
      setClaimError(raw.replace(/^HTTP \d+ [^:]+:\s*/i, ""));
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this account permanently?")) return;
    try {
      await deleteAccount.mutateAsync({ accountId: id });
      navigate("/browse");
    } catch (e: any) { toast({ title: "Error", description: e.message, variant: "destructive" }); }
  };

  const startEdit = () => {
    if (!account) return;
    setEditTitle(account.title);
    setEditDesc(account.description);
    setEditGames(account.games.join(", "));
    setEditCost(account.pointsCost);
    setEditing(true);
  };

  const canManage = user && account && (user.id === account.userId || user.isAdmin || (user as any).isModerator);
  const { data: poster } = useGetUser(account?.userId ?? 0);

  if (accountLoading) return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-6">
        <Skeleton className="h-64 w-full rounded-xl" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-96 col-span-2 rounded-xl" />
          <Skeleton className="h-96 col-span-1 rounded-xl" />
        </div>
      </div>
    </Layout>
  );

  if (!account) return (
    <Layout>
      <div className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-2xl font-bold mb-2">Account Not Found</h2>
        <p className="text-muted-foreground mb-6">This account may have been removed.</p>
        <Link href="/browse"><Button>Browse Accounts</Button></Link>
      </div>
    </Layout>
  );

  const totalVotes = (account.workingVotes ?? 0) + (account.notWorkingVotes ?? 0);
  const workingPct = totalVotes > 0 ? Math.round(((account.workingVotes ?? 0) / totalVotes) * 100) : 0;
  const viewCount = (account as any).viewCount ?? 0;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">

        {/* Header */}
        <div className="bg-card border border-border rounded-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative z-10">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                {account.pointsCost === 0
                  ? <Badge className="bg-green-600/20 text-green-600 border-green-600/30">Free</Badge>
                  : <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 flex items-center gap-1"><Coins className="h-3 w-3" /> {account.pointsCost} Points</Badge>
                }
                <span className="text-xs text-muted-foreground">Posted {formatDistanceToNow(new Date(account.createdAt))} ago</span>
                {(account as any).posterIsAdmin && <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30 text-[10px]">ADMIN</Badge>}
                {(account as any).posterIsModerator && !((account as any).posterIsAdmin) && <Badge className="bg-blue-500/20 text-blue-600 border-blue-500/30 text-[10px]">MOD</Badge>}
              </div>

              {editing ? (
                <div className="space-y-3">
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Title" className="text-xl font-black" />
                  <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Description" className="resize-none" rows={3} />
                  <div className="grid grid-cols-2 gap-3">
                    <Input value={editGames} onChange={(e) => setEditGames(e.target.value)} placeholder="Games (comma-separated)" />
                    <Input type="number" value={editCost} onChange={(e) => setEditCost(Number(e.target.value))} placeholder="Points cost" min={0} />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => editMutation.mutate()} disabled={editMutation.isPending} className="gap-1"><Check className="h-4 w-4" /> Save</Button>
                    <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="gap-1"><X className="h-4 w-4" /> Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <h1 className="text-3xl md:text-4xl font-black">{account.title}</h1>
                  <div className="flex items-center gap-3 mt-4">
                    <Link href={`/profile/${account.userId}`}>
                      <Avatar className="h-10 w-10 border border-border cursor-pointer hover:border-primary transition-colors">
                        <AvatarImage src={account.posterAvatarUrl || undefined} />
                        <AvatarFallback>{account.posterUsername?.substring(0, 2).toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Uploaded by</div>
                      <Link href={`/profile/${account.userId}`} className="text-primary hover:underline font-bold">{account.posterUsername}</Link>
                    </div>
                  </div>
                </>
              )}
            </div>

            <div className="shrink-0 flex flex-col items-center gap-2 w-full md:w-40">
              <div className="flex items-center gap-2 text-sm font-medium">
                <div className={`w-2 h-2 rounded-full ${account.isAvailable ? "bg-green-500" : "bg-muted-foreground"}`} />
                {account.isAvailable ? "Available" : "Claimed"}
              </div>
              <div className="text-xs text-muted-foreground">{account.claimsCount} past claims</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Eye className="h-3 w-3" /> {viewCount.toLocaleString()} views
              </div>

              {/* Admin/Mod/Owner actions only */}
              {canManage && (
                <div className="flex gap-2 w-full mt-1">
                  {user.id === account.userId && (
                    <Button size="sm" variant="outline" onClick={startEdit} className="flex-1 gap-1 text-xs">
                      <Edit2 className="h-3 w-3" /> Edit
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={handleDelete} className="flex-1 gap-1 text-xs">
                    <Trash className="h-3 w-3" /> Delete
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main */}
          <div className="col-span-1 md:col-span-2 space-y-6">

            {/* Credentials panel */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border bg-muted/20">
                <Lock className="h-4 w-4 text-muted-foreground" />
                <span className="font-bold text-sm">STEAM Account Information</span>
              </div>

              <div className="p-5">
                {claimResult ? (
                  <div className="space-y-3">
                    <CopyField label="Account" value={claimResult.username} />
                    <CopyField label="Password" value={claimResult.password} />
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-6 text-center">
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20">
                      <Lock className="h-7 w-7 text-primary" />
                    </div>
                    <div>
                      <p className="font-bold text-base mb-1">View account credentials</p>
                      <p className="text-sm text-muted-foreground">
                        {account.pointsCost === 0 ? "Claim this account for free to reveal the Steam login." : `Spend ${account.pointsCost} points to reveal the Steam login.`}
                      </p>
                    </div>
                    {(() => {
                      const method = (account as any).unlockMethod ?? "login";
                      const isOwner = user?.id === account.userId;
                      const gateBlocked = !isOwner && user && (
                        (method === "like" && !account.userHasLiked) ||
                        (method === "comment" && !(account as any).userHasCommented)
                      );
                      if (gateBlocked) {
                        return (
                          <Button disabled variant="outline" className="gap-2 font-bold w-full">
                            <Lock className="h-4 w-4" />
                            {method === "like" ? "Like to Unlock" : "Comment to Unlock"}
                          </Button>
                        );
                      }
                      if (account.isAvailable) {
                        return (
                          <>
                            <Button className="gap-2 font-bold" onClick={handleClaim} disabled={claimAccount.isPending}>
                              {claimAccount.isPending ? "Claiming..." : account.pointsCost === 0 ? "Claim for Free" : `Claim for ${account.pointsCost} pts`}
                            </Button>
                            {claimError && <p className="text-sm text-red-500 mt-1">{claimError}</p>}
                          </>
                        );
                      }
                      return <Button disabled>Currently Unavailable</Button>;
                    })()}
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <CollapsibleSection title="Games List" items={account.games} />
                </div>

                {/* Community Rating + Like + Report — 4 buttons in 2 rows */}
                <div className="mt-4 border-t border-border pt-4 space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Community Rating</p>
                  <div className="flex gap-3">
                    <Button
                      size="sm"
                      variant={(account as any).myVote === "working" ? "default" : "outline"}
                      onClick={() => user ? voteMutation.mutate({ vote: "working" }) : null}
                      disabled={!user || voteMutation.isPending}
                      className={`flex-1 gap-2 ${(account as any).myVote === "working" ? "bg-green-600 hover:bg-green-700 border-green-600" : "border-green-600/30 text-green-600 hover:bg-green-600/10"}`}
                    >
                      <ThumbsUp className="h-4 w-4" /> Working
                      <span className="ml-auto text-xs font-mono">{account.workingVotes ?? 0}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant={(account as any).myVote === "not_working" ? "default" : "outline"}
                      onClick={() => user ? voteMutation.mutate({ vote: "not_working" }) : null}
                      disabled={!user || voteMutation.isPending}
                      className={`flex-1 gap-2 ${(account as any).myVote === "not_working" ? "bg-red-600 hover:bg-red-700 border-red-600" : "border-red-500/30 text-red-500 hover:bg-red-500/10"}`}
                    >
                      <ThumbsDown className="h-4 w-4" /> Not Working
                      <span className="ml-auto text-xs font-mono">{account.notWorkingVotes ?? 0}</span>
                    </Button>
                  </div>

                  {/* Like + Report — same style & size as Working/Not Working, visible to all */}
                  <div className="flex gap-3">
                    <Button
                      size="sm"
                      variant={account.userHasLiked ? "default" : "outline"}
                      onClick={() => { if (!user) { setLikeError("Log in to like."); return; } handleLike(); }}
                      disabled={likeAccount.isPending || unlikeAccount.isPending}
                      className={`flex-1 gap-2 ${account.userHasLiked ? "bg-primary hover:bg-primary/90 border-primary" : "border-primary/30 text-primary hover:bg-primary/10"}`}
                    >
                      <Heart className={`h-4 w-4 ${account.userHasLiked ? "fill-white" : ""}`} />
                      {account.userHasLiked ? "Liked" : "Like"}
                      <span className="ml-auto text-xs font-mono">{account.likesCount}</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { if (!user) return; setReportOpen(true); }}
                      disabled={!user}
                      className="flex-1 gap-2 border-red-500/30 text-red-500 hover:bg-red-500/10"
                    >
                      <Flag className="h-4 w-4" /> Report
                    </Button>
                  </div>

                  {totalVotes > 0 && (
                    <div className="space-y-1">
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-green-500 transition-all" style={{ width: `${workingPct}%` }} />
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{workingPct}% working</span>
                        <span>{totalVotes} votes</span>
                      </div>
                    </div>
                  )}
                  {likeError && <p className="text-xs text-red-500">{likeError}</p>}
                  {!user && <p className="text-xs text-muted-foreground">Log in to vote, like, or report.</p>}
                </div>

                {/* Unlock gate — shown when unlock method is like or comment and not yet met */}
                {(() => {
                  const method = (account as any).unlockMethod ?? "login";
                  const hasLiked = account.userHasLiked;
                  const hasCommented = (account as any).userHasCommented;
                  if (method === "like" && !hasLiked && user && user.id !== account.userId) {
                    return (
                      <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20 text-sm text-center space-y-2">
                        <p className="font-medium text-primary">Like this post to unlock credentials</p>
                        <p className="text-xs text-muted-foreground">The author requires a like before you can claim.</p>
                      </div>
                    );
                  }
                  if (method === "comment" && !hasCommented && user && user.id !== account.userId) {
                    return (
                      <div className="mt-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/20 text-sm text-center space-y-2">
                        <p className="font-medium text-amber-600">Leave a comment to unlock credentials</p>
                        <p className="text-xs text-muted-foreground">The author requires a comment before you can claim.</p>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
            </div>

            {/* Description */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-primary rounded-sm inline-block" /> Description
              </h3>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">{account.description}</p>
            </div>

            {/* Comments */}
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" /> Discussion ({comments?.length || 0})
              </h3>

              <div className="flex gap-4 mb-8">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={user?.avatarUrl || undefined} />
                  <AvatarFallback>{user?.username?.substring(0, 2).toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Textarea
                    placeholder="Ask a question or leave a comment..."
                    className="min-h-[80px] resize-none"
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                  />
                  {commentError && <p className="text-sm text-red-500">{commentError}</p>}
                  <div className="flex justify-end">
                    <Button onClick={async () => {
                      if (!user) { setCommentError("You must be logged in."); return; }
                      if (!commentContent.trim()) return;
                      try {
                        await createComment.mutateAsync({ accountId: id, data: { content: commentContent } });
                        setCommentContent("");
                        queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
                      } catch (e: any) { setCommentError(e.message || "Could not post"); }
                    }} disabled={!commentContent.trim() || createComment.isPending}>
                      {createComment.isPending ? "Posting..." : "Post Comment"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {commentsLoading ? (
                  <div className="space-y-4"><Skeleton className="h-20 w-full" /><Skeleton className="h-20 w-full" /></div>
                ) : comments?.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground italic">No comments yet.</div>
                ) : (
                  comments?.map((comment) => (
                    <div key={comment.id} className="flex gap-4 group">
                      <Link href={`/profile/${comment.userId}`}>
                        <Avatar className="h-10 w-10 shrink-0 cursor-pointer">
                          <AvatarImage src={comment.avatarUrl || undefined} />
                          <AvatarFallback>{comment.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                      </Link>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <div>
                            <Link href={`/profile/${comment.userId}`} className="font-semibold hover:text-primary transition-colors">{comment.username}</Link>
                            <span className="text-xs text-muted-foreground ml-2">{formatDistanceToNow(new Date(comment.createdAt))} ago</span>
                          </div>
                          {(user?.id === comment.userId || user?.isAdmin || (user as any)?.isModerator) && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={async () => { await deleteComment.mutateAsync({ accountId: id, commentId: comment.id }); queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) }); }}>
                              <Trash className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="mt-1 text-sm">{comment.content}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Button variant="ghost" size="sm" className={`h-6 px-2 text-xs flex gap-1 ${comment.userHasLiked ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                            onClick={async () => {
                              if (!user) return;
                              if (comment.userHasLiked) await unlikeComment.mutateAsync({ accountId: id, commentId: comment.id });
                              else await likeComment.mutateAsync({ accountId: id, commentId: comment.id });
                              queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
                            }}>
                            <Heart className={`h-3 w-3 ${comment.userHasLiked ? "fill-primary text-primary" : ""}`} />
                            {comment.likesCount}
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar — Poster Profile */}
          <div className="space-y-4">
            <div className="bg-card border border-border rounded-xl p-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Posted by</p>

              {/* Avatar + username */}
              <Link href={`/profile/${account.userId}`} className="flex items-center gap-3 group">
                <Avatar className="h-12 w-12 border border-border group-hover:border-primary transition-colors">
                  <AvatarImage src={poster?.avatarUrl || undefined} />
                  <AvatarFallback>{account.posterUsername?.substring(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold group-hover:text-primary transition-colors">{account.posterUsername}</p>
                  {poster?.badgeName && (
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/40 text-primary mt-0.5">{poster.badgeName}</Badge>
                  )}
                </div>
              </Link>

              {/* Stats row */}
              {poster && (
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Level</p>
                    <p className="font-bold text-sm">{poster.level}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">Points</p>
                    <p className="font-bold text-sm">{poster.points.toLocaleString()}</p>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2">
                    <p className="text-xs text-muted-foreground">XP</p>
                    <p className="font-bold text-sm">{poster.xp.toLocaleString()}</p>
                  </div>
                </div>
              )}

              {/* Message + Report — non-owners only */}
              {user && user.id !== account.userId && (
                <div className="space-y-2">
                  <Link href={`/messages?user=${account.userId}&username=${encodeURIComponent(account.posterUsername ?? "")}`}>
                    <Button variant="outline" className="w-full gap-2">
                      <MessageCircle className="h-4 w-4" /> Message {account.posterUsername}
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    className="w-full gap-2 text-muted-foreground hover:text-red-500 text-sm"
                    onClick={() => setReportOpen(true)}
                  >
                    <Flag className="h-4 w-4" /> Report this post
                  </Button>
                </div>
              )}
            </div>

            {/* Hidden report dialog — triggered by sidebar button */}
            <Dialog open={reportOpen} onOpenChange={setReportOpen}>
              <DialogContent className="bg-card border-border max-w-sm">
                <DialogHeader><DialogTitle>Report this post</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Reason</label>
                    <select className="w-full border border-border rounded-lg px-3 py-2 bg-background text-sm" value={reportReason} onChange={(e) => setReportReason(e.target.value)}>
                      <option value="">Select a reason...</option>
                      <option value="spam">Spam or misleading</option>
                      <option value="fake">Fake or invalid credentials</option>
                      <option value="inappropriate">Inappropriate content</option>
                      <option value="scam">Potential scam</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Details (optional)</label>
                    <Textarea placeholder="Add more details..." value={reportDetails} onChange={(e) => setReportDetails(e.target.value)} className="resize-none" rows={3} />
                  </div>
                  <Button className="w-full" onClick={() => reportMutation.mutate()} disabled={!reportReason || reportMutation.isPending}>
                    {reportMutation.isPending ? "Submitting..." : "Submit Report"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </Layout>
  );
}
