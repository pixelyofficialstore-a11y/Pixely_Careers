import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === ENUMS ===
export const userRoles = ["admin", "support", "designer"] as const;
export const orderStatuses = ["pending", "working", "ready", "delivered"] as const;
export const chatStatuses = ["new", "changes", "satisfied", "issues"] as const;
export const priorities = ["normal", "high", "urgent"] as const;

// === TABLES ===

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role", { enum: userRoles }).notNull().default("designer"),
  name: text("name").notNull(),
  title: text("title"), // e.g. "Senior Designer"
  avatar: text("avatar"), // URL to avatar image
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Orders
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: text("order_number").notNull().unique(), // e.g. PX-006-105
  clientName: text("client_name").notNull(),
  serviceType: text("service_type").notNull(), // e.g. "CV", "Cover Letter"
  description: text("description"),
  status: text("status", { enum: orderStatuses }).notNull().default("pending"),
  priority: text("priority", { enum: priorities }).notNull().default("normal"),
  assignedToId: integer("assigned_to_id").references(() => users.id), // Designer ID
  deadline: timestamp("deadline").notNull(),
  price: integer("price").notNull().default(0), // Stored in cents, visible only to Admin
  amountPaid: integer("amount_paid").default(0),
  attachments: jsonb("attachments").$type<string[]>(), // Array of file URLs
  createdAt: timestamp("created_at").defaultNow(),
});

// Chats (Mock WhatsApp)
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  platform: text("platform").default("whatsapp"),
  status: text("status", { enum: chatStatuses }).notNull().default("new"),
  assignedToId: integer("assigned_to_id").references(() => users.id),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  unreadCount: integer("unread_count").default(0),
  tags: jsonb("tags").$type<string[]>(), // ["New", "Satisfied", etc]
});

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chats.id),
  senderType: text("sender_type").notNull(), // "user" or "client"
  senderId: integer("sender_id").references(() => users.id), // Null if client
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Notifications
export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // "assignment", "status_change", "system"
  message: text("message").notNull(),
  read: boolean("read").default(false).notNull(),
  relatedId: integer("related_id"), // ID of order or chat
  relatedType: text("related_type"), // "order" or "chat"
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  chats: many(chats),
  notifications: many(notifications),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  assignee: one(users, {
    fields: [orders.assignedToId],
    references: [users.id],
  }),
}));

export const chatsRelations = relations(chats, ({ one, many }) => ({
  assignee: one(users, {
    fields: [chats.assignedToId],
    references: [users.id],
  }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id],
  }),
  sender: one(users, {
    fields: [messages.senderId],
    references: [users.id],
  }),
}));

// === SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true, orderNumber: true });
export const insertChatSchema = createInsertSchema(chats).omit({ id: true, lastMessageAt: true, unreadCount: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Chat = typeof chats.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type UserRole = (typeof userRoles)[number];
