import { Layout } from "@/components/layout";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { ShoppingBag, Star, ArrowLeft, MessageSquare, Package, PackageOpen, Search, AlertCircle } from "lucide-react";

// ── API helpers ──
async function fetchProducts() {
  const res = await fetch("/api/store/products", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load products");
  return res.json() as Promise<any[]>;
}

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
function StarRating({ rating, max = 5, size = 14, interactive = false, onRate }: {
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
export default function Store() {
  const { data: user } = useGetMe();
  const { data: products = [], isLoading } = useQuery({ queryKey: ["store-products"], queryFn: fetchProducts });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [buyDone, setBuyDone] = useState(false);
  const [buyError, setBuyError] = useState("");
  const [buyQty, setBuyQty] = useState(1);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState("");
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

  const { data: productDetail } = useQuery({
    queryKey: ["store-product", selectedId],
    queryFn: () => fetchProduct(selectedId!),
    enabled: selectedId !== null,
  });

  const buyMutation = useMutation({
    mutationFn: () => buyProduct(selectedId!, buyQty),
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
    mutationFn: () => postReview(selectedId!, reviewRating, reviewText),
    onSuccess: () => {
      setReviewRating(0);
      setReviewText("");
      toast({ title: "Review posted!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleClose = () => {
    setSelectedId(null);
    setBuyDone(false);
    setBuyError("");
    setBuyQty(1);
    setReviewRating(0);
    setReviewText("");
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Store</h1>
              <p className="text-sm text-muted-foreground">
                {user ? (
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-mono">{user.points} pts</span>
                    <span>available</span>
                  </span>
                ) : (
                  "Login to buy items"
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/messages">
              <button className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-8 px-3 py-2">
                <MessageSquare className="h-4 w-4" />
                <span className="hidden sm:inline">Messages</span>
              </button>
            </Link>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="text-center py-16 text-muted-foreground">Loading products...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-card border border-border rounded-xl">
            <Package className="h-10 w-10 mx-auto text-muted-foreground/20 mb-3" />
            <p className="text-muted-foreground">{search ? "No products match your search." : "No products available yet."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className="text-left bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all hover:shadow-sm group"
              >
                <div className="aspect-[4/3] bg-muted flex items-center justify-center overflow-hidden">
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <Package className="h-10 w-10 text-muted-foreground/30" />
                  )}
                </div>
                <div className="p-4 space-y-2">
                  <h3 className="font-semibold line-clamp-1">{p.title}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-primary font-bold font-mono">{p.price} pts</span>
                    <span className="text-xs text-muted-foreground">· {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={p.avgRating} size={12} />
                    <span className="text-xs text-muted-foreground">
                      {p.reviewsCount > 0 ? `${p.avgRating} (${p.reviewsCount})` : "No reviews"}
                    </span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Product Detail Dialog */}
      <Dialog open={selectedId !== null} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="bg-card border-border max-w-lg max-h-[90vh] overflow-y-auto">
          {productDetail ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" />
                  {productDetail.title}
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* Image */}
                <div className="aspect-[16/10] bg-muted rounded-lg overflow-hidden flex items-center justify-center">
                  {productDetail.imageUrl ? (
                    <img src={productDetail.imageUrl} alt={productDetail.title} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="h-12 w-12 text-muted-foreground/30" />
                  )}
                </div>

                {/* Info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-bold text-primary font-mono">{productDetail.price} pts</span>
                    <span className="text-sm text-muted-foreground">
                      {productDetail.stock > 0 ? `${productDetail.stock} in stock` : "Out of stock"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={productDetail.avgRating} size={14} />
                    <span className="text-sm text-muted-foreground">
                      {productDetail.reviewsCount > 0 ? `${productDetail.avgRating} (${productDetail.reviewsCount})` : "No reviews"}
                    </span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">{productDetail.description}</p>

                {/* Buy section */}
                {user ? (
                  <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                    {buyDone ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-green-600">
                          <PackageOpen className="h-5 w-5" />
                          <span className="font-semibold">Purchase complete!</span>
                        </div>
                        <Button
                          className="w-full gap-2"
                          onClick={() => { handleClose(); setLocation("/messages"); }}
                        >
                          <MessageSquare className="h-4 w-4" />
                          Get Item (Go to Messages)
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
                              max={productDetail.stock}
                              value={buyQty}
                              onChange={(e) => setBuyQty(Math.max(1, Math.min(productDetail.stock, parseInt(e.target.value) || 1)))}
                              className="w-20"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-xs font-medium">Total</label>
                            <div className="text-lg font-bold text-primary font-mono">{productDetail.price * buyQty} pts</div>
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

                        <Button
                          className="w-full"
                          disabled={productDetail.stock < 1 || user.points < productDetail.price * buyQty || buyMutation.isPending}
                          onClick={() => buyMutation.mutate()}
                        >
                          {buyMutation.isPending ? "Processing..." : `Buy for ${productDetail.price * buyQty} pts`}
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-sm text-muted-foreground py-2">
                    <Link href="/login">
                      <button className="inline-flex items-center justify-center w-full gap-2 whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                        Login to Buy
                      </button>
                    </Link>
                  </div>
                )}

                {/* Reviews */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm">Reviews</h3>

                  {/* Add review */}
                  {user && (
                    <div className="space-y-2 border border-border rounded-lg p-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Your rating:</span>
                        <StarRating rating={reviewRating} size={18} interactive onRate={setReviewRating} />
                      </div>
                      <Input
                        placeholder="Write a review (optional)..."
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        disabled={reviewRating === 0}
                      />
                      <Button
                        size="sm"
                        disabled={reviewRating === 0 || reviewMutation.isPending}
                        onClick={() => reviewMutation.mutate()}
                        className="w-full"
                      >
                        {reviewMutation.isPending ? "Posting..." : "Post Review"}
                      </Button>
                    </div>
                  )}

                  {/* Review list */}
                  {productDetail.reviews?.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No reviews yet. Be the first!</p>
                  ) : (
                    <div className="space-y-2">
                      {productDetail.reviews?.map((r: any) => (
                        <div key={r.id} className="border border-border rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{r.username || "User"}</span>
                              <StarRating rating={r.rating} size={12} />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {new Date(r.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                          {r.comment && <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          )}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
