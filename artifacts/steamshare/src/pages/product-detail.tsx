import { Layout } from "@/components/layout";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Star, ArrowLeft, MessageSquare, Package, PackageOpen, AlertCircle, CheckCircle } from "lucide-react";

// ── API helpers ──
async function fetchProduct(id: number) {
  const res = await fetch(`/api/store/products/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load product");
  return res.json();
}

async function buyProduct(id: number, quantity: number) {
  const res = await fetch(`/api/store/products/${id}/buy`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quantity }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Purchase failed");
  return data;
}

async function postReview(productId: number, rating: number, comment: string) {
  const res = await fetch(`/api/store/products/${productId}/reviews`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rating, comment }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Review failed");
  return data;
}

// ── Star rating component ──
function StarRating({ rating, max = 5, size = 16, interactive = false, onRate }: {
  rating: number; max?: number; size?: number; interactive?: boolean; onRate?: (r: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.round(rating);
        return (
          <button
            key={i}
            type="button"
            disabled={!interactive}
            onClick={() => onRate?.(i + 1)}
            className={`transition-transform ${interactive ? "hover:scale-110 cursor-pointer" : "cursor-default"}`}
          >
            <Star
              className={`${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
              style={{ width: size, height: size }}
            />
          </button>
        );
      })}
    </div>
  );
}

