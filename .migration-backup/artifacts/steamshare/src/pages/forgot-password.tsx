import { Layout } from "@/components/layout";
import { useForgotPassword } from "@workspace/api-client-react";
import { Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { KeyRound, Copy, CheckCheck, ArrowLeft } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

export default function ForgotPassword() {
  const forgotPassword = useForgotPassword();
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError("");
    try {
      const result = await forgotPassword.mutateAsync({ data: values });
      if (result.resetToken) {
        setResetToken(result.resetToken);
      }
    } catch (e: any) {
      setSubmitError(e.message || "Something went wrong. Please try again.");
    }
  }

  const copyToken = () => {
    if (resetToken) {
      navigator.clipboard.writeText(resetToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Layout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="bg-muted/30 p-8 text-center border-b border-border">
            <KeyRound className="h-10 w-10 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-black">Forgot Password</h1>
            <p className="text-muted-foreground text-sm mt-2">Enter your email and we'll generate a reset token.</p>
          </div>

          <div className="p-8">
            {resetToken ? (
              <div className="space-y-4">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                  <CheckCheck className="h-6 w-6 text-green-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-green-400">Reset token generated!</p>
                </div>

                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Copy this token and use it on the reset password page:</p>
                  <div className="flex items-center gap-2 bg-muted/30 border border-border rounded-lg p-3">
                    <code className="text-xs font-mono text-primary flex-1 break-all">{resetToken}</code>
                    <Button size="sm" variant="ghost" onClick={copyToken} className="flex-shrink-0">
                      {copied ? <CheckCheck className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>

                <Link href="/reset-password">
                  <Button className="w-full">Go to Reset Password</Button>
                </Link>
                <p className="text-xs text-muted-foreground text-center">Token expires in 1 hour.</p>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {submitError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                      {submitError}
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email Address</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full font-bold h-12" disabled={forgotPassword.isPending}>
                    {forgotPassword.isPending ? "Generating token..." : "Get Reset Token"}
                  </Button>
                </form>
              </Form>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              <Link href="/login" className="text-primary hover:underline">Back to Login</Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
