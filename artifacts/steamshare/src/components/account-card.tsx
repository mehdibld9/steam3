import { Link } from "wouter";
import { Account } from "@workspace/api-client-react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { formatDistanceToNow } from "date-fns";
import { Coins, Heart, MessageSquare } from "lucide-react";

interface AccountCardProps {
  account: Account;
}

export function AccountCard({ account }: AccountCardProps) {
  return (
    <Link href={`/accounts/${account.id}`} className="block group">
      <Card className="h-full bg-card hover:bg-secondary/50 border-card-border hover:border-primary/50 transition-all duration-300 overflow-hidden relative" data-testid={`card-account-${account.id}`}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/0 via-primary/0 to-primary/0 group-hover:from-primary/50 group-hover:via-primary group-hover:to-primary/50 transition-all duration-500" />
        <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-lg leading-tight line-clamp-1 group-hover:text-primary transition-colors">{account.title}</h3>
            <div className="flex flex-wrap gap-1 mt-2">
              {account.games.slice(0, 3).map((game, i) => (
                <Badge key={i} variant="secondary" className="text-[10px] py-0 px-1.5 h-4 bg-background border-border text-muted-foreground">{game}</Badge>
              ))}
              {account.games.length > 3 && (
                <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4 text-muted-foreground">+{account.games.length - 3}</Badge>
              )}
            </div>
          </div>
          <div className="shrink-0">
            {account.pointsCost === 0 ? (
              <Badge variant="default" className="bg-green-600/20 text-green-400 border-green-600/30 hover:bg-green-600/30">Free</Badge>
            ) : (
              <Badge variant="outline" className="flex items-center gap-1 border-primary/30 text-primary bg-primary/10">
                <Coins className="h-3 w-3" /> {account.pointsCost}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-4">
          <p className="text-sm text-muted-foreground line-clamp-2">{account.description}</p>
        </CardContent>
        <CardFooter className="pt-0 flex items-center justify-between border-t border-border/50 mt-auto px-6 py-3 bg-background/30">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6 border border-border">
              <AvatarImage src={account.posterAvatarUrl || undefined} />
              <AvatarFallback className="text-[10px] bg-secondary">
                {account.posterUsername?.substring(0, 2).toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col">
              <span className="text-xs font-medium">{account.posterUsername}</span>
              <span className="text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(account.createdAt))} ago</span>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Heart className={`h-3 w-3 ${account.userHasLiked ? 'text-red-500 fill-red-500' : ''}`} />
              <span>{account.likesCount}</span>
            </div>
            <div className="flex items-center gap-1">
              <MessageSquare className="h-3 w-3" />
              <span>Comments</span>
            </div>
          </div>
        </CardFooter>
      </Card>
    </Link>
  );
}
