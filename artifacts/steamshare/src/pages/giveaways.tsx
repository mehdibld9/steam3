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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { Gift, Trophy, Users, Clock, CheckCircle2, Plus, Trash2, Zap, Link2, ArrowLeft, Eye, Check, X, ToggleLeft, ToggleRight } from "lucide-react";

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

async function fetchEntries(giveawayId: number) {
  const res = await fetch(`/api/giveaways/${giveawayId}/entries`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load entries");
  return res.json() as Promise<{
    id: number; userId: number; username: string; taskProof: string | null;
    isApproved: boolean; isRejected: boolean; createdAt: string; ipAddress: string | null;
  }[]>;
}

async function approveEntry(giveawayId: number, entryId: number) {
  const res = await fetch(`/api/giveaways/${giveawayId}/entries/${entryId}/approve`, { method: "PATCH", credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

async function rejectEntry(giveawayId: number, entryId: number) {
  const res = await fetch(`/api/giveaways/${giveawayId}/entries/${entryId}/reject`, { method: "PATCH", credentials: "include" });
  if (!res.ok) throw new Error("Failed");
  return res.json();
}

function EntriesDialog({ giveawayId, autoApprove }: { giveawayId: number; autoApprove: boolean }) {
  const [open, setOpen] = useState(false);
  const { data: entries, refetch, isLoading } = useQuery({
    queryKey: ["giveaway-entries", giveawayId],
    queryFn: () => fetchEntries(giveawayId),
    enabled: open,
  });

  const approve = useMutation({ mutationFn: (entryId: number) => approveEntry(giveawayId, entryId), onSuccess: () => refetch() });
  const reject = useMutation({ mutationFn: (entryId: number) => rejectEntry(giveawayId, entryId), onSuccess: () => refetch() });

  const pending = entries?.filter((e) => !e.isApproved && !e.isRejected) ?? [];
  const approved = entries?.filter((e) => e.isApproved) ?? [];
  const rejected = entries?.filter((e) => e.isRejected) ?? [];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1">
          <Eye className="h-4 w-4" /> Entries
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Entries
            {autoApprove && <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs">Auto-Approve On</Badge>}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">Loading entries...</div>
        ) : !entries || entries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">No entries yet.</div>
        ) : (
          <div className="space-y-6">
            {!autoApprove && pending.length > 0 && (
              <section>
                <h3 className="text-sm font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> Pending ({pending.length})
                </h3>
                <div className="space-y-2">
                  {pending.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} onApprove={() => approve.mutate(entry.id)} onReject={() => reject.mutate(entry.id)} loading={approve.isPending || reject.isPending} />
                  ))}
                </div>
              </section>
            )}

            {approved.length > 0 && (
              <section>
                <h3 className="text-sm font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> Approved ({approved.length})
                </h3>
                <div className="space-y-2">
                  {approved.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} onApprove={() => approve.mutate(entry.id)} onReject={() => reject.mutate(entry.id)} loading={approve.isPending || reject.isPending} />
                  ))}
                </div>
              </section>
            )}

            {rejected.length > 0 && (
              <section>
                <h3 className="text-sm font-bold uppercase text-muted-foreground mb-3 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Rejected ({rejected.length})
                </h3>
                <div className="space-y-2">
                  {rejected.map((entry) => (
                    <EntryRow key={entry.id} entry={entry} onApprove={() => approve.mutate(entry.id)} onReject={() => reject.mutate(entry.id)} loading={approve.isPending || reject.isPending} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EntryRow({ entry, onApprove, onReject, loading }: {
  entry: { id: number; username: string; taskProof: string | null; isApproved: boolean; isRejected: boolean; createdAt: string };
  onApprove: () => void; onReject: () => void; loading: boolean;
}) {
  const isImage = entry.taskProof && (entry.taskProof.startsWith("http") && /\.(png|jpg|jpeg|gif|webp)/i.test(entry.taskProof));

  return (
    <div className={`border rounded-xl p-3 space-y-2 ${entry.isApproved ? "border-green-500/30 bg-green-500/5" : entry.isRejected ? "border-red-500/30 bg-red-500/5" : "border-border bg-muted/20"}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm">{entry.username}</span>
          {entry.isApproved && <Badge className="bg-green-500/20 text-green-500 border-green-500/30 text-xs py-0">Approved</Badge>}
          {entry.isRejected && <Badge className="bg-red-500/20 text-red-500 border-red-500/30 text-xs py-0">Rejected</Badge>}
          {!entry.isApproved && !entry.isRejected && <Badge variant="outline" className="text-yellow-500 border-yellow-500/30 text-xs py-0">Pending</Badge>}
        </div>
        <div className="flex gap-1.5 shrink-0">
          {!entry.isApproved && (
            <Button size="sm" className="h-7 px-2 bg-green-600 hover:bg-green-500 text-white gap-1" onClick={onApprove} disabled={loading}>
              <Check className="h-3 w-3" /> Approve
            </Button>
          )}
          {!entry.isRejected && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-red-500 hover:bg-red-500/10 gap-1" onClick={onReject} disabled={loading}>
              <X className="h-3 w-3" /> Reject
            </Button>
          )}
        </div>
      </div>

      {entry.taskProof && (
        <div className="text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/70">Proof: </span>
          {isImage ? (
            <a href={entry.taskProof} target="_blank" rel="noopener noreferrer">
              <img src={entry.taskProof} alt="Proof" className="mt-1.5 max-h-40 rounded-lg border border-border object-contain" />
            </a>
          ) : (
            <a href={entry.taskProof.startsWith("http") ? entry.taskProof : undefined} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline break-all">
              {entry.taskProof}
            </a>
          )}
        </div>
      )}
    </div>
  );
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
  const [form, setForm] = useState({
    title: "", description: "", prize: "", taskDescription: "",
    taskLink: "", taskCode: "", maxEntries: "100", endDate: "", autoApprove: false,
  });
  const [formError, setFormError] = useState("");

  const [enterProofs, setEnterProofs] = useState<Record<number, string>>({});
  const [enterCodes, setEnterCodes] = useState<Record<number, string>>({});
  const [enterErrors, setEnterErrors] = useState<Record<number, string>>({});
  const [enterSuccess, setEnterSuccess] = useState<Record<number, boolean>>({});

  const refresh = () => queryClient.invalidateQueries({ queryKey: getListGiveawaysQueryKey() });

  const handleCreate = async () => {
    setFormError("");
    if (!form.title || !form.description || !form.prize || !form.taskDescription || !form.endDate) {
      setFormError("All required fields must be filled.");
      return;
    }
    try {
      await createGiveaway.mutateAsync({
        data: {
          title: form.title,
          description: form.description,
          prize: form.prize,
          taskDescription: form.taskDescription,
          taskLink: form.taskLink || undefined,
          taskCode: form.taskCode || undefined,
          maxEntries: parseInt(form.maxEntries) || 100,
          endDate: new Date(form.endDate).toISOString(),
          autoApprove: form.autoApprove,
        } as any,
      });
      setCreateOpen(false);
      setForm({ title: "", description: "", prize: "", taskDescription: "", taskLink: "", taskCode: "", maxEntries: "100", endDate: "", autoApprove: false });
      refresh();
    } catch (e: any) {
      setFormError(e.message || "Failed to create giveaway");
    }
  };

  const handleEnter = async (giveawayId: number) => {
    setEnterErrors((prev) => ({ ...prev, [giveawayId]: "" }));
    try {
      await enterGiveaway.mutateAsync({
        giveawayId,
        data: {
          taskProof: enterProofs[giveawayId] || "",
          code: enterCodes[giveawayId] || undefined,
        } as any,
      });
      setEnterSuccess((prev) => ({ ...prev, [giveawayId]: true }));
      refresh();
    } catch (e: any) {
      setEnterErrors((prev) => ({ ...prev, [giveawayId]: e.message || "Failed to enter" }));
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-5xl">
        <button onClick={() => window.history.back()} className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex items-start justify-between mb-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 border border-primary/20">
              <Gift className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-black">Giveaways</h1>
              <p className="text-muted-foreground text-sm">Complete tasks to enter and win prizes.</p>
            </div>
          </div>

          {user?.isAdmin && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="gap-2"><Plus className="h-4 w-4" /> New Giveaway</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Create Giveaway</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  {formError && <p className="text-sm text-red-500 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{formError}</p>}
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Title *</label>
                    <Input placeholder="e.g. Steam Gift Card Giveaway" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Description *</label>
                    <Textarea placeholder="Tell people about this giveaway..." value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Prize *</label>
                    <Input placeholder="e.g. $20 Steam Gift Card" value={form.prize} onChange={(e) => setForm((f) => ({ ...f, prize: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Task Description *</label>
                    <Textarea placeholder="What must users do to enter?" value={form.taskDescription} onChange={(e) => setForm((f) => ({ ...f, taskDescription: e.target.value }))} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium flex items-center gap-1"><Link2 className="h-3.5 w-3.5" /> Task Link (optional)</label>
                    <Input placeholder="https://..." value={form.taskLink} onChange={(e) => setForm((f) => ({ ...f, taskLink: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">A link users must visit to complete the task.</p>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">Secret Code (optional)</label>
                    <Input placeholder="e.g. STEAM2024" value={form.taskCode} onChange={(e) => setForm((f) => ({ ...f, taskCode: e.target.value }))} />
                    <p className="text-xs text-muted-foreground">Users must enter this exact code. Entries with correct code are auto-approved.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-sm font-medium">Max Entries</label>
                      <Input type="number" min="1" value={form.maxEntries} onChange={(e) => setForm((f) => ({ ...f, maxEntries: e.target.value }))} />
                    </div>
                    <div className="space-y-1">
                      <label className="text-sm font-medium">End Date *</label>
                      <Input type="datetime-local" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                    </div>
                  </div>

                  {/* Auto-approve toggle */}
                  <button
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, autoApprove: !f.autoApprove }))}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border transition-colors ${form.autoApprove ? "bg-green-500/10 border-green-500/30" : "bg-muted/30 border-border"}`}
                  >
                    <div className="text-left">
                      <p className="text-sm font-semibold">Auto-Approve Entries</p>
                      <p className="text-xs text-muted-foreground">All entries are approved instantly without manual review</p>
                    </div>
                    {form.autoApprove
                      ? <ToggleRight className="h-6 w-6 text-green-500 shrink-0" />
                      : <ToggleLeft className="h-6 w-6 text-muted-foreground shrink-0" />
                    }
                  </button>

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
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid gap-6">
            {giveaways.map((giveaway) => {
              const ended = !giveaway.isActive || new Date(giveaway.endDate) < new Date();
              const hasWinner = !!giveaway.winnerUsername;
              const hasCode = !!(giveaway as any).taskCode;
              const autoApprove = !!(giveaway as any).autoApprove;

              return (
                <Card key={giveaway.id} className={`bg-card border-border overflow-hidden ${!ended ? "shadow-[0_0_25px_rgba(var(--primary),0.08)]" : ""}`}>
                  <CardContent className="p-0">
                    <div className={`px-6 py-4 border-b border-border ${ended ? "bg-muted/10" : "bg-primary/5"}`}>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <h2 className="text-xl font-black">{giveaway.title}</h2>
                            {ended
                              ? <Badge variant="outline" className="text-muted-foreground">Ended</Badge>
                              : <Badge className="bg-green-500/20 text-green-500 border-green-500/30">Live</Badge>
                            }
                            {autoApprove && (
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">Auto-Approve</Badge>
                            )}
                          </div>
                          <p className="text-muted-foreground text-sm">{giveaway.description}</p>
                        </div>
                        {user?.isAdmin && (
                          <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
                            <EntriesDialog giveawayId={giveaway.id} autoApprove={autoApprove} />
                            {!ended && (
                              <Button variant="outline" size="sm" onClick={async () => { await drawGiveaway.mutateAsync({ giveawayId: giveaway.id }); refresh(); }} disabled={drawGiveaway.isPending}>
                                <Trophy className="h-4 w-4 mr-1" /> Draw
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-400 hover:bg-red-500/10" onClick={async () => { await deleteGiveaway.mutateAsync({ giveawayId: giveaway.id }); refresh(); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="p-6 grid md:grid-cols-3 gap-6">
                      <div className="md:col-span-2 space-y-4">
                        {/* Task info */}
                        <div className="bg-muted/20 border border-border rounded-lg p-4 space-y-2">
                          <div className="text-xs uppercase text-muted-foreground font-semibold flex items-center gap-1">
                            <Zap className="h-3 w-3" /> Task to Enter
                          </div>
                          <p className="text-sm">{giveaway.taskDescription}</p>
                          {(giveaway as any).taskLink && (
                            <a href={(giveaway as any).taskLink} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                              <Link2 className="h-3.5 w-3.5" /> Go to task →
                            </a>
                          )}
                          {hasCode && (
                            <p className="text-xs text-muted-foreground italic">A secret code is required to enter. Enter it in the field below.</p>
                          )}
                        </div>

                        {/* Winner */}
                        {hasWinner ? (
                          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 flex items-center gap-3">
                            <Trophy className="h-5 w-5 text-yellow-400 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-bold text-yellow-500">Winner: {giveaway.winnerUsername}</p>
                              <p className="text-xs text-muted-foreground">Congratulations!</p>
                            </div>
                          </div>
                        ) : !ended && (
                          <div className="space-y-2">
                            {giveaway.userHasEntered || enterSuccess[giveaway.id] ? (
                              <div className="flex items-center gap-2 text-green-500 bg-green-500/10 border border-green-500/20 rounded-lg px-4 py-3 text-sm">
                                <CheckCircle2 className="h-4 w-4" />
                                <span>You're entered! {autoApprove ? "You've been auto-approved. Good luck!" : "Waiting for approval."}</span>
                              </div>
                            ) : user ? (
                              <div className="space-y-2">
                                <Input
                                  placeholder="Task proof (username, link, screenshot URL…)"
                                  value={enterProofs[giveaway.id] || ""}
                                  onChange={(e) => setEnterProofs((p) => ({ ...p, [giveaway.id]: e.target.value }))}
                                />
                                {hasCode && (
                                  <Input
                                    placeholder="Enter the secret code to verify task completion…"
                                    value={enterCodes[giveaway.id] || ""}
                                    onChange={(e) => setEnterCodes((p) => ({ ...p, [giveaway.id]: e.target.value }))}
                                    className="border-primary/30"
                                  />
                                )}
                                {enterErrors[giveaway.id] && (
                                  <p className="text-sm text-red-500">{enterErrors[giveaway.id]}</p>
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

                      {/* Sidebar stats */}
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
