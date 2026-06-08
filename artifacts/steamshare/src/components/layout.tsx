import { Link, useLocation } from "wouter";
import { useGetMe, getGetMeQueryKey, useLogout, useListGiveaways } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
import {
  Shield, Plus, LogOut, Coins, Trophy, Award, Gift,
  MessageSquare, Menu, X, ChevronRight, Bell, Home,
  LayoutGrid,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";

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

const SEEN_GIVEAWAYS_KEY = "steamfamily_seen_giveaways";

function getSeenIds(): number[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_GIVEAWAYS_KEY) ?? "[]");
  } catch {
    return [];
  }
}
function markAllSeen(ids: number[]) {
  localStorage.setItem(SEEN_GIVEAWAYS_KEY, JSON.stringify(ids));
}

const NAV_ITEMS = [
  { href: "/", label: "Home", icon: Home },
  { href: "/browse", label: "Browse", icon: LayoutGrid },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/badges", label: "Badges", icon: Award },
  { href: "/giveaways", label: "Giveaways", icon: Gift },
  { href: "/earn", label: "Earn Points", icon: Coins },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const { data: user } = useGetMe();
  const logout = useLogout();
  const queryClient = useQueryClient();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-messages"],
    queryFn: fetchUnreadCount,
    enabled: !!user,
    refetchInterval: 30_000,
  });

  // Giveaway notifications — track unseen active giveaways
  const { data: giveaways = [] } = useListGiveaways({
    query: { refetchInterval: 60_000 },
  });
  const activeGiveaways = giveaways.filter((g) => g.isActive);
  const [seenIds, setSeenIds] = useState<number[]>(getSeenIds);
  const newGiveaways = activeGiveaways.filter((g) => !seenIds.includes(g.id));
  const notifCount = newGiveaways.length;

  const openBell = () => {
    setBellOpen((o) => !o);
    if (!bellOpen && newGiveaways.length > 0) {
      const allIds = activeGiveaways.map((g) => g.id);
      markAllSeen(allIds);
      setSeenIds(allIds);
    }
  };

  // Close bell dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setBellOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const handleLogout = async () => {
    try {
      await logout.mutateAsync(undefined);
    } catch {
      // ignore
    }
    queryClient.setQueryData(getGetMeQueryKey(), null);
    queryClient.removeQueries({ queryKey: getGetMeQueryKey() });
    setMenuOpen(false);
  };

  const xpProgress = user ? (user.xp % 100) : 0;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* ── Header ── */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="flex h-14 items-center justify-between px-4">

          {/* Left: Logo (hidden on mobile) + Menu button */}
          <div className="flex items-center gap-3">
            <Link href="/" className="hidden sm:flex items-center">
              <span className="font-black text-xl tracking-tight text-foreground">Steam Family</span>
            </Link>
            <button
              onClick={() => setMenuOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-border text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
            >
              <Menu className="h-4 w-4" />
              Menu
            </button>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1.5">
            {user ? (
              <>
                {(user.isAdmin || (user as any).isModerator) && (
                  <Link href="/admin">
                    <button className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/40 text-primary text-sm font-medium hover:bg-primary/10 transition-colors">
                      <Shield className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{user.isAdmin ? "Admin" : "Mod"}</span>
                    </button>
                  </Link>
                )}

                {/* Post Account */}
                <Link href="/submit">
                  <button className="relative p-2 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors" title="Post Account">
                    <Plus className="h-5 w-5" />
                  </button>
                </Link>

                {/* Messages */}
                <Link href="/messages">
                  <button className="relative p-2 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors" title="Messages">
                    <MessageSquare className="h-5 w-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-primary text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </span>
                    )}
                  </button>
                </Link>

                {/* Bell / Giveaway notifications */}
                <div className="relative" ref={bellRef}>
                  <button
                    onClick={openBell}
                    className="relative p-2 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
                    title="Notifications"
                  >
                    <Bell className="h-5 w-5" />
                    {notifCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                        {notifCount > 9 ? "9+" : notifCount}
                      </span>
                    )}
                  </button>

                  {/* Bell dropdown */}
                  {bellOpen && (
                    <div className="absolute right-0 top-10 w-80 bg-card border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                        <span className="text-sm font-bold">Notifications</span>
                        <button onClick={() => setBellOpen(false)} className="text-muted-foreground hover:text-foreground">
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      {activeGiveaways.length === 0 ? (
                        <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                          No active giveaways right now
                        </div>
                      ) : (
                        <div className="max-h-72 overflow-y-auto divide-y divide-border">
                          {activeGiveaways.map((g) => (
                            <Link key={g.id} href="/giveaways">
                              <button
                                onClick={() => setBellOpen(false)}
                                className="w-full px-4 py-3 text-left hover:bg-secondary/50 transition-colors"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="mt-0.5 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                    <Gift className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">{g.title}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">Prize: {g.prize}</p>
                                    <p className="text-xs text-primary mt-0.5">
                                      {g.entriesCount}/{g.maxEntries} entries · Active
                                    </p>
                                  </div>
                                </div>
                              </button>
                            </Link>
                          ))}
                        </div>
                      )}
                      <div className="px-4 py-2.5 border-t border-border">
                        <Link href="/giveaways">
                          <button onClick={() => setBellOpen(false)} className="text-xs text-primary hover:underline font-medium">
                            View all giveaways →
                          </button>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>

                {/* Avatar */}
                <Link href={`/profile/${user.id}`}>
                  <div className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ml-1">
                    <div className="relative">
                      <Avatar className="h-8 w-8 border border-border">
                        <AvatarImage src={user.avatarUrl || undefined} />
                        <AvatarFallback className="text-xs bg-secondary">
                          {(user.username?.substring(0, 2) ?? "").toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-0.5 -right-0.5 bg-primary text-white text-[8px] font-black rounded px-0.5 leading-tight">
                        {user.level}
                      </div>
                    </div>
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground rotate-90" />
                  </div>
                </Link>
              </>
            ) : (
              <>
                <Link href="/login">
                  <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">
                    Login
                  </Button>
                </Link>
                <Link href="/register">
                  <Button size="sm">Register</Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* XP bar */}
        {user && (
          <div className="h-0.5 bg-muted">
            <div className="h-0.5 bg-primary transition-all duration-700" style={{ width: `${xpProgress}%` }} />
          </div>
        )}
      </header>

      {/* ── Menu Panel Overlay ── */}
      {menuOpen && (
        <div className="fixed inset-0 z-[60] flex">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMenuOpen(false)}
          />
          <div className="relative z-50 w-72 h-full bg-card border-r border-border flex flex-col overflow-y-auto shadow-2xl menu-panel-enter">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <span className="text-base font-bold text-foreground">Menu</span>
              <button
                onClick={() => setMenuOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary/60 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* User info */}
            {user && (
              <div className="px-5 py-4 border-b border-border">
                <Link href={`/profile/${user.id}`} onClick={() => setMenuOpen(false)}>
                  <div className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarImage src={user.avatarUrl || undefined} />
                      <AvatarFallback className="bg-secondary text-sm">
                        {(user.username?.substring(0, 2) ?? "").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm text-foreground">{user.username}</p>
                      <p className="text-xs text-primary">{user.points} pts · Lv {user.level}</p>
                    </div>
                  </div>
                </Link>
                <div className="mt-3">
                  <Progress value={xpProgress} className="h-1" />
                  <p className="text-[10px] text-muted-foreground mt-1">{user.xp % 100}/100 XP to next level</p>
                </div>
              </div>
            )}

            {/* Nav Items */}
            <nav className="flex-1 py-2">
              {NAV_ITEMS.map((item) => (
                <Link key={item.href} href={item.href}>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className={`w-full flex items-center justify-between px-5 py-3 text-sm font-medium transition-colors ${
                      location === item.href
                        ? "bg-primary/10 text-primary border-l-2 border-primary"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-l-2 border-transparent"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      {item.icon && <item.icon className="h-4 w-4" />}
                      {item.label}
                    </span>
                    <ChevronRight className="h-4 w-4 opacity-40" />
                  </button>
                </Link>
              ))}

              <div className="my-2 mx-5 border-t border-border" />

              {user ? (
                <>
                  <Link href="/submit">
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-l-2 border-transparent transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <Plus className="h-4 w-4" />
                        Submit Account
                      </span>
                      <ChevronRight className="h-4 w-4 opacity-40" />
                    </button>
                  </Link>
                  <Link href="/messages">
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-l-2 border-transparent transition-colors"
                    >
                      <span className="flex items-center gap-3">
                        <MessageSquare className="h-4 w-4" />
                        Messages
                        {unreadCount > 0 && (
                          <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                            {unreadCount}
                          </span>
                        )}
                      </span>
                      <ChevronRight className="h-4 w-4 opacity-40" />
                    </button>
                  </Link>
                  {(user.isAdmin || (user as any).isModerator) && (
                    <Link href="/admin">
                      <button
                        onClick={() => setMenuOpen(false)}
                        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-primary hover:bg-primary/10 border-l-2 border-transparent transition-colors"
                      >
                        <span className="flex items-center gap-3">
                          <Shield className="h-4 w-4" />
                          {user.isAdmin ? "Admin Panel" : "Mod Panel"}
                        </span>
                        <ChevronRight className="h-4 w-4 opacity-40" />
                      </button>
                    </Link>
                  )}
                </>
              ) : (
                <>
                  <Link href="/login">
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-l-2 border-transparent transition-colors"
                    >
                      <span>Login</span>
                      <ChevronRight className="h-4 w-4 opacity-40" />
                    </button>
                  </Link>
                  <Link href="/register">
                    <button
                      onClick={() => setMenuOpen(false)}
                      className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-primary hover:bg-primary/10 border-l-2 border-transparent transition-colors"
                    >
                      <span>Register</span>
                      <ChevronRight className="h-4 w-4 opacity-40" />
                    </button>
                  </Link>
                </>
              )}
            </nav>

            {/* Bottom logout */}
            {user && (
              <div className="p-4 border-t border-border">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Log out
                </button>
              </div>
            )}
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
