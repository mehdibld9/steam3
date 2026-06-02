import { Layout } from "@/components/layout";
import {
  useListGiveaways,
  useCreateGiveaway,
  useDeleteGiveaway,
  useEnterGiveaway,
  useDrawGiveaway,
  useGetMe,
  getListGiveawaysQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Gift, Trophy, Users, Clock, CheckCircle2, Plus, Trash2, Zap } from "lucide-react";

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function timeUntil(d: string): string {
  const diff = new Date(d).getTime() - Date.now();
  if (diff <= 0) return "Ended";
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return `${hours}h ${mins}m left`;
}

export default function Giveaways() {
  const { data: giveaways, isLoading } = useListGiveaways();
  const { data: user } = useGetMe();
  const createGiveaway = useCreateGiveaway();
  const deleteGiveaway = useDeleteGiveaway();
  const enterGiveaway = useEnterGiveaway();
  const drawGiveaway = useDrawGiveaway();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", prize: "", taskDescription: "", maxEntries: "100", endDate: "" });
  const [formError, setFormError] = useState("");
  const [enterProofs, setEnterProofs] = useState<Record<number, string>>({});
  const [enterErrors, setEnterErrors] = useState<Record<number, string>>({});
  const [enterSuccess, setEnterSuccess] = useState<Record<number, boolean>>({});

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListGiveawaysQueryKey() });

  const handleCreate = async () => {
    setFormError("");
    if (!form.title || !form.description || !form.prize || !form.taskDescription || !form.endDate) {
      setFormError("All fields are required.");
      return;
    }
    try {
      await createGiveaway.mutateAsync({
        data: {
          title: form.title,
          description: form.description,
          prize: form.prize,
          taskDescription: form.taskDescription,
          maxEntries: parseInt(form.maxEntries) || 100,
          endDate: new Date(form.endDate).toISOString(),
        },
      });
      setCreateOpen(false);
      setForm({ title: "", description: "", prize: "", taskDescription: "", maxEntries: "100", endDate: "" });
      refresh();
    } catch (e: any) {
      setFormError(e.message || "Failed to create giveaway");
    }
  };

  const handleEnter = async (giveawayId: number) => {
    setEnterErrors((prev) => ({ ...prev, [giveawayId]: "" }));
    try {
      await enterGiveaway.mutateAsync({ giveawayId, data: { taskProof: enterProofs[giveawayId] || "" } });
      setEnterSuccess((prev) => ({ ...prev, [giveawayId]: true }));
      refresh();
    } catch (e: any) {
      setEnterErrors((prev) => ({ ...prev, [giveawayId]: e.message || "Failed to enter" }));
    }
  };

  const handleDraw = async (giveawayId: number) => {
    await drawGiveaway.mutateAsync({ giveawayId });
    refresh();
  };

  const handleDelete = async (giveawayId: number) => {
    await deleteGiveaway.mutateAsync({ giveawayId });
    refresh();
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <div className="flex items-start justify-between mb-10">
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
                <Gift className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-black">Giveaways</h1>
                <p className="text-muted-foreground text-sm">Complete tasks to enter and win prizes.</p>
              </div>
            </div>
          </div>

          {user?.isAdmin && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> New Giveaway
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create Giveaway</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {formError && <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Title</label>
                    <Input placeholder="e.g. Steam Gift Card Giveaway" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Description</label>
                    <Textarea placeholder="Tell people about this giveaway..." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Prize</label>
                    <Input placeholder="e.g. $20 Steam Gift Card" value={form.prize} onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Task to Enter</label>
                    <Textarea placeholder="What must users do? e.g. Follow us on Twitter @steamshare and paste your username." value={form.taskDescription} onChange={(e) => setForm((f) => ({ ...f, taskDescription: e.target.value }))} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Max Entries</label>
                      <Input type="number" min="1" value={form.maxEntries} onChange={(e) => setForm((f) => ({ ...f, maxEntries: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">End Date</label>
                      <Input type="datetime-local" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                    </div>
                  </div>
                  <Button className="w-full" onClick={handleCreate} disabled={createGiveaway.isPending}>
                    {createGiveaway.isPending ? "Creating..." : "Create Giveaway"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {isLoading ? (
          <div className="grid gap-6">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}
          </div>
        ) : !giveaways || giveaways.length === 0 ? (
          <div className="text-center py-24 text-muted-foreground">
            <Gift className="h-14 w-14 mx-auto mb-4 opacity-20" />
            <p className="text-lg font-medium">No giveaways right now.</p>
            <p className="text-sm mt-1">Check back soon — the admins will post them here.</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {giveaways.map((giveaway) => {
              const ended = !giveaway.isActive || new Date(giveaway.endDate) < new Date();
              const hasWinner = !!giveaway.winnerUsername;

              return (
                <Card key={giveaway.id} className={`bg-card border-border overflow-hidden ${!ended ? "shadow-[0_0_25px_rgba(var(--primary),0.08)]" : ""}`}>
                  <CardContent className="p-0">
                    <div className={`px-6 py-4 border-b border-border ${ended ? "bg-muted/10" : "bg-primary/5"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h2 className="text-xl font-black">{giveaway.title}</h2>
                            {ended ? (
                              <Badge variant="outline" className="text-muted-foreground">Ended</Badge>
                            ) : (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Live</Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">{giveaway.description}</p>
                        </div>
                        {user?.isAdmin && (
                          <div className="flex gap-2 flex-shrink-0">
                            {!ended && (
                              <Button variant="outline" size="sm" onClick={() => handleDraw(giveaway.id)} disabled={drawGiveaway.isPending}>
                                <Trophy className="h-4 w-4 mr-1" /> Draw
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="text-red-400 hover:text-red-300 hover:bg-red-500/10" onClick={() => handleDelete(giveaway.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-6 grid md:grid-cols-3 gap-6">
                      <div className="md:col-span-2 space-y-4">
                        <div className="bg-muted/20 border border-border rounded-lg p-4">
                          <div className="text-xs uppercase text-muted-foreground font-semibold mb-2 flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Task to Enter
                          </div>
                          <p className="text-sm">{giveaway.taskDescription}</p>
                        </div>

                        {hasWinner ? (
                          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center gap-3">
                            <Trophy className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-yellow-400">Winner: {giveaway.winnerUsername}</p>
                              <p className="text-xs text-muted-foreground">Congrats to the winner!</p>
                            </div>
                          </div>
                        ) : !ended && (
                          <div className="space-y-2">
                            {giveaway.userHasEntered || enterSuccess[giveaway.id] ? (
                              <div className="flex items-center gap-2 text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>You're entered! Good luck.</span>
                              </div>
                            ) : user ? (
                              <div className="space-y-2">
                                <Input
                                  placeholder="Paste your task proof here (username, link, etc)..."
                                  value={enterProofs[giveaway.id] || ""}
                                  onChange={(e) => setEnterProofs((p) => ({ ...p, [giveaway.id]: e.target.value }))}
                                />
                                {enterErrors[giveaway.id] && (
                                  <p className="text-sm text-red-400">{enterErrors[giveaway.id]}</p>
                                )}
                                <Button className="w-full" onClick={() => handleEnter(giveaway.id)} disabled={enterGiveaway.isPending}>
                                  {enterGiveaway.isPending ? "Entering..." : "Enter Giveaway"}
                                </Button>
                              </div>
                            ) : (
                              <a href="/login">
                                <Button variant="outline" className="w-full">Login to Enter</Button>
                              </a>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="space-y-3">
                        <div className="bg-muted/20 border border-border rounded-lg p-4 text-center">
                          <Gift className="h-5 w-5 text-primary mx-auto mb-1" />
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Prize</p>
                          <p className="font-bold text-sm">{giveaway.prize}</p>
                        </div>
                        <div className="bg-muted/20 border border-border rounded-lg p-4 text-center">
                          <Users className="h-5 w-5 text-blue-400 mx-auto mb-1" />
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Entries</p>
                          <p className="font-bold text-sm">{giveaway.entriesCount} / {giveaway.maxEntries}</p>
                        </div>
                        <div className="bg-muted/20 border border-border rounded-lg p-4 text-center">
                          <Clock className="h-5 w-5 text-orange-400 mx-auto mb-1" />
                          <p className="text-xs text-muted-foreground uppercase font-semibold mb-1">Ends</p>
                          <p className="font-bold text-sm">{ended ? formatDate(giveaway.endDate) : timeUntil(giveaway.endDate)}</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
