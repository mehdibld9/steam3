import { Layout } from "@/components/layout";
import { AccountCard } from "@/components/account-card";
import { useListAccounts, useListGames } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { Search, Filter } from "lucide-react";

export default function Browse() {
  const [search, setSearch] = useState("");
  const [selectedGame, setSelectedGame] = useState<string>("all");
  const [sort, setSort] = useState<"recent"|"popular"|"free"|"points">("recent");
  
  const { data: gamesData, isLoading: gamesLoading } = useListGames();
  const { data: accountsData, isLoading: accountsLoading } = useListAccounts({ 
    game: selectedGame !== "all" ? selectedGame : undefined,
    sort
  });

  const filteredAccounts = accountsData?.accounts.filter(a => 
    a.title.toLowerCase().includes(search.toLowerCase()) || 
    a.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        
        {/* Sidebar Filters */}
        <aside className="w-full md:w-64 shrink-0 space-y-6">
          <div>
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" /> Filters
            </h3>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Search titles..." 
                    className="pl-9 bg-card border-card-border"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    data-testid="input-search"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Sort By</label>
                <Select value={sort} onValueChange={(v: any) => setSort(v)}>
                  <SelectTrigger className="bg-card border-card-border" data-testid="select-sort">
                    <SelectValue placeholder="Sort order" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">Most Recent</SelectItem>
                    <SelectItem value="popular">Most Popular</SelectItem>
                    <SelectItem value="free">Free Accounts</SelectItem>
                    <SelectItem value="points">Lowest Points</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 pt-4">
                <label className="text-sm font-medium text-muted-foreground flex justify-between items-center">
                  Games Directory
                  <Button variant="ghost" size="sm" className="h-auto p-0 text-xs" onClick={() => setSelectedGame("all")}>Clear</Button>
                </label>
                
                <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <Button 
                    variant={selectedGame === "all" ? "secondary" : "ghost"} 
                    className="justify-start h-8 text-sm"
                    onClick={() => setSelectedGame("all")}
                    data-testid="button-game-all"
                  >
                    All Games
                  </Button>
                  
                  {gamesLoading ? (
                    <div className="space-y-2 mt-2">
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                      <Skeleton className="h-6 w-full" />
                    </div>
                  ) : (
                    gamesData?.map(game => (
                      <Button 
                        key={game.game}
                        variant={selectedGame === game.game ? "secondary" : "ghost"} 
                        className="justify-between h-8 text-sm group"
                        onClick={() => setSelectedGame(game.game)}
                        data-testid={`button-game-${game.game}`}
                      >
                        <span className="truncate pr-2">{game.game}</span>
                        <span className="text-[10px] text-muted-foreground bg-background px-1.5 rounded-full group-hover:bg-card">
                          {game.count}
                        </span>
                      </Button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold">
              {selectedGame === "all" ? "All Accounts" : `${selectedGame} Accounts`}
            </h2>
            <span className="text-sm text-muted-foreground">
              {filteredAccounts?.length || 0} results
            </span>
          </div>

          {accountsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-48 w-full rounded-xl" />
              ))}
            </div>
          ) : filteredAccounts && filteredAccounts.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredAccounts.map((account) => (
                <AccountCard key={account.id} account={account} />
              ))}
            </div>
          ) : (
            <div className="py-20 text-center flex flex-col items-center bg-card rounded-xl border border-dashed border-border">
              <Search className="h-10 w-10 text-muted-foreground mb-4 opacity-50" />
              <h3 className="text-lg font-medium text-foreground mb-1">No accounts found</h3>
              <p className="text-sm text-muted-foreground">Try adjusting your filters or search query.</p>
              <Button variant="outline" className="mt-4" onClick={() => { setSearch(""); setSelectedGame("all"); }}>
                Clear Filters
              </Button>
            </div>
          )}
        </main>

      </div>
    </Layout>
  );
}
