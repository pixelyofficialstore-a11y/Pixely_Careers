import { pgTable, text, serial, integer, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

// === ENUMS ===
export const userRoles = ["admin", "support", "designer"] as const;
export const orderStatuses = ["new", "working", "ready", "delivered", "canceled"] as const;
export const chatStatuses = ["new", "changes", "satisfied", "issues"] as const;
export const priorities = ["normal", "high", "urgent"] as const;
export const paymentVerificationStatuses = ["pending_confirmation", "approved", "disapproved"] as const;
export const paymentTypes = ["advance", "full", "remaining"] as const;
export const advancePaymentStatuses = ["pending", "approved", "disapproved"] as const;
export const messageTypes = ["text", "file", "system"] as const;
export const activityTypes = ["status_change", "payment_change", "assignment", "note", "chat_tag", "verification"] as const;

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
  orderNumber: text("order_number").unique(), // e.g. PX-260-001 - null until payment approved
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  clientEmail: text("client_email"),
  status: text("status", { enum: orderStatuses }).notNull().default("new"),
  priority: text("priority", { enum: priorities }).notNull().default("normal"),
  assignedToId: integer("assigned_to_id").references(() => users.id), // Designer ID
  readyDate: timestamp("ready_date"), // Date when status changed to Ready - for reporting
  paymentStatus: text("payment_status").default("pending"), // "paid" or "pending"
  advancePaymentStatus: text("advance_payment_status", { enum: advancePaymentStatuses }).default("pending"), // Advance payment verification status
  intendedDesignerId: integer("intended_designer_id").references(() => users.id), // Designer to assign after payment approval
  totalPrice: integer("total_price").notNull().default(0), // In PKR (stored as integers)
  advanceAmount: integer("advance_amount").default(0), // Advance payment received
  remainingAmount: integer("remaining_amount").default(0), // Remaining balance
  campaign: text("campaign"),
  adSet: text("ad_set"),
  creative: text("creative"),
  notes: text("notes"),
  internalNotes: text("internal_notes"), // Team-only notes
  linkedChatId: integer("linked_chat_id"), // Link to associated chat
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Order Services (line items)
export const orderServices = pgTable("order_services", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  serviceType: text("service_type").notNull(), // ATS CV, Professional CV, LinkedIn, etc.
  quantity: integer("quantity").notNull().default(1),
  instructions: text("instructions"),
  status: text("status", { enum: orderStatuses }).notNull().default("new"),
});

// Chats (WhatsApp integration ready)
export const chats = pgTable("chats", {
  id: serial("id").primaryKey(),
  clientName: text("client_name").notNull(),
  clientPhone: text("client_phone"),
  platform: text("platform").default("whatsapp"),
  status: text("status", { enum: chatStatuses }).notNull().default("new"),
  assignedToId: integer("assigned_to_id").references(() => users.id),
  linkedOrderId: integer("linked_order_id"), // Link to associated order
  externalChatId: text("external_chat_id"), // WhatsApp conversation ID
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  unreadCount: integer("unread_count").default(0),
  tags: jsonb("tags").$type<string[]>(), // ["New", "Satisfied", etc]
  isInternal: boolean("is_internal").default(false), // True for internal team chats (like Payment Verification)
  createdAt: timestamp("created_at").defaultNow(),
});

// Messages
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  chatId: integer("chat_id").notNull().references(() => chats.id),
  senderType: text("sender_type").notNull(), // "user" or "client"
  senderId: integer("sender_id").references(() => users.id), // Null if client
  messageType: text("message_type", { enum: messageTypes }).default("text"), // text, file, system
  content: text("content").notNull(),
  fileUrl: text("file_url"), // URL for file attachments
  fileName: text("file_name"), // Original filename
  fileMeta: jsonb("file_meta").$type<{ size?: number; type?: string }>(), // File metadata
  externalMessageId: text("external_message_id"), // WhatsApp message ID
  isRead: boolean("is_read").default(false),
  replyToMessageId: integer("reply_to_message_id"), // For reply/quote feature
  reactions: jsonb("reactions").$type<{ emoji: string; senderPhone?: string }[]>(), // Reactions received on this message
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

// Activity Logs - track all changes to orders/chats
export const activityLogs = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id),
  chatId: integer("chat_id").references(() => chats.id),
  actorId: integer("actor_id").references(() => users.id), // Who made the change
  activityType: text("activity_type", { enum: activityTypes }).notNull(),
  previousValue: text("previous_value"),
  newValue: text("new_value"),
  details: jsonb("details").$type<Record<string, unknown>>(), // Additional context
  createdAt: timestamp("created_at").defaultNow(),
});

