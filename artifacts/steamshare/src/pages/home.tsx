import { useListAccounts, useGetStats } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { AccountCard } from "@/components/account-card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ShieldCheck, Users, Gamepad2, TrendingUp } from "lucide-react";

export default function Home() {
  const { data: stats, isLoading: statsLoading } = useGetStats();
  const { data: accountsData, isLoading: accountsLoading } = useListAccounts({ sort: 'recent', limit: 12 });

  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-card border-b border-border py-16 md:py-24">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80')] opacity-5 bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/80 to-transparent" />
        
        <div className="container relative z-10 mx-auto px-4 flex flex-col items-center text-center">
          <Badge className="mb-6 bg-primary/20 text-primary border-primary/30 py-1 px-3">
            The Underground Gaming Marketplace
          </Badge>
          <h1 className="text-4xl md:text-6xl font-black tracking-tight text-white mb-6">
            Trade Accounts. Earn XP.<br />
            <span className="text-primary">Level Up.</span>
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mb-10">
            Share your unused Steam libraries, claim games you want to play, and rise through the ranks in the most active gaming exchange.
          </p>
          <div className="flex gap-4">
            <Link href="/browse">
              <Button size="lg" className="font-bold px-8 h-12" data-testid="button-browse-hero">Browse Accounts</Button>
            </Link>
            <Link href="/submit">
              <Button size="lg" variant="outline" className="font-bold px-8 h-12" data-testid="button-submit-hero">Upload & Earn</Button>
            </Link>
          </div>

          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8 mt-16 w-full max-w-4xl">
            {[
              { icon: Users, label: "Active Users", value: stats?.totalUsers, loading: statsLoading },
              { icon: Gamepad2, label: "Accounts Shared", value: stats?.totalAccounts, loading: statsLoading },
              { icon: ShieldCheck, label: "Claims Made", value: stats?.totalClaims, loading: statsLoading },
              { icon: TrendingUp, label: "Points Circulating", value: stats?.totalPointsCirculating, loading: statsLoading }
            ].map((stat, i) => (
              <div key={i} className="flex flex-col items-center p-4 bg-background/50 rounded-xl border border-border/50 backdrop-blur-sm">
                <stat.icon className="h-6 w-6 text-primary mb-2 opacity-80" />
                {stat.loading ? (
                  <Skeleton className="h-8 w-16 mb-1" />
                ) : (
                  <span className="text-2xl font-bold font-mono">{stat.value?.toLocaleString()}</span>
                )}
                <span className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest Accounts */}
      <section className="container mx-auto px-4 py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <span className="w-2 h-6 bg-primary rounded-sm inline-block" />
              Latest Intel
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Freshly dropped accounts ready to be claimed.</p>
          </div>
          <Link href="/browse">
            <Button variant="ghost" size="sm" className="text-primary hover:text-primary/80">View All</Button>
          </Link>
        </div>

        {accountsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {accountsData?.accounts.map((account) => (
              <AccountCard key={account.id} account={account} />
            ))}
            {accountsData?.accounts.length === 0 && (
              <div className="col-span-full py-12 text-center text-muted-foreground">
                No accounts found. Be the first to upload!
              </div>
            )}
          </div>
        )}
      </section>
    </Layout>
  );
}

function Badge({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 ${className}`} {...props}>
      {children}
    </div>
  )
}