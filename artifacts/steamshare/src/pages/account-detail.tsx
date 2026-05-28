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
  useGetMe
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
import { Heart, Coins, ShieldCheck, MessageSquare, Trash, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function AccountDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  const { data: user } = useGetMe({ query: { retry: false } });
  const { data: account, isLoading: accountLoading } = useGetAccount(id, { query: { enabled: !!id } });
  const { data: comments, isLoading: commentsLoading } = useListComments(id, { query: { enabled: !!id } });
  
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [commentContent, setCommentContent] = useState("");
  const [claimResult, setClaimResult] = useState<{username: string, password: string} | null>(null);

  const likeAccount = useLikeAccount();
  const unlikeAccount = useUnlikeAccount();
  const claimAccount = useClaimAccount();
  const createComment = useCreateComment();
  const likeComment = useLikeComment();
  const unlikeComment = useUnlikeComment();
  const deleteComment = useDeleteComment();

  const handleLikeAccount = async () => {
    if (!user) return toast({ title: "Login required", description: "You must be logged in to like accounts.", variant: "destructive" });
    if (!account) return;

    try {
      if (account.userHasLiked) {
        await unlikeAccount.mutateAsync({ accountId: id });
      } else {
        await likeAccount.mutateAsync({ accountId: id });
      }
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
    } catch (e: any) {
      toast({ title: "Error", description: e.message || "Failed to update like status", variant: "destructive" });
    }
  };

  const handleClaim = async () => {
    if (!user) return toast({ title: "Login required", description: "You must be logged in to claim accounts.", variant: "destructive" });
    if (!account) return;
    
    if (user.points < account.pointsCost) {
      return toast({ title: "Not enough points", description: `You need ${account.pointsCost} points but only have ${user.points}.`, variant: "destructive" });
    }

    try {
      const res = await claimAccount.mutateAsync({ accountId: id });
      setClaimResult({ username: res.steamUsername, password: res.steamPassword });
      queryClient.invalidateQueries({ queryKey: getGetAccountQueryKey(id) });
    } catch (e: any) {
      toast({ title: "Claim failed", description: e.message || "Failed to claim account", variant: "destructive" });
    }
  };

  const handleCommentSubmit = async () => {
    if (!user) return toast({ title: "Login required", description: "You must be logged in to comment.", variant: "destructive" });
    if (!commentContent.trim()) return;

    try {
      await createComment.mutateAsync({ accountId: id, data: { content: commentContent } });
      setCommentContent("");
      queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
      toast({ title: "Comment posted!" });
    } catch (e: any) {
      toast({ title: "Failed to post", description: e.message || "Could not post comment", variant: "destructive" });
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

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        
        {/* Header Hero */}
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
              <h1 className="text-3xl md:text-4xl font-black text-foreground">{account.title}</h1>
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
            
            <div className="shrink-0 flex flex-col items-center gap-4 w-full md:w-auto bg-background/50 p-6 rounded-lg border border-border">
              <div className="text-center space-y-1">
                <div className="text-2xl font-bold flex justify-center items-center gap-2">
                  <ShieldCheck className={account.isAvailable ? "text-green-500" : "text-muted-foreground"} />
                  {account.isAvailable ? "Available" : "Claimed"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {account.claimsCount} past claims
                </div>
              </div>
              
              {account.isAvailable ? (
                <Button 
                  size="lg" 
                  className="w-full font-bold" 
                  onClick={handleClaim}
                  disabled={claimAccount.isPending}
                  data-testid="button-claim"
                >
                  {claimAccount.isPending ? "Claiming..." : "Claim Credentials"}
                </Button>
              ) : (
                <Button size="lg" disabled className="w-full">Currently Unavailable</Button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Main Info */}
          <div className="col-span-1 md:col-span-2 space-y-6">
            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <span className="w-1.5 h-5 bg-primary rounded-sm inline-block" /> Description
              </h3>
              <p className="text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {account.description}
              </p>
            </div>
            
            {/* Comments Section */}
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
                  comments?.map(comment => (
                    <div key={comment.id} className="flex gap-4 group">
                      <Link href={`/profile/${comment.userId}`}>
                        <Avatar className="h-10 w-10 shrink-0 cursor-pointer">
                          <AvatarImage src={comment.avatarUrl || undefined} />
                          <AvatarFallback>{comment.username.substring(0,2).toUpperCase()}</AvatarFallback>
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
                            className={`h-6 px-2 text-xs flex gap-1 ${comment.userHasLiked ? 'text-primary bg-primary/10' : 'text-muted-foreground'}`}
                            onClick={async () => {
                              if (!user) return toast({ title: "Login required" });
                              if (comment.userHasLiked) {
                                await unlikeComment.mutateAsync({ accountId: id, commentId: comment.id });
                              } else {
                                await likeComment.mutateAsync({ accountId: id, commentId: comment.id });
                              }
                              queryClient.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
                            }}
                          >
                            <Heart className={`h-3 w-3 ${comment.userHasLiked ? 'fill-primary text-primary' : ''}`} />
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

            <div className="bg-card border border-border rounded-xl p-6">
              <h3 className="font-bold mb-4 uppercase tracking-wider text-xs text-muted-foreground">Community</h3>
              <Button 
                variant="outline" 
                className={`w-full justify-start gap-2 h-12 ${account.userHasLiked ? 'border-primary/50 text-primary bg-primary/10' : ''}`}
                onClick={handleLikeAccount}
                disabled={likeAccount.isPending || unlikeAccount.isPending}
                data-testid="button-like"
              >
                <Heart className={account.userHasLiked ? "fill-primary" : ""} />
                {account.userHasLiked ? "Liked" : "Like Account"} 
                <span className="ml-auto bg-background px-2 py-0.5 rounded-full text-xs">{account.likesCount}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={!!claimResult} onOpenChange={(open) => !open && setClaimResult(null)}>
        <DialogContent className="sm:max-w-md bg-card border-primary/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Lock className="h-5 w-5 text-primary" /> Credentials Claimed
            </DialogTitle>
            <DialogDescription>
              Copy these credentials now. They will not be shown again.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-4">
            <div className="bg-background p-4 rounded-md border border-border space-y-3 font-mono">
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Steam Username</div>
                <div className="font-bold text-foreground text-lg break-all select-all">{claimResult?.username}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1 uppercase tracking-wider">Steam Password</div>
                <div className="font-bold text-foreground text-lg break-all select-all">{claimResult?.password}</div>
              </div>
            </div>
            <p className="text-sm text-yellow-500 font-medium bg-yellow-500/10 p-3 rounded border border-yellow-500/20">
              Please change the account password and email immediately to secure your new account.
            </p>
          </div>
          
          <div className="flex justify-end">
            <Button onClick={() => setClaimResult(null)}>Close & Understand</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
