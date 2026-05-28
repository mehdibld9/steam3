import { Layout } from "@/components/layout";
import { useGetUser, useGetUserAccounts } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountCard } from "@/components/account-card";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Heart, Gamepad2, Award } from "lucide-react";
import { format } from "date-fns";

export default function Profile() {
  const params = useParams();
  const id = parseInt(params.id || "0");
  
  const { data: user, isLoading: userLoading } = useGetUser(id, { query: { enabled: !!id } });
  const { data: accounts, isLoading: accountsLoading } = useGetUserAccounts(id, { query: { enabled: !!id } });

  const xpProgress = user ? (user.xp % 100) : 0;

  if (userLoading) {
    return (
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
  }

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold">User Not Found</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-8">
        
        {/* Profile Header */}
        <div className="bg-card border border-border rounded-xl p-8 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
          
          <div className="flex flex-col md:flex-row items-center md:items-start gap-8 relative z-10">
            <Avatar className="h-32 w-32 border-4 border-background shadow-xl">
              <AvatarImage src={user.avatarUrl || undefined} />
              <AvatarFallback className="text-4xl bg-secondary">{user.username.substring(0,2).toUpperCase()}</AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center md:text-left space-y-4">
              <div>
                <h1 className="text-3xl font-black mb-2 flex items-center justify-center md:justify-start gap-3">
                  {user.username}
                  {user.isBanned && <Badge variant="destructive">BANNED</Badge>}
                </h1>
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <CalendarDays className="h-4 w-4" /> Joined {format(new Date(user.createdAt), "MMMM yyyy")}
                  </div>
                  {user.badgeName && (
                    <Badge variant="outline" className="text-primary border-primary/30 bg-primary/10 flex items-center gap-1">
                      <Award className="h-3 w-3" /> {user.badgeName}
                    </Badge>
                  )}
                </div>
              </div>
              
              {/* Level & XP Bar */}
              <div className="bg-background/50 border border-border rounded-lg p-4 max-w-md">
                <div className="flex justify-between items-end mb-2">
                  <span className="font-bold text-lg">Level {user.level}</span>
                  <span className="text-xs text-primary font-mono">{user.xp} Total XP</span>
                </div>
                <Progress value={xpProgress} className="h-3" />
                <div className="text-[10px] text-muted-foreground mt-2 text-right">
                  {100 - xpProgress} XP to next level
                </div>
              </div>
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 w-full md:w-auto">
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
        </div>

        {/* User's Accounts */}
        <div>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <span className="w-1.5 h-6 bg-primary rounded-sm inline-block" /> 
            Upload History
          </h2>
          
          {accountsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-xl" />)}
            </div>
          ) : accounts?.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border border-dashed rounded-xl">
              <p className="text-muted-foreground">This user hasn't uploaded any accounts yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {accounts?.map(account => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          )}
        </div>

      </div>
    </Layout>
  );
}
