import { 
  users, orders, chats, messages, notifications, orderServices, messageShortcuts, paymentVerifications, activityLogs, catalogs,
  type User, type InsertUser, type Order, type InsertOrder, type Chat, type InsertChat, type Message, type Notification,
  type OrderService, type InsertOrderService, type OrderWithServices, type MessageShortcut, 
  type PaymentVerification, type InsertPaymentVerification, type PaymentVerificationWithUsers,
  type Catalog, type InsertCatalog
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql, and, isNotNull } from "drizzle-orm";

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User>;
  getUsers(): Promise<User[]>;

  // Orders
  getOrder(id: number): Promise<OrderWithServices | undefined>;
  getOrders(role: string, userId: number): Promise<OrderWithServices[]>;
  createOrder(order: InsertOrder, services?: Omit<InsertOrderService, 'orderId'>[]): Promise<Order>;
  updateOrder(id: number, updates: Partial<InsertOrder>): Promise<Order>;
  getOrderServices(orderId: number): Promise<OrderService[]>;
  createOrderService(service: InsertOrderService): Promise<OrderService>;
  generateOrderNumber(): Promise<string>;

  // Chats
  getChat(id: number): Promise<(Chat & { messages: Message[] }) | undefined>;
  getChatByPhone(phone: string): Promise<Chat | undefined>;
  getChats(role: string, userId: number): Promise<Chat[]>;
  createChat(chat: InsertChat): Promise<Chat>;
  updateChat(id: number, updates: Partial<Chat>): Promise<Chat>;
  createMessage(chatId: number, senderId: number | null, senderType: string, content: string, fileUrl?: string, externalMessageId?: string): Promise<Message>;
  createMessageWithFile(chatId: number, senderId: number | null, senderType: string, content: string, fileUrl?: string, fileName?: string, fileMeta?: { size?: number; type?: string }): Promise<Message>;
  getMessageByFileUrl(chatId: number, fileUrl: string): Promise<Message | undefined>;
  updateMessageExternalId(id: number, externalMessageId: string): Promise<void>;

  // Notifications
  getNotifications(userId: number): Promise<Notification[]>;
  markNotificationRead(id: number): Promise<Notification>;
  createNotification(userId: number, type: string, message: string, relatedId?: number, relatedType?: string): Promise<Notification>;

  // Message Shortcuts
  getShortcuts(): Promise<MessageShortcut[]>;
  createShortcut(data: { command: string; content: string; isActive: boolean }): Promise<MessageShortcut>;
  updateShortcut(id: number, updates: Partial<{ command: string; content: string; isActive: boolean }>): Promise<MessageShortcut | undefined>;
  deleteShortcut(id: number): Promise<void>;
  getChatMessages(chatId: number): Promise<Message[]>;
  
  // Delete operations
  deleteMessage(id: number): Promise<void>;
  deleteChat(id: number): Promise<void>;

  // Stats
  getStats(): Promise<any>;
  getWhatsAppAnalytics(): Promise<{ todayNewChats: number; totalChats: number; thisWeekNewChats: number; thisMonthNewChats: number }>;

  // Payment Verifications
  getPaymentVerifications(role: string, userId: number): Promise<PaymentVerificationWithUsers[]>;
  getPaymentVerificationsByOrder(orderId: number): Promise<PaymentVerificationWithUsers[]>;
  createPaymentVerification(data: InsertPaymentVerification): Promise<PaymentVerification>;
  updatePaymentVerification(id: number, updates: Partial<InsertPaymentVerification>): Promise<PaymentVerification>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.id);
  }

  // Orders
  async getOrder(id: number): Promise<OrderWithServices | undefined> {
    const [order] = await db.select().from(orders).where(eq(orders.id, id));
    if (!order) return undefined;
    const services = await this.getOrderServices(id);
    const allUsers = await this.getUsers();
    const assignee = order.assignedToId ? allUsers.find(u => u.id === order.assignedToId) : null;
    return { ...order, services, assignee };
  }

  async getOrders(role: string, userId: number): Promise<OrderWithServices[]> {
    let orderList: Order[];
    if (role === "admin" || role === "support") {
      orderList = await db.select().from(orders).orderBy(desc(orders.createdAt));
    } else {
      orderList = await db.select().from(orders).where(eq(orders.assignedToId, userId)).orderBy(desc(orders.createdAt));
    }
    const allServices = await db.select().from(orderServices);
    const allUsers = await this.getUsers();
    return orderList.map(order => ({
      ...order,
      services: allServices.filter(s => s.orderId === order.id),
      assignee: order.assignedToId ? allUsers.find(u => u.id === order.assignedToId) : null
    }));
  }

  async createOrder(order: InsertOrder, services?: Omit<InsertOrderService, 'orderId'>[]): Promise<Order> {
    const [newOrder] = await db.insert(orders).values(order).returning();
    if (services && services.length > 0) {
      for (const svc of services) {
        await this.createOrderService({ ...svc, orderId: newOrder.id });
      }
    }
    return newOrder;
  }

  async updateOrder(id: number, updates: Partial<InsertOrder>): Promise<Order> {
    const [updatedOrder] = await db.update(orders).set(updates).where(eq(orders.id, id)).returning();
    return updatedOrder;
  }

  async getOrderServices(orderId: number): Promise<OrderService[]> {
    return await db.select().from(orderServices).where(eq(orderServices.orderId, orderId));
  }

  async createOrderService(service: InsertOrderService): Promise<OrderService> {
    const [newService] = await db.insert(orderServices).values(service).returning();
    return newService;
  }

  async generateOrderNumber(): Promise<string> {
    const year = new Date().getFullYear().toString().slice(-2);
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    // Only count orders that have been assigned an order number (approved orders)
    const approvedOrders = await db.select().from(orders).where(isNotNull(orders.orderNumber));
    const count = approvedOrders.length + 1;
    return `PX-${year}${month}-${count.toString().padStart(3, '0')}`;
  }

  // Chats
  async getChat(id: number): Promise<(Chat & { messages: Message[] }) | undefined> {
    const [chat] = await db.select().from(chats).where(eq(chats.id, id));
    if (!chat) return undefined;

    const chatMessages = await db.select().from(messages)
      .where(eq(messages.chatId, id))
      .orderBy(messages.createdAt);
    
    return { ...chat, messages: chatMessages };
  }

  async getChatByPhone(phone: string): Promise<Chat | undefined> {
    const [chat] = await db.select().from(chats).where(eq(chats.clientPhone, phone));
    return chat;
  }

  async getChats(role: string, userId: number): Promise<Chat[]> {
    if (role === "admin" || role === "support") {
      return await db.select().from(chats).orderBy(desc(chats.lastMessageAt));
    } else {
      return await db.select().from(chats).where(eq(chats.assignedToId, userId)).orderBy(desc(chats.lastMessageAt));
    }
  }

  async createChat(chat: InsertChat): Promise<Chat> {
    const [newChat] = await db.insert(chats).values(chat as any).returning();
    return newChat;
  }

  async updateChat(id: number, updates: Partial<Chat>): Promise<Chat> {
    const [updatedChat] = await db.update(chats).set(updates).where(eq(chats.id, id)).returning();
    return updatedChat;
  }

  async createMessage(chatId: number, senderId: number | null, senderType: string, content: string, fileUrl?: string, externalMessageId?: string): Promise<Message> {
    const [message] = await db.insert(messages).values({
      chatId,
      senderId,
      senderType,
      content,
      fileUrl: fileUrl || null,
      externalMessageId: externalMessageId || null,
    }).returning();

    // Update chat last message
    await db.update(chats).set({
      lastMessage: content,
      lastMessageAt: new Date(),
      unreadCount: sql`unread_count + 1`
    }).where(eq(chats.id, chatId));

    return message;
  }

  async createMessageWithFile(chatId: number, senderId: number | null, senderType: string, content: string, fileUrl?: string, fileName?: string, fileMeta?: { size?: number; type?: string }): Promise<Message> {
    const [message] = await db.insert(messages).values({
      chatId,
      senderId,
      senderType,
      messageType: fileUrl ? "file" : "text",
      content,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileMeta: fileMeta || null,
    }).returning();

    // Update chat metadata (same as createMessage)
    const displayMessage = fileName ? `Sent: ${fileName}` : content;
    await db.update(chats).set({
      lastMessage: displayMessage,
      lastMessageAt: new Date(),
      unreadCount: sql`unread_count + 1`
    }).where(eq(chats.id, chatId));

    return message;
  }

  async getMessageByFileUrl(chatId: number, fileUrl: string): Promise<Message | undefined> {
    const [message] = await db.select().from(messages)
      .where(and(eq(messages.chatId, chatId), eq(messages.fileUrl, fileUrl)))
      .limit(1);
    return message;
  }

  async updateMessageExternalId(id: number, externalMessageId: string): Promise<void> {
    await db.update(messages)
      .set({ externalMessageId })
      .where(eq(messages.id, id));
  }

  // Notifications
  async getNotifications(userId: number): Promise<Notification[]> {
    return await db.select().from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(desc(notifications.createdAt));
  }

  async markNotificationRead(id: number): Promise<Notification> {
    const [notification] = await db.update(notifications)
      .set({ read: true })
      .where(eq(notifications.id, id))
      .returning();
    return notification;
  }

  async createNotification(userId: number, type: string, message: string, relatedId?: number, relatedType?: string): Promise<Notification> {
    const [notification] = await db.insert(notifications).values({
      userId,
      type,
      message,
      relatedId,
      relatedType
    }).returning();
    return notification;
  }

  // Message Shortcuts
  async getShortcuts(): Promise<MessageShortcut[]> {
    return await db.select().from(messageShortcuts).where(eq(messageShortcuts.isActive, true));
  }

  async createShortcut(data: { command: string; content: string; isActive: boolean }): Promise<MessageShortcut> {
    const [shortcut] = await db.insert(messageShortcuts).values(data).returning();
    return shortcut;
  }

  async updateShortcut(id: number, updates: Partial<{ command: string; content: string; isActive: boolean }>): Promise<MessageShortcut | undefined> {
    const [shortcut] = await db.update(messageShortcuts).set(updates).where(eq(messageShortcuts.id, id)).returning();
    return shortcut;
  }

  async deleteShortcut(id: number): Promise<void> {
    await db.delete(messageShortcuts).where(eq(messageShortcuts.id, id));
  }

  // Catalogs
  async getCatalogs(): Promise<Catalog[]> {
    return await db.select().from(catalogs).orderBy(catalogs.sortOrder);
  }

  async getActiveCatalogs(): Promise<Catalog[]> {
    return await db.select().from(catalogs)
      .where(eq(catalogs.isActive, true))
      .orderBy(catalogs.sortOrder);
  }

  async createCatalog(data: InsertCatalog): Promise<Catalog> {
    const [catalog] = await db.insert(catalogs).values(data).returning();
    return catalog;
  }

  async updateCatalog(id: number, updates: Partial<InsertCatalog>): Promise<Catalog> {
    const [catalog] = await db.update(catalogs).set(updates).where(eq(catalogs.id, id)).returning();
    return catalog;
  }

  async deleteCatalog(id: number): Promise<void> {
    await db.delete(catalogs).where(eq(catalogs.id, id));
  }

  async getChatMessages(chatId: number): Promise<Message[]> {
    return await db.select().from(messages)
      .where(eq(messages.chatId, chatId))
      .orderBy(messages.createdAt);
  }

  // Stats
  async getStats(): Promise<any> {
    const allOrdersRaw = await db.select().from(orders);
    const allChats = await db.select().from(chats);
    
    // Only count approved orders (those with payment verified) in all stats
    const allOrders = allOrdersRaw.filter(o => o.advancePaymentStatus === 'approved');
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayOrders = allOrders.filter(o => new Date(o.createdAt!) >= today);
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);
    const monthlyOrders = allOrders.filter(o => new Date(o.createdAt!) >= thisMonth);
    
    const orderStats = {
      total: allOrders.length,
      today: todayOrders.length,
      monthly: monthlyOrders.length,
      new: allOrders.filter(o => o.status === 'new').length,
      working: allOrders.filter(o => o.status === 'working').length,
      ready: allOrders.filter(o => o.status === 'ready').length,
      delivered: allOrders.filter(o => o.status === 'delivered').length,
      canceled: allOrders.filter(o => o.status === 'canceled').length,
    };

    const totalRevenue = allOrders.reduce((acc, curr) => acc + (curr.advanceAmount || 0), 0);
    const pendingPayments = allOrders.reduce((acc, curr) => acc + (curr.remainingAmount || 0), 0);

    const chatStats = {
      new: allChats.filter(c => c.status === 'new').length,
      active: allChats.filter(c => c.status !== 'satisfied').length,
    };

    return {
      orders: orderStats,
      finance: {
        totalRevenue,
        monthlyRevenue: monthlyOrders.reduce((acc, curr) => acc + (curr.advanceAmount || 0), 0),
        pendingPayments,
      },
      chats: chatStats
    };
  }

  async getWhatsAppAnalytics(): Promise<{ todayNewChats: number; totalChats: number; thisWeekNewChats: number; thisMonthNewChats: number }> {
    const allChats = await db.select().from(chats).where(isNotNull(chats.clientPhone));
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    
    const todayNewChats = allChats.filter(c => c.createdAt && new Date(c.createdAt) >= today).length;
    const thisWeekNewChats = allChats.filter(c => c.createdAt && new Date(c.createdAt) >= thisWeekStart).length;
    const thisMonthNewChats = allChats.filter(c => c.createdAt && new Date(c.createdAt) >= thisMonthStart).length;
    
    return {
      todayNewChats,
      totalChats: allChats.length,
      thisWeekNewChats,
      thisMonthNewChats
    };
  }

  // Payment Verifications
  async getPaymentVerifications(role: string, userId: number): Promise<PaymentVerificationWithUsers[]> {
    let verificationList: PaymentVerification[];
    
    if (role === "admin") {
      // Admin sees all payment verifications
      verificationList = await db.select().from(paymentVerifications).orderBy(desc(paymentVerifications.createdAt));
    } else {
      // Support and Designer only see their own submissions
      verificationList = await db.select().from(paymentVerifications)
        .where(eq(paymentVerifications.submittedById, userId))
        .orderBy(desc(paymentVerifications.createdAt));
    }

    const allUsers = await this.getUsers();
    return verificationList.map(pv => ({
      ...pv,
      submittedBy: allUsers.find(u => u.id === pv.submittedById) || null,
      reviewedBy: pv.reviewedById ? allUsers.find(u => u.id === pv.reviewedById) || null : null,
    }));
  }

  async getPaymentVerificationsByOrder(orderId: number): Promise<PaymentVerificationWithUsers[]> {
    const verificationList = await db.select().from(paymentVerifications)
      .where(eq(paymentVerifications.orderId, orderId))
      .orderBy(desc(paymentVerifications.createdAt));
    
    const allUsers = await this.getUsers();
    return verificationList.map(pv => ({
      ...pv,
      submittedBy: allUsers.find(u => u.id === pv.submittedById) || null,
      reviewedBy: pv.reviewedById ? allUsers.find(u => u.id === pv.reviewedById) || null : null,
    }));
  }

  async createPaymentVerification(data: InsertPaymentVerification): Promise<PaymentVerification> {
    const [verification] = await db.insert(paymentVerifications).values(data).returning();
    return verification;
  }

  async updatePaymentVerification(id: number, updates: Partial<InsertPaymentVerification>): Promise<PaymentVerification> {
    const [verification] = await db.update(paymentVerifications).set(updates).where(eq(paymentVerifications.id, id)).returning();
    return verification;
  }

  // Delete operations
  async deleteMessage(id: number): Promise<void> {
    await db.delete(messages).where(eq(messages.id, id));
  }

  async deleteChat(id: number): Promise<void> {
    // First delete all messages in the chat
    await db.delete(messages).where(eq(messages.chatId, id));
    // Then delete the chat
    await db.delete(chats).where(eq(chats.id, id));
  }
}

export const storage = new DatabaseStorage();
