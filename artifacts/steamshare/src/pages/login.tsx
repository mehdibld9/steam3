import { Layout } from "@/components/layout";
import { useLogin, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLocation, Link } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";

const formSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export default function Login() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", password: "" },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    try {
      await login.mutateAsync({ data: values });
      queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
      toast({ title: "Welcome back!" });
      setLocation("/");
    } catch (e: any) {
      toast({ title: "Login Failed", description: e.message || "Invalid credentials", variant: "destructive" });
    }
  }

  return (
    <Layout>
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          <div className="bg-muted/30 p-8 text-center border-b border-border">
            <Shield className="h-10 w-10 text-primary mx-auto mb-4" />
            <h1 className="text-2xl font-black">Login to SteamShare</h1>
            <p className="text-muted-foreground text-sm mt-2">Welcome back to the marketplace.</p>
          </div>
          
          <div className="p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Username</FormLabel>
                      <FormControl>
                        <Input placeholder="gamertag" {...field} data-testid="input-username" />
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
                <Button type="submit" className="w-full font-bold h-12" disabled={login.isPending} data-testid="button-login-submit">
                  {login.isPending ? "Logging in..." : "Login"}
                </Button>
              </form>
            </Form>
            
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Don't have an account? <Link href="/register" className="text-primary hover:underline">Register here</Link>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
