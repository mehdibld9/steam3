import { Layout } from "@/components/layout";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Trophy, Medal, Crown, Star, Shield, ArrowLeft } from "lucide-react";
import { getLevelColor } from "@/lib/level-colors";

export default function Leaderboard() {
  const { data: users, isLoading } = useGetLeaderboard({ limit: 50 });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <button onClick={() => window.history.back()} className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
            <Trophy className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-black mb-4 tracking-tight">Hall of Fame</h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            The most elite traders, uploaders, and contributors in the SteamShare network. Earn XP by contributing to climb the ranks.
          </p>
        </div>

        <div className="bg-card border border-border rounded-xl overflow-hidden shadow-xl">
          <div className="grid grid-cols-12 gap-4 p-4 border-b border-border bg-muted/50 text-sm font-semibold text-muted-foreground">
            <div className="col-span-2 md:col-span-1 text-center">Rank</div>
            <div className="col-span-7 md:col-span-7">User</div>
            <div className="col-span-3 md:col-span-2 text-center hidden md:block">Level</div>
            <div className="col-span-3 md:col-span-2 text-right">Total XP</div>
          </div>

          <div className="divide-y divide-border">
            {isLoading ? (
              [...Array(10)].map((_, i) => (
                <div key={i} className="grid grid-cols-12 gap-4 p-4 items-center">
                  <div className="col-span-12"><Skeleton className="h-10 w-full" /></div>
                </div>
              ))
            ) : users?.map((user, index) => {
              const isTop3 = index < 3;
              const rankColors = [
                "text-yellow-500 bg-yellow-500/10 border-yellow-500/20",
                "text-slate-300 bg-slate-300/10 border-slate-300/20",
                "text-amber-600 bg-amber-600/10 border-amber-600/20"
              ];
              const levelColor = getLevelColor(user.level);
              const isAdmin = (user as any).isAdmin;
              const isModerator = (user as any).isModerator;
              
              return (
                <Link key={user.id} href={`/profile/${user.id}`} className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/50 transition-colors group">
                  <div className="col-span-2 md:col-span-1 text-center font-bold">
                    {isTop3 ? (
                      <div className={`mx-auto w-8 h-8 flex items-center justify-center rounded-full border ${rankColors[index]}`}>
                        {index === 0 ? <Crown className="h-4 w-4" /> : index === 1 ? <Medal className="h-4 w-4" /> : <Star className="h-4 w-4" />}
                      </div>
                    ) : (
                      <span className="text-muted-foreground group-hover:text-foreground transition-colors">#{index + 1}</span>
                    )}
                  </div>
                  
                  <div className="col-span-7 flex items-center gap-3">
                    <div
                      className="rounded-full p-[2px] shrink-0"
                      style={{ background: levelColor }}
                    >
                      <Avatar className="h-9 w-9 border-2 border-background">
                        <AvatarImage src={user.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs">{(user.username?.substring(0, 2) ?? "").toUpperCase()}</AvatarFallback>
                      </Avatar>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                        {(user as any).displayName || user.username}
                      </span>
                      {isAdmin && (
                        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/40 text-[10px] flex items-center gap-0.5 h-4 px-1.5">
                          <Shield className="h-2.5 w-2.5" />ADMIN
                        </Badge>
                      )}
                      {isModerator && !isAdmin && (
                        <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-[10px] flex items-center gap-0.5 h-4 px-1.5">
                          <Shield className="h-2.5 w-2.5" />MOD
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="col-span-3 md:col-span-2 hidden md:flex text-center justify-center">
                    <Badge variant="secondary" className="font-mono text-xs" style={{ color: levelColor, borderColor: `${levelColor}40` }}>
                      LVL {user.level}
                    </Badge>
                  </div>
                  
                  <div className="col-span-3 md:col-span-2 text-right font-mono font-medium text-primary">
                    {user.xp.toLocaleString()} XP
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
}
