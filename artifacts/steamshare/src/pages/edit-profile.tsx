import { Layout } from "@/components/layout";
import { useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Camera, Lock, Trash2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function EditProfile() {
  const { data: me, isLoading } = useGetMe();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Avatar
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarLoading, setAvatarLoading] = useState(false);

  // Password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Delete account
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);

  if (isLoading) return null;
  if (!me) {
    setLocation("/login");
    return null;
  }

  const handleAvatarSave = async () => {
    setAvatarLoading(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: avatarUrl || null }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Failed to update avatar");
      }
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profile picture updated!" });
      setAvatarUrl("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setAvatarLoading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setAvatarLoading(true);
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: null }),
      });
      if (!res.ok) throw new Error("Failed");
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Profile picture removed" });
    } catch {
      toast({ title: "Error", description: "Failed to remove avatar", variant: "destructive" });
    } finally {
      setAvatarLoading(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (newPassword.length < 6) {
      toast({ title: "Password too short", description: "At least 6 characters required", variant: "destructive" });
      return;
    }
    setPasswordLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Failed to change password");
      }
      toast({ title: "Password changed successfully!" });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteLoading(true);
    try {
      const res = await fetch("/api/auth/account", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: deletePassword }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        throw new Error(e.error || "Failed to delete account");
      }
      queryClient.clear();
      setLocation("/");
      toast({ title: "Account deleted" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setDeleteLoading(false);
    }
  };

  const previewUrl = avatarUrl || me.avatarUrl || undefined;

  return (
    <Layout>
      <div className="container mx-auto px-4 py-10 max-w-lg space-y-6">
        <h1 className="text-2xl font-black">Edit Profile</h1>

        {/* ── Avatar ── */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-5">
          <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
            <Camera className="h-4 w-4" /> Profile Picture
          </h2>

          <div className="flex items-center gap-5">
            <Avatar className="h-20 w-20 border-2 border-border shrink-0">
              <AvatarImage src={previewUrl} />
              <AvatarFallback className="text-2xl bg-secondary">
                {(me.username?.substring(0, 2) ?? "").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <p className="text-xs text-muted-foreground">Paste an image URL to set your profile picture.</p>
              <Input
                placeholder="https://example.com/avatar.jpg"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleAvatarSave}
              disabled={!avatarUrl || avatarLoading}
              className="flex-1"
            >
              {avatarLoading ? "Saving..." : "Save Picture"}
            </Button>
            {me.avatarUrl && (
              <Button
                variant="outline"
                onClick={handleRemoveAvatar}
                disabled={avatarLoading}
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
              >
                Remove
              </Button>
            )}
          </div>
        </div>

        {/* ── Change Password ── */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wide text-muted-foreground">
            <Lock className="h-4 w-4" /> Change Password
          </h2>

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium block mb-1">Current Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">New Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Confirm New Password</label>
              <Input
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
              {newPassword && confirmPassword && newPassword !== confirmPassword && (
                <p className="text-xs text-destructive mt-1">Passwords don't match</p>
              )}
              {newPassword && confirmPassword && newPassword === confirmPassword && (
                <p className="text-xs text-green-500 mt-1 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Passwords match</p>
              )}
            </div>
          </div>

          <Button
            onClick={handlePasswordChange}
            disabled={!currentPassword || !newPassword || !confirmPassword || newPassword !== confirmPassword || passwordLoading}
            className="w-full"
          >
            {passwordLoading ? "Updating..." : "Update Password"}
          </Button>
        </div>

        {/* ── Danger Zone ── */}
        <div className="bg-card border border-destructive/30 rounded-xl p-6 space-y-3">
          <h2 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wide text-destructive">
            <AlertTriangle className="h-4 w-4" /> Danger Zone
          </h2>
          <p className="text-sm text-muted-foreground">
            Permanently delete your account and all data. This cannot be undone.
          </p>
          <Button
            variant="outline"
            className="w-full border-destructive/40 text-destructive hover:bg-destructive/10"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete My Account
          </Button>
        </div>
      </div>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" /> Delete Account
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <p className="text-sm text-muted-foreground">
              This will permanently delete your account, all your uploads, and all your data. Enter your password to confirm.
            </p>
            <Input
              type="password"
              placeholder="Enter your password"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => { setDeleteOpen(false); setDeletePassword(""); }}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                disabled={!deletePassword || deleteLoading}
                onClick={handleDeleteAccount}
              >
                {deleteLoading ? "Deleting..." : "Delete Forever"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
