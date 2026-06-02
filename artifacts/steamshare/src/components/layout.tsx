import { Link } from "wouter";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQueryClient } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Shield, Plus, LogOut, Coins, Trophy, Award, Gift } from "lucide-react";

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetMe();
  const logout = useLogout();
  const queryClient = useQueryClient();

  const handleLogout = async () => {
    try {
      await logout.mutateAsync(undefined);
    } catch {
      // ignore errors — session may already be gone
    }
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
  };

  const xpProgress = user ? (user.xp % 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between mx-auto px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <span className="font-bold text-xl tracking-tight">SteamShare</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              <Link href="/browse" className="text-muted-foreground hover:text-foreground transition-colors">Browse</Link>
              <Link href="/leaderboard" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="flex items-center gap-1"><Trophy className="h-3.5 w-3.5" />Leaderboard</span>
              </Link>
              <Link href="/badges" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="flex items-center gap-1"><Award className="h-3.5 w-3.5" />Badges</span>
              </Link>
              <Link href="/giveaways" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" />Giveaways</span>
              </Link>
              <Link href="/earn" className="text-muted-foreground hover:text-foreground transition-colors">
                <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5" />Earn Points</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <>
                <Link href="/submit">
                  <Button variant="default" size="sm" className="hidden sm:flex gap-2" data-testid="link-submit">
                    <Plus className="h-4 w-4" /> Submit Account
                  </Button>
                </Link>
                <div className="flex items-center gap-4 border-r border-border pr-4 mr-2">
                  <div className="flex flex-col items-end">
                    <span className="text-sm font-bold text-primary flex items-center gap-1">
                      <Coins className="h-3 w-3" /> {user.points}
                    </span>
                    <div className="flex items-center gap-2 w-24">
                      <span className="text-[10px] text-muted-foreground font-mono">LVL {user.level}</span>
                      <Progress value={xpProgress} className="h-1.5" />
                    </div>
                  </div>
                </div>
                {user.isAdmin && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" data-testid="link-admin">Admin</Button>
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <Link href={`/profile/${user.id}`}>
                    <Avatar className="h-8 w-8 cursor-pointer border border-primary/20 hover:border-primary transition-colors">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback className="bg-secondary text-xs">{user.username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <Button variant="ghost" size="icon" onClick={handleLogout} data-testid="button-logout">
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link href="/login">
                  <Button variant="ghost" size="sm" data-testid="link-login">Login</Button>
                </Link>
                <Link href="/register">
                  <Button variant="default" size="sm" data-testid="link-register">Register</Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-card py-4 mt-12">
        <div className="container mx-auto px-4 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} SteamShare
        </div>
      </footer>
    </div>
  );
}
