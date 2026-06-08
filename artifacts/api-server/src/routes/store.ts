// @ts-nocheck
import express from "express";
import { db, productsTable, productReviewsTable, productPurchasesTable, usersTable, messagesTable } from "@workspace/db";
import { eq, and, desc, sql, avg } from "drizzle-orm";
import { requireAuth, requireAdmin } from "../middlewares/auth";

const router = express.Router();

// ── List products ──
router.get("/products", async (_req, res) => {
  const products = await db.select().from(productsTable).orderBy(desc(productsTable.createdAt));

  const reviews = await db.select().from(productReviewsTable);
  const stats = new Map();
  for (const r of reviews) {
    const s = stats.get(r.productId) || { count: 0, total: 0 };
    s.count += 1;
    s.total += r.rating;
    stats.set(r.productId, s);
  }

  const result = products.map((p) => {
    const s = stats.get(p.id);
    return {
      ...p,
      reviewsCount: s?.count ?? 0,
      avgRating: s ? +(s.total / s.count).toFixed(1) : 0,
    };
  });

  res.json(result);
});

// ── Get single product with reviews ──
router.get("/products/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const reviews = await db
    .select({
      id: productReviewsTable.id,
      rating: productReviewsTable.rating,
      comment: productReviewsTable.comment,
      createdAt: productReviewsTable.createdAt,
      userId: productReviewsTable.userId,
      username: usersTable.username,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(productReviewsTable)
    .leftJoin(usersTable, eq(productReviewsTable.userId, usersTable.id))
    .where(eq(productReviewsTable.productId, id))
    .orderBy(desc(productReviewsTable.createdAt));

  const avgRating = reviews.length ? +(reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : 0;

  res.json({
    ...product,
    reviews,
    reviewsCount: reviews.length,
    avgRating,
  });
});

// ── Create product (admin only) ──
router.post("/products", requireAdmin, async (req, res) => {
  const { title, description, imageUrl, price, stock } = req.body;
  const creatorId = req.session.userId;

  if (!title?.trim() || !description?.trim() || !price || price <= 0) {
    res.status(400).json({ error: "Title, description, and price are required" });
    return;
  }

  const [product] = await db
    .insert(productsTable)
    .values({
      title: title.trim(),
      description: description.trim(),
      imageUrl: imageUrl?.trim() || null,
      price: Math.max(1, price),
      stock: Math.max(0, stock ?? 0),
      createdBy: creatorId,
    })
    .returning();

  res.status(201).json(product);
});

// ── Add stock (admin only) ──
router.patch("/products/:id/stock", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const { amount } = req.body;

  if (!amount || amount <= 0) {
    res.status(400).json({ error: "Amount must be positive" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  const [updated] = await db
    .update(productsTable)
    .set({ stock: product.stock + amount })
    .where(eq(productsTable.id, id))
    .returning();

  res.json(updated);
});

// ── Delete product (admin only) ──
router.delete("/products/:id", requireAdmin, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  await db.delete(productsTable).where(eq(productsTable.id, id));
  res.json({ ok: true });
});

// ── Add review (auth) ──
router.post("/products/:id/reviews", requireAuth, async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const userId = req.session.userId;
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: "Rating must be between 1 and 5" });
    return;
  }

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  // Check if user already reviewed
  const [existing] = await db
    .select()
    .from(productReviewsTable)
    .where(and(eq(productReviewsTable.productId, productId), eq(productReviewsTable.userId, userId)))
    .limit(1);

  if (existing) {
    res.status(400).json({ error: "You already reviewed this product" });
    return;
  }

  const [review] = await db
    .insert(productReviewsTable)
    .values({
      productId,
      userId,
      rating,
      comment: comment?.trim() || null,
    })
    .returning();

  res.status(201).json(review);
});

// ── Buy product (auth) ──
router.post("/products/:id/buy", requireAuth, async (req, res) => {
  const productId = parseInt(req.params.id, 10);
  const userId = req.session.userId;
  const { quantity = 1 } = req.body;
  const qty = Math.max(1, parseInt(quantity, 10) || 1);

  const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId)).limit(1);
  if (!product) {
    res.status(404).json({ error: "Product not found" });
    return;
  }

  if (product.stock < qty) {
    res.status(400).json({ error: "Not enough stock" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  const totalPrice = product.price * qty;
  if ((user?.points ?? 0) < totalPrice) {
    res.status(400).json({ error: "Not enough points" });
    return;
  }

  // Deduct points
  await db
    .update(usersTable)
    .set({ points: user.points - totalPrice })
    .where(eq(usersTable.id, userId));

  // Decrease stock
  await db
    .update(productsTable)
    .set({ stock: product.stock - qty })
    .where(eq(productsTable.id, productId));

  // Record purchase
  await db.insert(productPurchasesTable).values({
    productId,
    userId,
    quantity: qty,
    totalPrice,
  });

  // Auto-message the user (from admin "bot")
  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.isAdmin, true))
    .limit(1);

  const senderId = admin?.id ?? product.createdBy;

  const msgContent = `🛒 Order confirmed!

Item: ${product.title}
Qty: ${qty}
Cost: ${totalPrice} pts

Your product is ready. Click the button below to view your messages.`;

  await db
    .insert(messagesTable)
    .values({ senderId, receiverId: userId, content: msgContent });

  res.json({ success: true, message: "Purchase successful! Check your messages for your item." });
});

// ── Admin: list all purchases ──
router.get("/admin/purchases", requireAdmin, async (_req, res) => {
  const purchases = await db
    .select({
      id: productPurchasesTable.id,
      quantity: productPurchasesTable.quantity,
      totalPrice: productPurchasesTable.totalPrice,
      createdAt: productPurchasesTable.createdAt,
      productId: productPurchasesTable.productId,
      productTitle: productsTable.title,
      userId: productPurchasesTable.userId,
      username: usersTable.username,
    })
    .from(productPurchasesTable)
    .leftJoin(productsTable, eq(productPurchasesTable.productId, productsTable.id))
    .leftJoin(usersTable, eq(productPurchasesTable.userId, usersTable.id))
    .orderBy(desc(productPurchasesTable.createdAt));

  res.json(purchases);
});

export default router;