// Payment Verifications - screenshot upload and admin approval workflow
export const paymentVerifications = pgTable("payment_verifications", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  paymentType: text("payment_type", { enum: paymentTypes }).notNull(), // advance, full, remaining
  amount: integer("amount").notNull(), // Amount being verified
  screenshotUrl: text("screenshot_url"), // URL to uploaded screenshot
  submittedById: integer("submitted_by_id").notNull().references(() => users.id),
  status: text("status", { enum: paymentVerificationStatuses }).default("pending_confirmation"),
  reviewedById: integer("reviewed_by_id").references(() => users.id), // Admin who reviewed
  reviewedAt: timestamp("reviewed_at"),
  notes: text("notes"), // Admin notes on rejection/approval
  createdAt: timestamp("created_at").defaultNow(),
});

// Message Shortcuts - quick message templates for Support/Admin
export const messageShortcuts = pgTable("message_shortcuts", {
  id: serial("id").primaryKey(),
  command: text("command").notNull().unique(), // e.g. "payment", "ready", "thanks"
  content: text("content").notNull(), // The message template
  createdById: integer("created_by_id").references(() => users.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Catalogs - product/service catalog items for WhatsApp Business
export const catalogs = pgTable("catalogs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(), // In PKR
  imageUrl: text("image_url"), // URL to product image
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdById: integer("created_by_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Monthly Finance Summary - aggregated finance data per month (Admin only)
export const monthlyFinance = pgTable("monthly_finance", {
  id: serial("id").primaryKey(),
  month: text("month").notNull().unique(), // YYYY-MM format
  totalCollected: integer("total_collected").default(0), // Total collected in PKR
  totalRemaining: integer("total_remaining").default(0), // Total pending in PKR
  totalOrders: integer("total_orders").default(0),
  paidOrders: integer("paid_orders").default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// === RELATIONS ===
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  chats: many(chats),
  notifications: many(notifications),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  assignee: one(users, {
    fields: [orders.assignedToId],
    references: [users.id],
  }),
  createdBy: one(users, {
    fields: [orders.createdById],
    references: [users.id],
  }),
  services: many(orderServices),
  activityLogs: many(activityLogs),
  paymentVerifications: many(paymentVerifications),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  order: one(orders, {
    fields: [activityLogs.orderId],
    references: [orders.id],
  }),
  chat: one(chats, {
    fields: [activityLogs.chatId],
    references: [chats.id],
  }),
  actor: one(users, {
    fields: [activityLogs.actorId],
    references: [users.id],
  }),
}));

export const paymentVerificationsRelations = relations(paymentVerifications, ({ one }) => ({
  order: one(orders, {
    fields: [paymentVerifications.orderId],
    references: [orders.id],
  }),
  submittedBy: one(users, {
    fields: [paymentVerifications.submittedById],
    references: [users.id],
  }),
  reviewedBy: one(users, {
    fields: [paymentVerifications.reviewedById],
    references: [users.id],
  }),
}));

export const orderServicesRelations = relations(orderServices, ({ one }) => ({
  order: one(orders, {
    fields: [orderServices.orderId],
    references: [orders.id],
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
export const insertOrderSchema = createInsertSchema(orders).omit({ id: true, createdAt: true });
export const insertOrderServiceSchema = createInsertSchema(orderServices).omit({ id: true });
export const insertChatSchema = createInsertSchema(chats).omit({ id: true, lastMessageAt: true, unreadCount: true, createdAt: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true, createdAt: true });
export const insertActivityLogSchema = createInsertSchema(activityLogs).omit({ id: true, createdAt: true });
export const insertPaymentVerificationSchema = createInsertSchema(paymentVerifications).omit({ id: true, createdAt: true });
export const insertMessageShortcutSchema = createInsertSchema(messageShortcuts).omit({ id: true, createdAt: true });
export const insertCatalogSchema = createInsertSchema(catalogs).omit({ id: true, createdAt: true });

// === TYPES ===
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderService = typeof orderServices.$inferSelect;
export type InsertOrderService = z.infer<typeof insertOrderServiceSchema>;
export type Chat = typeof chats.$inferSelect;
export type InsertChat = z.infer<typeof insertChatSchema>;
export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Notification = typeof notifications.$inferSelect;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type PaymentVerification = typeof paymentVerifications.$inferSelect;
export type InsertPaymentVerification = z.infer<typeof insertPaymentVerificationSchema>;
export type MessageShortcut = typeof messageShortcuts.$inferSelect;
export type InsertMessageShortcut = z.infer<typeof insertMessageShortcutSchema>;
export type Catalog = typeof catalogs.$inferSelect;
export type InsertCatalog = z.infer<typeof insertCatalogSchema>;
export type MonthlyFinance = typeof monthlyFinance.$inferSelect;
export type UserRole = (typeof userRoles)[number];

// Order with services for API responses
export type OrderWithServices = Order & {
  services: OrderService[];
  assignee?: User | null;
};

// Chat with messages and assignee for API responses
export type ChatWithDetails = Chat & {
  messages?: Message[];
  assignee?: User | null;
};

// Activity log with actor details
export type ActivityLogWithActor = ActivityLog & {
  actor?: User | null;
};

// Payment verification with user details
export type PaymentVerificationWithUsers = PaymentVerification & {
  submittedBy?: User | null;
  reviewedBy?: User | null;
};
