import { Layout } from "@/components/layout";
import { useGetMe, useRedeemAdLink } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Coins, Share2, Upload, MessageSquare } from "lucide-react";
import { getGetMeQueryKey } from "@workspace/api-client-react";

export default function Earn() {
  const { data: user } = useGetMe();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [isRedeeming, setIsRedeeming] = useState(false);

  const handleRedeem = async () => {
    if (!code) return;
    setIsRedeeming(true);
    try {
      const res = await fetch(`/api/ad-links/${code}/redeem`);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || "Failed to redeem");
      
      toast({ 
        title: "Code Redeemed!", 
        description: `You earned ${data.pointsEarned} points. New balance: ${data.newTotal}` 
      });
      setCode("");
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
    } catch (e: any) {
      toast({ title: "Redeem Failed", description: e.message, variant: "destructive" });
    } finally {
      setIsRedeeming(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="text-center mb-12">
          <h1 className="text-3xl md:text-5xl font-black mb-4 tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-primary to-blue-400">
            Earn Points. Get Games.
          </h1>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Points are the currency of SteamShare. Earn them by contributing to the community, then spend them to claim premium Steam accounts.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="bg-card border-card-border bg-gradient-to-b from-card to-card/50">
            <CardHeader className="text-center pb-2">
              <Upload className="h-8 w-8 text-primary mx-auto mb-2" />
              <CardTitle>Upload Accounts</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground">
              Set a points price on your unused accounts. When someone claims it, you get the points! You also get a flat +50 XP just for uploading.
            </CardContent>
          </Card>

          <Card className="bg-card border-card-border bg-gradient-to-b from-card to-card/50">
            <CardHeader className="text-center pb-2">
              <MessageSquare className="h-8 w-8 text-primary mx-auto mb-2" />
              <CardTitle>Community</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground">
              Participate in comments and discussions. Admins frequently tip active helpful users with point drops.
            </CardContent>
          </Card>

          <Card className="bg-card border-card-border bg-gradient-to-b from-card to-card/50 border-primary/20 shadow-[0_0_15px_rgba(var(--primary),0.1)]">
            <CardHeader className="text-center pb-2">
              <Share2 className="h-8 w-8 text-primary mx-auto mb-2" />
              <CardTitle>Promo Codes</CardTitle>
            </CardHeader>
            <CardContent className="text-center text-sm text-muted-foreground">
              Follow our socials to find limited-use promo codes. Redeem them instantly for points.
            </CardContent>
          </Card>
        </div>

        <Card className="max-w-md mx-auto bg-card border-primary/20">
          <CardHeader className="text-center">
            <Coins className="h-12 w-12 text-yellow-500 mx-auto mb-2 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]" />
            <CardTitle>Redeem Code</CardTitle>
            <CardDescription>Found a promo code? Enter it below.</CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="flex gap-2">
                <Input 
                  placeholder="Enter code..." 
                  value={code} 
                  onChange={(e) => setCode(e.target.value)} 
                  className="font-mono uppercase"
                  data-testid="input-code"
                />
                <Button onClick={handleRedeem} disabled={!code || isRedeeming} data-testid="button-redeem">
                  {isRedeeming ? "..." : "Redeem"}
                </Button>
              </div>
            ) : (
              <div className="text-center py-4 bg-muted/30 rounded-lg border border-border">
                <p className="text-sm text-muted-foreground mb-4">You must be logged in to redeem codes.</p>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}
