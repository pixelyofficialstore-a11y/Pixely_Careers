import { 
  users, orders, chats, messages, notifications, orderServices,
  type User, type InsertUser, type Order, type InsertOrder, type Chat, type InsertChat, type Message, type Notification,
  type OrderService, type InsertOrderService, type OrderWithServices
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, sql } from "drizzle-orm";

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
  createOrder(order: InsertOrder, services?: InsertOrderService[]): Promise<Order>;
  updateOrder(id: number, updates: Partial<InsertOrder>): Promise<Order>;
  getOrderServices(orderId: number): Promise<OrderService[]>;
  createOrderService(service: InsertOrderService): Promise<OrderService>;
  generateOrderNumber(): Promise<string>;

  // Chats
  getChat(id: number): Promise<(Chat & { messages: Message[] }) | undefined>;
  getChats(role: string, userId: number): Promise<Chat[]>;
  createChat(chat: InsertChat): Promise<Chat>;
  updateChat(id: number, updates: Partial<Chat>): Promise<Chat>;
  createMessage(chatId: number, senderId: number | null, senderType: string, content: string): Promise<Message>;

  // Notifications
  getNotifications(userId: number): Promise<Notification[]>;
  markNotificationRead(id: number): Promise<Notification>;
  createNotification(userId: number, type: string, message: string, relatedId?: number, relatedType?: string): Promise<Notification>;

  // Stats
  getStats(): Promise<any>;
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

  async createOrder(order: InsertOrder, services?: InsertOrderService[]): Promise<Order> {
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
    const allOrders = await db.select().from(orders);
    const count = allOrders.length + 1;
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

  async getChats(role: string, userId: number): Promise<Chat[]> {
    if (role === "admin" || role === "support") {
      return await db.select().from(chats).orderBy(desc(chats.lastMessageAt));
    } else {
      return await db.select().from(chats).where(eq(chats.assignedToId, userId)).orderBy(desc(chats.lastMessageAt));
    }
  }

  async createChat(chat: InsertChat): Promise<Chat> {
    const [newChat] = await db.insert(chats).values(chat).returning();
    return newChat;
  }

  async updateChat(id: number, updates: Partial<Chat>): Promise<Chat> {
    const [updatedChat] = await db.update(chats).set(updates).where(eq(chats.id, id)).returning();
    return updatedChat;
  }

  async createMessage(chatId: number, senderId: number | null, senderType: string, content: string): Promise<Message> {
    const [message] = await db.insert(messages).values({
      chatId,
      senderId,
      senderType,
      content,
    }).returning();

    // Update chat last message
    await db.update(chats).set({
      lastMessage: content,
      lastMessageAt: new Date(),
      unreadCount: sql`unread_count + 1`
    }).where(eq(chats.id, chatId));

    return message;
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

  // Stats
  async getStats(): Promise<any> {
    const allOrders = await db.select().from(orders);
    const allChats = await db.select().from(chats);
    
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
      pending: allOrders.filter(o => o.status === 'pending').length,
      working: allOrders.filter(o => o.status === 'working').length,
      ready: allOrders.filter(o => o.status === 'ready').length,
      delivered: allOrders.filter(o => o.status === 'delivered').length,
    };

    const totalRevenue = allOrders.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0);
    const pendingPayments = allOrders.reduce((acc, curr) => acc + ((curr.totalPrice || 0) - (curr.amountPaid || 0)), 0);

    const chatStats = {
      new: allChats.filter(c => c.status === 'new').length,
      active: allChats.filter(c => c.status !== 'satisfied').length,
    };

    return {
      orders: orderStats,
      finance: {
        totalRevenue,
        monthlyRevenue: monthlyOrders.reduce((acc, curr) => acc + (curr.amountPaid || 0), 0),
        pendingPayments,
      },
      chats: chatStats
    };
  }
}

export const storage = new DatabaseStorage();
