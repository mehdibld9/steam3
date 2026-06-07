import { Link } from "wouter";
import { Account } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Coins, Heart, Gamepad2 } from "lucide-react";

interface AccountCardProps {
  account: Account;
}

function StatusBadge({ status }: { status?: string }) {
  if (status === "not_working") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-amber-600">
        <span className="w-2 h-2 rounded-full bg-amber-500" />
        Not Working
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-red-500">
        <span className="w-2 h-2 rounded-full bg-red-500" />
        Error
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="w-2 h-2 rounded-full bg-muted-foreground" />
        Pending
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[11px] font-medium text-green-600">
      <span className="w-2 h-2 rounded-full bg-green-500" />
      Working
    </span>
  );
}

export function AccountCard({ account }: AccountCardProps) {
  return (
    <Link href={`/accounts/${account.id}`} className="block group">
      <div
        className="bg-card hover:bg-secondary/40 border border-border hover:border-primary/40 rounded-xl transition-all duration-200 overflow-hidden relative"
        data-testid={`card-account-${account.id}`}
      >
        <div className="flex items-center gap-4 px-5 py-4">

          {/* Cost pill — left anchor */}
          <div className="shrink-0 w-16 flex flex-col items-center justify-center gap-1">
            {account.pointsCost === 0 ? (
              <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-xs px-2">Free</Badge>
            ) : (
              <div className="flex items-center gap-1 text-primary font-bold text-sm">
                <Coins className="h-3.5 w-3.5" />
                {account.pointsCost}
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="w-px self-stretch bg-border shrink-0" />

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-base leading-tight group-hover:text-primary transition-colors truncate">
                {account.title}
              </h3>
            </div>

            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{account.description}</p>

            {account.games.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                <Gamepad2 className="h-3 w-3 text-muted-foreground mt-0.5 shrink-0" />
                {account.games.slice(0, 4).map((game, i) => (
                  <span key={i} className="text-[11px] text-muted-foreground">{i > 0 ? "· " : ""}{game}</span>
                ))}
                {account.games.length > 4 && (
                  <span className="text-[11px] text-muted-foreground">+{account.games.length - 4} more</span>
                )}
              </div>
            )}
          </div>

          {/* Right meta */}
          <div className="shrink-0 flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Avatar className="h-6 w-6 border border-border">
                <AvatarImage src={account.posterAvatarUrl || undefined} />
                <AvatarFallback className="text-[10px] bg-secondary">
                  {(account.posterUsername?.substring(0, 2) ?? "U").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium">{account.posterUsername}</span>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Heart className={`h-3 w-3 ${account.userHasLiked ? "text-red-500 fill-red-500" : ""}`} />
                <span>{account.likesCount}</span>
              </div>
              <span>{formatDistanceToNow(new Date(account.createdAt))} ago</span>
            </div>
            <StatusBadge status={account.checkStatus} />
          </div>

        </div>
      </div>
    </Link>
  );
}
