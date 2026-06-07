import { Link, useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useLogout } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import { Shield, Plus, LogOut, Coins, Trophy, Award, Gift, MessageSquare, Menu, X } from "lucide-react";
import { useState } from "react";

async function fetchUnreadCount(): Promise<number> {
  try {
    const res = await fetch("/api/messages/unread/count", { credentials: "include" });
    if (!res.ok) return 0;
    const data = await res.json();
    return data.count ?? 0;
  } catch {
    return 0;
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetMe();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-messages"],
    queryFn: fetchUnreadCount,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  const handleLogout = async () => {
    try {
      await logout.mutateAsync(undefined);
    } catch {
      // ignore errors — session may already be gone
    }
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
    setMobileOpen(false);
  };

  const xpProgress = user ? (user.xp % 100) : 0;

  const navLinks = [
    { href: "/browse", label: "Browse" },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/badges", label: "Badges", icon: Award },
    { href: "/giveaways", label: "Giveaways", icon: Gift },
    { href: "/earn", label: "Earn Points", icon: Coins },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container flex h-16 items-center justify-between mx-auto px-4">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="font-black text-xl tracking-tight text-foreground">Steam Family</span>
            </Link>

            <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
              {navLinks.map((l) => (
                <Link key={l.href} href={l.href} className="text-muted-foreground hover:text-foreground transition-colors">
                  {l.icon ? (
                    <span className="flex items-center gap-1">
                      <l.icon className="h-3.5 w-3.5" />{l.label}
                    </span>
                  ) : l.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Desktop right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <>
                {(user.isAdmin || (user as any).isModerator) && (
                  <Link href="/admin">
                    <Button variant="outline" size="sm" className="gap-1.5 border-primary/30 text-primary">
                      <Shield className="h-3.5 w-3.5" />
                      {user.isAdmin ? "Admin" : "Mod"}
                    </Button>
                  </Link>
                )}
                <Link href="/messages">
                  <Button variant="ghost" size="sm" className="gap-1.5 relative">
                    <MessageSquare className="h-4 w-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </Button>
                </Link>
                <Link href="/submit">
                  <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" />Share Account</Button>
                </Link>
                <Link href={`/profile/${user.id}`}>
                  <div className="relative group cursor-pointer">
                    <Avatar className="h-8 w-8 border border-border group-hover:border-primary transition-colors">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs">{user.username.substring(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="absolute bottom-0 right-0 translate-x-1 translate-y-1">
                      <div className="bg-primary text-white text-[8px] font-black rounded px-0.5 leading-tight">{user.level}</div>
                    </div>
                  </div>
                </Link>
                <div className="hidden lg:flex flex-col items-end">
                  <span className="text-xs font-bold">{user.username}</span>
                  <span className="text-[10px] text-primary font-mono">{user.points} pts</span>
                </div>
                <Button variant="ghost" size="icon" onClick={handleLogout} className="text-muted-foreground hover:text-destructive h-8 w-8">
                  <LogOut className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <Link href="/login"><Button variant="ghost" size="sm">Login</Button></Link>
                <Link href="/register"><Button size="sm">Register</Button></Link>
              </>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-md text-muted-foreground hover:text-foreground"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* XP bar */}
        {user && (
          <div className="h-0.5 bg-muted">
            <div className="h-0.5 bg-primary transition-all duration-700" style={{ width: `${xpProgress}%` }} />
          </div>
        )}
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[60] flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="relative z-50 ml-auto w-72 h-full bg-card border-l border-border flex flex-col overflow-y-auto">
            {user && (
              <div className="p-4 border-b border-border space-y-2">
                <Link href={`/profile/${user.id}`} onClick={() => setMobileOpen(false)}>
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback>{user.username.substring(0,2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm">{user.username}</p>
                      <p className="text-xs text-primary">{user.points} pts · Lv {user.level}</p>
                    </div>
                  </div>
                </Link>
                <Progress value={xpProgress} className="h-1.5" />
              </div>
            )}

            <nav className="flex-1 p-4 space-y-1">
              {navLinks.map((l) => (
                <Link key={l.href} href={l.href}>
                  <button
                    onClick={() => setMobileOpen(false)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${location === l.href ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"}`}
                  >
                    {l.icon && <l.icon className="h-4 w-4" />}
                    {l.label}
                  </button>
                </Link>
              ))}

              {user && (
                <>
                  <Link href="/messages">
                    <button
                      onClick={() => setMobileOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                    >
                      <MessageSquare className="h-4 w-4" />
                      Messages
                      {unreadCount > 0 && (
                        <span className="ml-auto bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unreadCount}</span>
                      )}
                    </button>
                  </Link>

                  {(user.isAdmin || (user as any).isModerator) && (
                    <Link href="/admin">
                      <button
                        onClick={() => setMobileOpen(false)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                      >
                        <Shield className="h-4 w-4" />
                        {user.isAdmin ? "Admin Panel" : "Mod Panel"}
                      </button>
                    </Link>
                  )}

                  <Link href="/submit">
                    <button
                      onClick={() => setMobileOpen(false)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Share Account
                    </button>
                  </Link>
                </>
              )}
            </nav>

            <div className="p-4 border-t border-border space-y-2">
              {user ? (
                <Button variant="outline" className="w-full gap-2 text-destructive border-destructive/20" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  Log out
                </Button>
              ) : (
                <>
                  <Link href="/login"><Button variant="outline" className="w-full" onClick={() => setMobileOpen(false)}>Login</Button></Link>
                  <Link href="/register"><Button className="w-full" onClick={() => setMobileOpen(false)}>Register</Button></Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Steam Family
      </footer>
    </div>
  );
}