// ── Main page ──
export default function ProductDetail() {
  const params = useParams();
  const productId = parseInt(params?.id ?? "0", 10);
  const { data: user } = useGetMe();
  const { data: product, isLoading, error } = useQuery({
    queryKey: ["store-product", productId],
    queryFn: () => fetchProduct(productId),
    enabled: productId > 0,
  });
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [buyDone, setBuyDone] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [buyQty, setBuyQty] = useState(1);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");

  const buyMutation = useMutation({
    mutationFn: () => buyProduct(productId, buyQty),
    onSuccess: () => {
      setBuyDone(true);
      setBuyError("");
      toast({ title: "Purchase complete!", description: "Check your messages for your item." });
    },
    onError: (e: any) => {
      setBuyError(e.message || "Purchase failed");
      setBuyDone(false);
    },
  });

  const reviewMutation = useMutation({
    mutationFn: () => postReview(productId, reviewRating, reviewText),
    onSuccess: () => {
      setReviewRating(0);
      setReviewText("");
      toast({ title: "Review posted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-4xl text-center text-muted-foreground">Loading product...</div>
      </Layout>
    );
  }

  if (error || !product) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-12 max-w-4xl">
          <div className="text-center">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground">Product not found.</p>
            <Button variant="outline" className="mt-4 gap-2" onClick={() => setLocation("/store")}>
              <ArrowLeft className="h-4 w-4" /> Back to Store
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        {/* Back + Store header */}
        <div className="flex items-center gap-2 mb-6">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setLocation("/store")}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <div className="flex items-center gap-2 ml-auto">
            <ShoppingBag className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold">Store</span>
          </div>
        </div>

        {/* Product hero */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Image */}
          <div className="aspect-square md:aspect-[4/3] bg-muted rounded-xl overflow-hidden flex items-center justify-center border border-border">
            {product.imageUrl ? (
              <img src={product.imageUrl} alt={product.title} className="w-full h-full object-cover" />
            ) : (
              <Package className="h-16 w-16 text-muted-foreground/30" />
            )}
          </div>

          {/* Info */}
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">{product.title}</h1>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-3xl font-bold text-primary font-mono">{product.price} pts</span>
                {product.priceUsd && (
                  <span className="text-2xl font-bold text-green-600">${product.priceUsd}</span>
                )}
                <span className="text-sm text-muted-foreground">· {product.stock > 0 ? `${product.stock} in stock` : <span className="text-red-500">Out of stock</span>}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <StarRating rating={product.avgRating} size={18} />
              <span className="text-sm text-muted-foreground">
                {product.reviewsCount > 0 ? `${product.avgRating} out of 5 (${product.reviewsCount} reviews)` : "No reviews yet"}
              </span>
            </div>

            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>

            {/* Buy section */}
            {user ? (
              <div className="bg-muted/50 rounded-xl p-4 space-y-3 border border-border">
                {buyDone ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-green-600">
                      <CheckCircle className="h-5 w-5" />
                      <span className="font-semibold">Purchase complete!</span>
                    </div>
                    <Button className="w-full gap-2" onClick={() => setLocation("/messages")}>
                      <MessageSquare className="h-4 w-4" />
                      Get Your Items (Go to Messages)
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Quantity</label>
                        <Input
                          type="number"
                          min={1}
                          max={product.stock}
                          value={buyQty}
                          onChange={(e) => setBuyQty(Math.max(1, Math.min(product.stock, parseInt(e.target.value) || 1)))}
                          className="w-20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-medium">Total</label>
                        <div className="text-xl font-bold text-primary font-mono">{product.price * buyQty} pts</div>
                      </div>
                      <div className="space-y-1 ml-auto">
                        <label className="text-xs font-medium">Your balance</label>
                        <div className="text-sm font-medium">{user.points} pts</div>
                      </div>
                    </div>

                    {buyError && (
                      <div className="flex items-center gap-2 text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        {buyError}
                      </div>
                    )}

                    {product.hasPurchased && (
                      <div className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 rounded-lg px-3 py-2">
                        <CheckCircle className="h-4 w-4 shrink-0" />
                        You own this product.
                      </div>
                    )}

                    <Button
                      className="w-full"
                      disabled={product.stock < 1 || user.points < product.price * buyQty || buyMutation.isPending}
                      onClick={() => buyMutation.mutate()}
                    >
                      {buyMutation.isPending ? "Processing..." : `Buy for ${product.price * buyQty} pts`}
                    </Button>
                    {product.priceUsd && product.buyUrl && (
                      <a href={product.buyUrl} target="_blank" rel="noopener noreferrer" className="block w-full">
                        <Button variant="outline" className="w-full gap-2 border-green-500/40 text-green-600 hover:bg-green-500/10">
                          Buy for ${product.priceUsd} USD
                        </Button>
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <Button className="w-full" onClick={() => setLocation("/login")}>
                Login to Buy
              </Button>
            )}
          </div>
        </div>

        {/* Delivered items (if user bought) */}
        {user && product.deliveredUnits?.length > 0 && (
          <div className="space-y-3 mb-8">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <PackageOpen className="h-5 w-5 text-green-600" />
              Your Delivered Items
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {product.deliveredUnits.map((u: any, i: number) => (
                <div key={u.id} className="bg-green-500/5 border border-green-500/20 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-bold bg-green-500/10 text-green-600 rounded px-2 py-0.5">Item {i + 1}</span>
                    <span className="text-xs text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-mono break-all text-foreground">{u.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Star className="h-5 w-5 text-amber-400" />
            Reviews
          </h2>

          {/* Add review */}
          {user && product.hasPurchased && (
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Your rating:</span>
                <StarRating rating={reviewRating} size={22} interactive onRate={setReviewRating} />
              </div>
              <Input
                placeholder="Write your review (optional)..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                disabled={reviewRating === 0}
              />
              <Button
                size="sm"
                disabled={reviewRating === 0 || reviewMutation.isPending}
                onClick={() => reviewMutation.mutate()}
              >
                {reviewMutation.isPending ? "Posting..." : "Post Review"}
              </Button>
            </div>
          )}

          {user && !product.hasPurchased && (
            <div className="text-sm text-muted-foreground bg-muted/50 rounded-lg px-4 py-3">
              Purchase this product to leave a review.
            </div>
          )}

          {/* Review list */}
          {product.reviews?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reviews yet. Be the first after purchasing!</p>
          ) : (
            <div className="space-y-3">
              {product.reviews?.map((r: any) => (
                <div key={r.id} className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{r.username || "User"}</span>
                      <StarRating rating={r.rating} size={12} />
                    </div>
                    <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </div>
                  {r.comment && <p className="text-sm text-muted-foreground">{r.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
