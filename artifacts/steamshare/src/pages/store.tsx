import { Layout } from "@/components/layout";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { ShoppingBag, Star, Package, Search } from "lucide-react";

// ── API helpers ──
async function fetchProducts() {
  const res = await fetch("/api/store/products", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to load products");
  return res.json() as Promise<any[]>;
}

// ── Star rating component ──
function StarRating({ rating, max = 5, size = 14 }: {
  rating: number; max?: number; size?: number;
}) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.round(rating);
        return (
          <Star
            key={i}
            className={`${filled ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40"}`}
            style={{ width: size, height: size }}
          />
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
  const [, setLocation] = useLocation();

  const filtered = products.filter((p) =>
    p.title.toLowerCase().includes(search.toLowerCase()) ||
    p.description.toLowerCase().includes(search.toLowerCase())
  );

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
              <div
                key={p.id}
                onClick={() => setLocation(`/store/${p.id}`)}
                className="cursor-pointer bg-card border border-border rounded-xl overflow-hidden hover:border-primary/40 transition-all hover:shadow-sm group"
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
                    <span className="text-xs text-muted-foreground">
                      {p.stock > 0 ? `${p.stock} in stock` : "Out of stock"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <StarRating rating={p.avgRating} size={12} />
                    <span className="text-xs text-muted-foreground">
                      {p.reviewsCount > 0 ? `${p.avgRating} (${p.reviewsCount})` : "No reviews"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
