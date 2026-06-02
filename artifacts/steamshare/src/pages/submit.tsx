import { Layout } from "@/components/layout";
import { useCreateAccount, useGetMe, useVerifyCredentials } from "@workspace/api-client-react";
import { useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { InfoIcon, ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().max(1000),
  gamesList: z.string().min(1, "At least one game is required"),
  pointsCost: z.coerce.number().min(0),
  steamUsername: z.string().min(1, "Steam username is required"),
  steamPassword: z.string().min(1, "Steam password is required"),
});

type VerifyStatus = "idle" | "checking" | "valid" | "invalid" | "rate_limited" | "error";

export default function Submit() {
  const [, setLocation] = useLocation();
  const { data: user, isLoading: userLoading } = useGetMe();
  const createAccount = useCreateAccount();
  const verifyCredentials = useVerifyCredentials();
  const [submitError, setSubmitError] = useState("");
  const [verifyStatus, setVerifyStatus] = useState<VerifyStatus>("idle");
  const [verifyMessage, setVerifyMessage] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      gamesList: "",
      pointsCost: 0,
      steamUsername: "",
      steamPassword: "",
    },
  });

  if (!userLoading && !user) {
    setLocation("/login");
    return null;
  }

  const handleVerify = async () => {
    const values = form.getValues();
    if (!values.steamUsername || !values.steamPassword) {
      form.trigger(["steamUsername", "steamPassword"]);
      return;
    }
    setVerifyStatus("checking");
    setVerifyMessage("");
    try {
      const result = await verifyCredentials.mutateAsync({
        data: { steamUsername: values.steamUsername, steamPassword: values.steamPassword },
      });
      setVerifyStatus(result.status as VerifyStatus);
      setVerifyMessage(result.message);
    } catch (e: any) {
      setVerifyStatus("error");
      setVerifyMessage(e.message || "Could not reach Steam servers");
    }
  };

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError("");

    if (verifyStatus === "invalid") {
      setSubmitError("The Steam credentials appear to be invalid. Please verify them first.");
      return;
    }

    try {
      const games = values.gamesList.split(",").map((s) => s.trim()).filter(Boolean);
      if (games.length === 0) {
        form.setError("gamesList", { message: "Please provide valid game names separated by commas" });
        return;
      }

      const res = await createAccount.mutateAsync({
        data: {
          title: values.title,
          description: values.description,
          games,
          pointsCost: values.pointsCost,
          steamUsername: values.steamUsername,
          steamPassword: values.steamPassword,
        },
      });

      setLocation(`/accounts/${res.id}`);
    } catch (e: any) {
      setSubmitError(e.message || "Submission failed. Please try again.");
    }
  }

  const credWatched = form.watch(["steamUsername", "steamPassword"]);
  const hasCredentials = !!credWatched[0] && !!credWatched[1];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12 max-w-3xl">
        <div className="mb-8">
          <h1 className="text-3xl font-black">Upload Account</h1>
          <p className="text-muted-foreground mt-2">Share your Steam account and earn XP. Set a price or offer it for free.</p>
        </div>

        <Alert className="mb-8 bg-blue-500/10 border-blue-500/20 text-blue-400">
          <InfoIcon className="h-4 w-4" />
          <AlertTitle>Earn Rewards</AlertTitle>
          <AlertDescription>
            You will earn <strong className="text-blue-300">50 XP</strong> automatically when this account is published. If you set a Points Cost, you will receive those points when someone claims it.
          </AlertDescription>
        </Alert>

        <Card className="bg-card border-card-border shadow-xl">
          <CardHeader>
            <CardTitle>Account Details</CardTitle>
            <CardDescription>All fields are required. Be honest about the games included.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {submitError && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400 flex items-center gap-2">
                    <XCircle className="h-4 w-4 flex-shrink-0" />
                    {submitError}
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Listing Title</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. CS:GO Prime + Rust + Terraria" data-testid="input-title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="gamesList"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Included Games (Comma Separated)</FormLabel>
                      <FormControl>
                        <Input placeholder="CS:GO, Rust, Terraria, Portal 2" data-testid="input-games" {...field} />
                      </FormControl>
                      <FormDescription>We use this for the tags and search filters.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description / Notes</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Any bans? What rank in comp? Extra inventory items?"
                          className="min-h-[100px]"
                          data-testid="input-description"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="pointsCost"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price in Points</FormLabel>
                      <FormControl>
                        <div className="relative w-40">
                          <Input type="number" min="0" data-testid="input-price" {...field} />
                        </div>
                      </FormControl>
                      <FormDescription>Set to 0 to make it free for anyone to claim.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="bg-muted/30 p-6 rounded-lg border border-border mt-8 space-y-4">
                  <div className="flex items-center gap-2 text-yellow-500 mb-2">
                    <ShieldAlert className="h-5 w-5" />
                    <h3 className="font-bold">Secure Credentials Drop</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    These details are encrypted and will ONLY be revealed to the user who claims this account. Do not share your primary personal account.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="steamUsername"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Steam Username</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="username123"
                              data-testid="input-steam-user"
                              {...field}
                              onChange={(e) => { field.onChange(e); setVerifyStatus("idle"); }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="steamPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Steam Password</FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder="••••••••"
                              data-testid="input-steam-pass"
                              {...field}
                              onChange={(e) => { field.onChange(e); setVerifyStatus("idle"); }}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={handleVerify}
                    disabled={!hasCredentials || verifyStatus === "checking"}
                  >
                    {verifyStatus === "checking" ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Checking Steam...</>
                    ) : (
                      "Verify Credentials"
                    )}
                  </Button>

                  {verifyStatus !== "idle" && verifyStatus !== "checking" && (
                    <div className={`flex items-start gap-2 rounded-lg px-4 py-3 text-sm mt-2 ${
                      verifyStatus === "valid"
                        ? "bg-green-500/10 border border-green-500/20 text-green-400"
                        : verifyStatus === "invalid"
                        ? "bg-red-500/10 border border-red-500/20 text-red-400"
                        : "bg-yellow-500/10 border border-yellow-500/20 text-yellow-400"
                    }`}>
                      {verifyStatus === "valid" ? (
                        <CheckCircle2 className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      ) : verifyStatus === "invalid" ? (
                        <XCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      ) : (
                        <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      )}
                      <span>{verifyMessage || "Unknown result"}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 flex justify-end">
                  <Button type="submit" size="lg" disabled={createAccount.isPending} data-testid="button-submit-form">
                    {createAccount.isPending ? "Encrypting & Uploading..." : "Publish Account"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
