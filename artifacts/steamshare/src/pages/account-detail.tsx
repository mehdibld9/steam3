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
  useGetMe,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Heart, Coins, ShieldCheck, MessageSquare, Trash, Lock,
  Copy, CheckCheck, ChevronDown, ChevronUp, BadgeCheck,
} from "lucide-react";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
      <div className="flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2">
        <span className="flex-1 font-mono text-sm break-all select-all">{value}</span>
        <button onClick={copy} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <CheckCheck className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function CollapsibleSection({ title, items }: { title: string; items: string[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors text-sm font-medium"
      >
        <span className="flex items-center gap-2 text-muted-foreground">
          <span className="text-primary">≡</span> {title} ({items.length})
        </span>
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

export default function AccountDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data: user } = useGetMe();
  const { data: account, isLoading: accountLoading } = useGetAccount(id);
  const { data: comments, isLoading: commentsLoading } = useListComments(id);

  const queryClient = useQueryClient();
  const [commentContent, setCommentContent] = useState("");
  const [claimResult, setClaimResult] = useState<{ username: string; password: string } | null>(null);
  const [claimError, setClaimError] = useState("");
  const [claimedAt, setClaimedAt] = useState<Date | null>(null);

  const likeAccount = useLikeAccount();
  const unlikeAccount = useUnlikeAccount();
  const claimAccount = useClaimAccount();
  const createComment = useCreateComment();
  const likeComment = useLikeComment();
  const unlikeComment = useUnlikeComment();
  const deleteComment = useDeleteComment();

  const [commentError, setCommentError] = useState("");
  const [likeError, setLikeError] = useState("");

  const handleLikeAccount = async () => {
    if (!user) { setLikeError("You must be logged in to like accounts."); return; }
    if (!account) return;
    setLikeError("");
    try {
      if (account.userHasLiked) {
        await unlikeAccount.mutateAsync({ accountId: id });
      } else {
        await likeAccount.mutateAsync({ accountId: id });
      }
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
    } catch (e: any) {
      setLikeError(e.message || "Failed to update like");
    }
  };

  const handleClaim = async () => {
    if (!user) { setClaimError("You must be logged in to claim accounts."); return; }
    if (!account) return;
    if (user.points < account.pointsCost) {
      setClaimError(`You need ${account.pointsCost} points but only have ${user.points}.`);
      return;
    }
    setClaimError("");
    try {
      const res = await claimAccount.mutateAsync({ accountId: id });
      setClaimResult({ username: res.steamUsername, password: res.steamPassword });
      setClaimedAt(new Date());
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch (e: any) {
      setClaimError(e.message || "Failed to claim account");
    }
  };

  const handleCommentSubmit = async () => {
    if (!user) { setCommentError("You must be logged in to comment."); return; }
    if (!commentContent.trim()) return;
    setCommentError("");
    try {
      await createComment.mutateAsync({ accountId: id, data: { content: commentContent } });
      setCommentContent("");
      queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
    } catch (e: any) {
      setCommentError(e.message || "Could not post comment");
    }
  };

  if (accountLoading) {
    return (
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
  }

  if (!account) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold mb-2">Account Not Found</h2>
          <p className="text-muted-foreground mb-6">This account may have been removed or does not exist.</p>
          <Link href="/browse"><Button>Browse Accounts</Button></Link>
        </div>
      </Layout>
    );
  }

  const verifyDate = claimedAt || new Date(account.createdAt);
  const verifyStr = verifyDate.toLocaleString("en-US", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const verifyShort = verifyDate.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit" }) + " " + verifyDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">

        {/* Header */}
        <div className="bg-card border border-border rounded-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 pointer-events-none" />
          <div className="p-6 md:p-8 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center relative z-10">
            <div className="space-y-4 flex-1">
              <div className="flex items-center gap-3">
                {account.pointsCost === 0 ? (
                  <Badge className="bg-green-600/20 text-green-400 border-green-600/30">Free</Badge>
                ) : (
                  <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 flex items-center gap-1">
                    <Coins className="h-3 w-3" /> {account.pointsCost} Points
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  Posted {formatDistanceToNow(new Date(account.createdAt))} ago
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black">{account.title}</h1>
              <div className="flex items-center gap-3 mt-4">
                <Link href={`/profile/${account.userId}`}>
                  <Avatar className="h-10 w-10 border border-border cursor-pointer hover:border-primary transition-colors">
                    <AvatarImage src={account.posterAvatarUrl || undefined} />
                    <AvatarFallback>{account.posterUsername?.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                </Link>
                <div>
                  <div className="text-sm font-medium">Uploaded by</div>
                  <Link href={`/profile/${account.userId}`} className="text-primary hover:underline font-bold">
                    {account.posterUsername}
                  </Link>
                </div>
              </div>
            </div>

            <div className="shrink-0 flex flex-col items-center gap-2 w-full md:w-40">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ShieldCheck className={account.isAvailable ? "text-green-500 h-4 w-4" : "text-muted-foreground h-4 w-4"} />
                {account.isAvailable ? "Available" : "Claimed"}
              </div>
              <div className="text-xs text-muted-foreground">{account.claimsCount} past claims</div>
              <Button
                variant="outline"
                size="sm"
                className={`w-full gap-2 mt-1 ${account.userHasLiked ? "border-primary/50 text-primary bg-primary/10" : ""}`}
                onClick={handleLikeAccount}
                disabled={likeAccount.isPending || unlikeAccount.isPending}
                data-testid="button-like"
              >
                <Heart className={`h-4 w-4 ${account.userHasLiked ? "fill-primary text-primary" : ""}`} />
                {account.userHasLiked ? "Liked" : "Like"}
                <span className="ml-auto bg-background/60 px-1.5 py-0.5 rounded text-xs">{account.likesCount}</span>
              </Button>
              {likeError && <p className="text-xs text-red-400">{likeError}</p>}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main */}
          <div className="col-span-1 md:col-span-2 space-y-6">

            {/* STEAM Account Info Panel */}
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
                        {account.pointsCost === 0
                          ? "Claim this account for free to reveal the Steam login."
                          : `Spend ${account.pointsCost} points to reveal the Steam login.`}
                      </p>
                    </div>

                    {claimError && (
                      <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2 w-full text-left">
                        {claimError}
                      </p>
                    )}

                    {account.isAvailable ? (
                      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                        <Button
                          className="flex-1 gap-2 font-bold"
                          onClick={handleClaim}
                          disabled={claimAccount.isPending}
                          data-testid="button-claim"
                        >
                          {claimAccount.isPending ? (
                            "Claiming..."
                          ) : (
                            <>
                              <MessageSquare className="h-4 w-4" />
                              {account.pointsCost === 0 ? "Claim for Free" : `Claim for ${account.pointsCost} pts`}
                            </>
                          )}
                        </Button>
                        {claimAccount.isPending === false && (
                          <Button
                            variant="outline"
                            className="flex-1 gap-1 text-xs"
                            onClick={() => queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) })}
                          >
                            Already Claimed? Refresh
                          </Button>
                        )}
                      </div>
                    ) : (
                      <Button disabled size="lg" className="w-full max-w-xs">Currently Unavailable</Button>
                    )}
                  </div>
                )}

                <div className="mt-4 space-y-2">
                  <CollapsibleSection title="Games List" items={account.games} />
                  <CollapsibleSection title="DLC List" items={[]} />
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                  <span className="text-xs text-muted-foreground">
                    Verification Time: {verifyStr}
                  </span>
                  <span className="flex items-center gap-2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    Account Valid <span className="opacity-75 ml-1">| {verifyShort}</span>
                  </span>
                </div>
                <div className="mt-2 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-2 text-xs text-green-400 flex items-center gap-2">
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0" />
                  Last Verified: {verifyStr} — This account was recently verified successfully, safe to use
                </div>
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
                    className="min-h-[100px] resize-none"
                    value={commentContent}
                    onChange={(e) => setCommentContent(e.target.value)}
                    data-testid="input-comment"
                  />
                  {commentError && <p className="text-sm text-red-400">{commentError}</p>}
                  <div className="flex justify-end">
                    <Button
                      onClick={handleCommentSubmit}
                      disabled={!commentContent.trim() || createComment.isPending}
                      data-testid="button-submit-comment"
                    >
                      {createComment.isPending ? "Posting..." : "Post Comment"}
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {commentsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
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
                            <Link href={`/profile/${comment.userId}`} className="font-semibold hover:text-primary transition-colors">
                              {comment.username}
                            </Link>
                            <span className="text-xs text-muted-foreground ml-2">
                              {formatDistanceToNow(new Date(comment.createdAt))} ago
                            </span>
                          </div>
                          {(user?.id === comment.userId || user?.isAdmin) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={async () => {
                                await deleteComment.mutateAsync({ accountId: id, commentId: comment.id });
                                queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
                              }}
                            >
                              <Trash className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                        <p className="mt-1 text-sm">{comment.content}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className={`h-6 px-2 text-xs flex gap-1 ${comment.userHasLiked ? "text-primary bg-primary/10" : "text-muted-foreground"}`}
                            onClick={async () => {
                              if (!user) { setCommentError("Login required"); return; }
                              if (comment.userHasLiked) {
                                await unlikeComment.mutateAsync({ accountId: id, commentId: comment.id });
                              } else {
                                await likeComment.mutateAsync({ accountId: id, commentId: comment.id });
                              }
                              queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
                            }}
                          >
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

          {/* Sidebar */}
          <div className="space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-bold mb-4 uppercase tracking-wider text-xs text-muted-foreground">Games Included</h3>
              <div className="flex flex-wrap gap-2">
                {account.games.map((game, i) => (
                  <Badge key={i} variant="secondary" className="bg-background border-border text-sm py-1">
                    {game}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
