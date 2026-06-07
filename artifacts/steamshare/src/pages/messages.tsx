import { Layout } from "@/components/layout";
import { useGetMe } from "@workspace/api-client-react";
import { useState, useEffect, useRef } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, MessageSquare, ArrowLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

interface Conversation {
  partner_id: number;
  partner_username: string;
  partner_avatar_url: string | null;
  content: string;
  created_at: string;
  unread_count: number;
  sender_id: number;
}

interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  content: string;
  isRead: boolean;
  createdAt: string;
}

async function fetchConversations(): Promise<Conversation[]> {
  const res = await fetch("/api/messages/conversations", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load conversations");
  return res.json();
}

async function fetchMessages(userId: number): Promise<Message[]> {
  const res = await fetch(`/api/messages/${userId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load messages");
  return res.json();
}

async function sendMessage(receiverId: number, content: string): Promise<Message> {
  const res = await fetch("/api/messages", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ receiverId, content }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Failed to send message");
  }
  return res.json();
}

export default function Messages() {
  const { data: me } = useGetMe();
  const [location, navigate] = useLocation();
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [selectedUsername, setSelectedUsername] = useState("");
  const [draft, setDraft] = useState("");
  const [mobileView, setMobileView] = useState<"list" | "chat">("list");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Auto-open a conversation when navigating from a profile page (?user=ID&username=NAME)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = parseInt(params.get("user") || "0", 10);
    const username = params.get("username") || "";
    if (userId && username) {
      setSelectedUserId(userId);
      setSelectedUsername(decodeURIComponent(username));
      setMobileView("chat");
    }
  }, [location]);

  const { data: conversations } = useQuery({
    queryKey: ["conversations"],
    queryFn: fetchConversations,
    refetchInterval: 5000,
  });

  const { data: messages } = useQuery({
    queryKey: ["messages", selectedUserId],
    queryFn: () => fetchMessages(selectedUserId!),
    enabled: !!selectedUserId,
    refetchInterval: 3000,
  });

  const sendMutation = useMutation({
    mutationFn: ({ receiverId, content }: { receiverId: number; content: string }) =>
      sendMessage(receiverId, content),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedUserId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!draft.trim() || !selectedUserId) return;
    sendMutation.mutate({ receiverId: selectedUserId, content: draft.trim() });
  };

  const selectUser = (userId: number, username: string) => {
    setSelectedUserId(userId);
    setSelectedUsername(username);
    setMobileView("chat");
  };

  if (!me) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <p className="text-muted-foreground">Please <Link href="/login" className="text-primary hover:underline">log in</Link> to use messages.</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-5xl">
        <h1 className="text-2xl font-black mb-6 flex items-center gap-2">
          <MessageSquare className="h-6 w-6 text-primary" /> Messages
        </h1>

        <div className="bg-card border border-border rounded-xl overflow-hidden flex h-[600px]">
          {/* Sidebar */}
          <div className={`w-full md:w-72 border-r border-border flex flex-col shrink-0 ${mobileView === "chat" ? "hidden md:flex" : "flex"}`}>
            <div className="p-3 border-b border-border">
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">Conversations</p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!conversations || conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center p-6">
                  <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">No conversations yet.</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Visit a user's profile to start a chat.</p>
                </div>
              ) : (
                conversations.map((conv) => (
                  <button
                    key={conv.partner_id}
                    onClick={() => selectUser(conv.partner_id, conv.partner_username)}
                    className={`w-full flex items-center gap-3 p-3 hover:bg-muted/40 transition-colors text-left ${selectedUserId === conv.partner_id ? "bg-primary/10 border-r-2 border-primary" : ""}`}
                  >
                    <Avatar className="h-10 w-10 shrink-0">
                      <AvatarImage src={conv.partner_avatar_url || undefined} />
                      <AvatarFallback>{conv.partner_username.substring(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm truncate">{conv.partner_username}</span>
                        {Number(conv.unread_count) > 0 && (
                          <span className="bg-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 shrink-0">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{conv.content}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Chat area */}
          <div className={`flex-1 flex flex-col ${mobileView === "list" ? "hidden md:flex" : "flex"}`}>
            {!selectedUserId ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
                <MessageSquare className="h-12 w-12 text-muted-foreground/20 mb-4" />
                <p className="text-muted-foreground font-medium">Select a conversation</p>
                <p className="text-sm text-muted-foreground/70 mt-1">Or visit a user's profile to start a new one.</p>
              </div>
            ) : (
              <>
                <div className="p-3 border-b border-border flex items-center gap-3">
                  <button className="md:hidden mr-1" onClick={() => setMobileView("list")}>
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{selectedUsername.substring(0, 2).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <Link href={`/profile/${selectedUserId}`} className="font-semibold hover:text-primary">
                    {selectedUsername}
                  </Link>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages?.map((msg) => {
                    const isMe = msg.senderId === me.id;
                    return (
                      <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                        <div
                          className={`max-w-[70%] rounded-2xl px-4 py-2 text-sm ${
                            isMe
                              ? "bg-primary text-white rounded-br-sm"
                              : "bg-muted text-foreground rounded-bl-sm"
                          }`}
                        >
                          <p>{msg.content}</p>
                          <p className={`text-[10px] mt-0.5 ${isMe ? "text-white/70 text-right" : "text-muted-foreground"}`}>
                            {formatDistanceToNow(new Date(msg.createdAt))} ago
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>

                <div className="p-3 border-t border-border flex gap-2">
                  <Input
                    placeholder="Type a message..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                    className="flex-1"
                  />
                  <Button size="icon" onClick={handleSend} disabled={!draft.trim() || sendMutation.isPending}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
