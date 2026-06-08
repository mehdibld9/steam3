import { Layout } from "@/components/layout";
import { useRegister, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useQueryClient } from "@tanstack/react-query";
import { Shield, CheckCircle2 } from "lucide-react";
import { useState } from "react";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters").max(30),
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  agreeTerms: z.boolean().refine((v) => v === true, {
    message: "You must agree to the terms and conditions to continue",
  }),
});

export default function Register() {
  const [, setLocation] = useLocation();
  const registerUser = useRegister();
  const queryClient = useQueryClient();
  const [submitError, setSubmitError] = useState("");
  const [success, setSuccess] = useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", email: "", password: "", agreeTerms: false },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setSubmitError("");
    try {
      await registerUser.mutateAsync({ data: { username: values.username, email: values.email, password: values.password } });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      setSuccess(true);
      setTimeout(() => setLocation("/"), 700);
    } catch (e: any) {
      setSubmitError(e.message || "Failed to create account. Username or email may already be taken.");
    }
  }

  return (
    <Layout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="bg-muted/30 p-8 text-center border-b border-border">
            <Shield className="h-10 w-10 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-black">Join the Network</h1>
            <p className="text-muted-foreground text-sm mt-2">Create an account to start trading.</p>
          </div>

          <div className="p-8">
            {success ? (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <CheckCircle2 className="h-10 w-10 text-green-400" />
                <p className="font-semibold text-green-400">Account created! Welcome aboard.</p>
              </div>
            ) : (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
                  {submitError && (
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-sm text-red-400">
                      {submitError}
                    </div>
                  )}
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input placeholder="Your Name" {...field} data-testid="input-username" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="you@example.com" {...field} data-testid="input-email" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input type="password" placeholder="••••••••" {...field} data-testid="input-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="agreeTerms"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-start gap-3">
                          <FormControl>
                            <Checkbox
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              data-testid="checkbox-terms"
                              className="mt-0.5"
                            />
                          </FormControl>
                          <div>
                            <p className="text-sm text-muted-foreground leading-snug">
                              I agree to the{" "}
                              <span className="text-primary cursor-pointer hover:underline">Terms of Service</span>
                              {" "}and{" "}
                              <span className="text-primary cursor-pointer hover:underline">Privacy Policy</span>.
                              I understand that sharing accounts may violate Steam's ToS and accept full responsibility.
                            </p>
                            <FormMessage className="mt-1" />
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full font-bold h-12" disabled={registerUser.isPending} data-testid="button-register-submit">
                    {registerUser.isPending ? "Creating account..." : "Create Account"}
                  </Button>
                </form>
              </Form>
            )}

            <div className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account? <Link href="/login" className="text-primary hover:underline">Login here</Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
