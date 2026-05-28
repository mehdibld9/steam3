import { Layout } from "@/components/layout";
import { 
  useGetMe, 
  useListUsers, 
  useListAccounts, 
  useBanUser, 
  useUnbanUser, 
  useDeleteAccount,
  useListAdLinks,
  useCreateAdLink,
  useDeleteAdLink,
  getListUsersQueryKey,
  getListAccountsQueryKey,
  getListAdLinksQueryKey
} from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { format } from "date-fns";
import { Shield, Trash, Copy, Ban, CheckCircle } from "lucide-react";

export default function Admin() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetMe({ query: { retry: false } });
  
  if (!userLoading && (!user || !user.isAdmin)) {
    setLocation("/");
    return null;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center gap-3 mb-8">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-black">Command Center</h1>
        </div>

        <Tabs defaultValue="users" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-8 bg-card border border-border h-12">
            <TabsTrigger value="users" data-testid="tab-users">User Management</TabsTrigger>
            <TabsTrigger value="accounts" data-testid="tab-accounts">Account Moderation</TabsTrigger>
            <TabsTrigger value="ads" data-testid="tab-ads">Ad Links Generator</TabsTrigger>
          </TabsList>
          
          <TabsContent value="users">
            <UsersTab />
          </TabsContent>
          <TabsContent value="accounts">
            <AccountsTab />
          </TabsContent>
          <TabsContent value="ads">
            <AdLinksTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}

function UsersTab() {
  const { data: usersData, isLoading } = useListUsers();
  const banUser = useBanUser();
  const unbanUser = useUnbanUser();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleToggleBan = async (userId: number, isBanned: boolean) => {
    try {
      if (isBanned) {
        await unbanUser.mutateAsync({ userId });
        toast({ title: "User unbanned" });
      } else {
        await banUser.mutateAsync({ userId });
        toast({ title: "User banned", variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Username</TableHead>
            <TableHead>Points / XP</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
          ) : usersData?.users.map(u => (
            <TableRow key={u.id}>
              <TableCell className="font-mono text-xs">{u.id}</TableCell>
              <TableCell className="font-medium">
                {u.username}
                {u.isAdmin && <Badge variant="outline" className="ml-2 border-primary/50 text-primary text-[10px]">ADMIN</Badge>}
              </TableCell>
              <TableCell>{u.points} pts / {u.xp} XP</TableCell>
              <TableCell>
                {u.isBanned ? <Badge variant="destructive">Banned</Badge> : <Badge variant="secondary" className="bg-green-500/10 text-green-500">Active</Badge>}
              </TableCell>
              <TableCell className="text-right">
                {!u.isAdmin && (
                  <Button 
                    variant={u.isBanned ? "outline" : "destructive"} 
                    size="sm"
                    onClick={() => handleToggleBan(u.id, u.isBanned)}
                    data-testid={`button-ban-${u.id}`}
                  >
                    {u.isBanned ? <CheckCircle className="h-4 w-4 mr-1" /> : <Ban className="h-4 w-4 mr-1" />}
                    {u.isBanned ? "Unban" : "Ban"}
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AccountsTab() {
  const { data: accountsData, isLoading } = useListAccounts({ limit: 100 });
  const deleteAccount = useDeleteAccount();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this account permanently?")) return;
    try {
      await deleteAccount.mutateAsync({ accountId: id });
      queryClient.invalidateQueries({ queryKey: getListAccountsQueryKey() });
      toast({ title: "Account deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Poster</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            <TableRow><TableCell colSpan={5} className="text-center py-8">Loading...</TableCell></TableRow>
          ) : accountsData?.accounts.map(a => (
            <TableRow key={a.id}>
              <TableCell className="font-mono text-xs">{a.id}</TableCell>
              <TableCell className="font-medium max-w-[200px] truncate">{a.title}</TableCell>
              <TableCell>{a.posterUsername}</TableCell>
              <TableCell>
                {a.isAvailable ? <Badge variant="secondary">Available</Badge> : <Badge variant="outline" className="text-muted-foreground">Claimed</Badge>}
              </TableCell>
              <TableCell className="text-right">
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={() => handleDelete(a.id)}
                  data-testid={`button-delete-acc-${a.id}`}
                >
                  <Trash className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function AdLinksTab() {
  const { data: links, isLoading } = useListAdLinks();
  const createLink = useCreateAdLink();
  const deleteLink = useDeleteAdLink();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [desc, setDesc] = useState("");
  const [reward, setReward] = useState(50);
  const [max, setMax] = useState(10);

  const handleCreate = async () => {
    try {
      await createLink.mutateAsync({ data: { description: desc, pointsReward: reward, maxUses: max } });
      setDesc("");
      queryClient.invalidateQueries({ queryKey: getListAdLinksQueryKey() });
      toast({ title: "Link created" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    }
  };

  const copyToClipboard = (code: string) => {
    const url = `${window.location.origin}/api/ad-links/${code}/redeem`;
    navigator.clipboard.writeText(url);
    toast({ title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-8">
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="font-bold text-lg mb-4">Generate New Link</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-medium">Description / Campaign Name</label>
            <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="e.g. Discord Drop July" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Points Reward</label>
            <Input type="number" value={reward} onChange={(e) => setReward(Number(e.target.value))} />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Max Uses</label>
            <Input type="number" value={max} onChange={(e) => setMax(Number(e.target.value))} />
          </div>
        </div>
        <Button className="mt-4" onClick={handleCreate} disabled={createLink.isPending}>
          Generate Link
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Campaign</TableHead>
              <TableHead>Reward</TableHead>
              <TableHead>Uses</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : links?.map(l => (
              <TableRow key={l.id}>
                <TableCell className="font-mono text-xs">{l.code}</TableCell>
                <TableCell>{l.description}</TableCell>
                <TableCell className="font-bold text-primary">+{l.pointsReward}</TableCell>
                <TableCell>{l.usesCount} / {l.maxUses}</TableCell>
                <TableCell>
                  {l.isActive ? <Badge variant="secondary" className="bg-green-500/10 text-green-500">Active</Badge> : <Badge variant="outline">Depleted</Badge>}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => copyToClipboard(l.code)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={async () => {
                    await deleteLink.mutateAsync({ linkId: l.id });
                    queryClient.invalidateQueries({ queryKey: getListAdLinksQueryKey() });
                  }}>
                    <Trash className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
