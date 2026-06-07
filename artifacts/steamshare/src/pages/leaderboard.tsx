import { Layout } from "@/components/layout";
import { useGetLeaderboard } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";
import { Trophy, Medal, Crown, Star } from "lucide-react";

export default function Leaderboard() {
  const { data: users, isLoading } = useGetLeaderboard({ limit: 50 });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
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
            <div className="col-span-6 md:col-span-5">User</div>
            <div className="col-span-2 hidden md:block text-center">Level</div>
            <div className="col-span-4 md:col-span-2 text-right md:text-center">Total XP</div>
            <div className="col-span-2 hidden md:block text-right">Badge</div>
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
                  
                  <div className="col-span-6 md:col-span-5 flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border group-hover:border-primary/50 transition-colors">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback>{user.username?.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="font-semibold text-base group-hover:text-primary transition-colors truncate">
                      {user.username}
                    </div>
                  </div>
                  
                  <div className="col-span-2 hidden md:flex text-center justify-center">
                    <Badge variant="secondary" className="font-mono bg-background border-border">
                      LVL {user.level}
                    </Badge>
                  </div>
                  
                  <div className="col-span-4 md:col-span-2 text-right md:text-center font-mono font-medium text-primary">
                    {user.xp.toLocaleString()} XP
                  </div>
                  
                  <div className="col-span-2 hidden md:flex justify-end">
                    {user.badgeName ? (
                      <Badge variant="outline" className="text-xs bg-card/50">
                        {user.badgeName}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
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
