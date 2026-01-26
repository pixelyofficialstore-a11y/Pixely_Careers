import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { api, errorSchemas } from "@shared/routes";
import { z } from "zod";
import session from "express-session";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { type User, userRoles } from "@shared/schema";
import { db } from "./db";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // === AUTH SETUP ===
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "pixely_secret_key",
      resave: false,
      saveUninitialized: false,
      cookie: { secure: process.env.NODE_ENV === "production" },
    })
  );

  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user || !(await comparePasswords(password, user.password))) {
          return done(null, false);
        }
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id as number);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  // === AUTH ROUTES ===
  app.post(api.auth.login.path, passport.authenticate("local"), (req, res) => {
    res.json(req.user);
  });

  app.post(api.auth.logout.path, (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.json({ message: "Logged out" });
    });
  });

  app.get(api.auth.me.path, (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });

  // Middleware to check auth
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    next();
  };

  // Middleware to check role
  const requireRole = (roles: string[]) => (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    if (!roles.includes((req.user as User).role)) return res.sendStatus(403);
    next();
  };

  // === APP ROUTES ===

  // Users
  app.get(api.users.list.path, requireAuth, async (req, res) => {
    const users = await storage.getUsers();
    res.json(users);
  });

  app.post(api.users.create.path, requireRole(["admin"]), async (req, res) => {
    try {
      const input = api.users.create.input.parse(req.body);
      const hashedPassword = await hashPassword(input.password);
      const user = await storage.createUser({ ...input, password: hashedPassword });
      res.status(201).json(user);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.patch(api.users.update.path, requireRole(["admin"]), async (req, res) => {
    try {
      const userId = Number(req.params.id);
      const updates = { ...req.body };
      
      // Hash password if provided
      if (updates.password) {
        updates.password = await hashPassword(updates.password);
      }
      
      const updatedUser = await storage.updateUser(userId, updates);
      res.json(updatedUser);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  // Orders
  app.get(api.orders.list.path, requireAuth, async (req, res) => {
    const user = req.user as User;
    const orders = await storage.getOrders(user.role, user.id);
    
    // Hide finance for non-admins
    const sanitizedOrders = orders.map(o => ({
      ...o,
      totalPrice: user.role === 'admin' ? o.totalPrice : undefined,
      amountPaid: user.role === 'admin' ? o.amountPaid : undefined,
    }));

    res.json(sanitizedOrders);
  });

  app.post(api.orders.create.path, requireRole(["admin", "support"]), async (req, res) => {
    try {
      const { services, ...orderData } = req.body;
      
      // Validate services array
      if (!services || !Array.isArray(services) || services.length === 0) {
        return res.status(400).json({ message: "At least one service is required" });
      }

      // Validate each service
      const serviceSchema = z.object({
        serviceType: z.string().min(1, "Service type is required"),
        quantity: z.number().int().min(1, "Quantity must be at least 1"),
        instructions: z.string().nullable().optional(),
      });
      
      for (const service of services) {
        serviceSchema.parse(service);
      }

      // Validate order data
      const orderSchema = z.object({
        clientName: z.string().min(1, "Client name is required"),
        clientPhone: z.string().min(1, "Phone number is required"),
        clientEmail: z.string().email().optional().nullable(),
        assignedToId: z.number().int().positive().optional().nullable(),
        paymentStatus: z.enum(["pending", "paid"]).optional(),
        totalPrice: z.number().int().optional(),
        amountPaid: z.number().int().optional(),
        campaign: z.string().optional().nullable(),
        adSet: z.string().optional().nullable(),
        creative: z.string().optional().nullable(),
        notes: z.string().optional().nullable(),
      });
      
      orderSchema.parse(orderData);
      
      const orderNumber = await storage.generateOrderNumber();
      const user = req.user as User;
      
      const order = await storage.createOrder({
        ...orderData,
        orderNumber,
        createdById: user.id,
      }, services);
      
      // Notify designer if assigned
      if (order.assignedToId) {
        await storage.createNotification(order.assignedToId, "assignment", `New order assigned: ${order.orderNumber}`, order.id, "order");
      }

      res.status(201).json(order);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.errors[0].message });
      }
      throw err;
    }
  });

  app.get(api.orders.get.path, requireAuth, async (req, res) => {
    const order = await storage.getOrder(Number(req.params.id));
    if (!order) return res.sendStatus(404);
    
    const user = req.user as User;
    if (user.role === 'designer' && order.assignedToId !== user.id) {
      return res.sendStatus(403);
    }

    // Hide finance for non-admins
    const sanitized = {
      ...order,
      totalPrice: user.role === 'admin' ? order.totalPrice : undefined,
      amountPaid: user.role === 'admin' ? order.amountPaid : undefined,
    };

    res.json(sanitized);
  });

  app.patch(api.orders.update.path, requireAuth, async (req, res) => {
    const orderId = Number(req.params.id);
    const updates = { ...req.body };
    const user = req.user as User;
    
    const existingOrder = await storage.getOrder(orderId);
    if (!existingOrder) return res.sendStatus(404);

    // Permission checks for designers
    if (user.role === 'designer') {
      if (existingOrder.assignedToId !== user.id) return res.sendStatus(403);
      
      // Designers can only update status and paymentStatus
      const allowedUpdates = ['status', 'paymentStatus'];
      const keys = Object.keys(updates);
      if (keys.some(k => !allowedUpdates.includes(k))) return res.sendStatus(403);
      
      // Enforce status change restrictions for designers
      if (updates.status) {
        const currentStatus = existingOrder.status;
        const newStatus = updates.status;
        
        // Designers can move through workflow: new→working→ready→delivered
        // Designers CANNOT cancel orders
        if (newStatus === 'canceled') {
          return res.status(403).json({ message: "Designers cannot cancel orders" });
        }
        
        const validTransitions: Record<string, string[]> = {
          'new': ['working'],
          'working': ['ready'],
          'ready': ['delivered'],
        };
        
        if (!validTransitions[currentStatus]?.includes(newStatus)) {
          return res.status(403).json({ message: "You can only change status forward: New→Working→Ready→Delivered" });
        }
      }
    }
    
    // Record readyDate when status changes to "ready"
    if (updates.status === 'ready' && existingOrder.status !== 'ready') {
      updates.readyDate = new Date();
    }

    const updatedOrder = await storage.updateOrder(orderId, updates);
    
    // Notifications
    if (updates.status === 'delivered') {
      // Notify support/admin
      // (Implementation simplified: assuming checking dashboard is enough or broadcasting later)
    }

    res.json(updatedOrder);
  });

  // Chats
  app.get(api.chats.list.path, requireAuth, async (req, res) => {
    const user = req.user as User;
    const chats = await storage.getChats(user.role, user.id);
    
    const allUsers = await storage.getUsers();
    const userMap = new Map(allUsers.map(u => [u.id, u]));
    
    const enrichedChats = chats.map(c => ({
      ...c,
      assignee: c.assignedToId ? userMap.get(c.assignedToId) : null
    }));

    res.json(enrichedChats);
  });

  app.get(api.chats.get.path, requireAuth, async (req, res) => {
    const chat = await storage.getChat(Number(req.params.id));
    if (!chat) return res.sendStatus(404);
    
    const user = req.user as User;
    if (user.role === 'designer' && chat.assignedToId !== user.id) {
      return res.sendStatus(403);
    }

    res.json(chat);
  });

  app.post(api.chats.sendMessage.path, requireAuth, async (req, res) => {
    const chatId = Number(req.params.id);
    const { content } = req.body;
    const user = req.user as User;
    
    const message = await storage.createMessage(chatId, user.id, "user", content);
    res.status(201).json(message);
  });

  // Notifications
  app.get(api.notifications.list.path, requireAuth, async (req, res) => {
    const notifs = await storage.getNotifications((req.user as User).id);
    res.json(notifs);
  });

  app.patch(api.notifications.markRead.path, requireAuth, async (req, res) => {
    const notif = await storage.markNotificationRead(Number(req.params.id));
    res.json(notif);
  });

  // Stats
  app.get(api.stats.dashboard.path, requireAuth, async (req, res) => {
    const stats = await storage.getStats();
    const user = req.user as User;

    if (user.role !== 'admin') {
      delete stats.finance;
    }
    
    res.json(stats);
  });

  // === SEED DATA ===
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingUsers = await storage.getUsers();
  if (existingUsers.length > 0) return;

  console.log("Seeding database...");

  // Create Users
  const adminPass = await hashPassword("admin123");
  const admin = await storage.createUser({
    username: "admin",
    password: adminPass,
    role: "admin",
    name: "Admin User",
    title: "Agency Owner",
    avatar: "https://github.com/shadcn.png"
  });

  const supportPass = await hashPassword("support123");
  const support = await storage.createUser({
    username: "support",
    password: supportPass,
    role: "support",
    name: "Support Agent",
    title: "Customer Success",
    avatar: "https://github.com/shadcn.png"
  });

  const designerPass = await hashPassword("designer123");
  const designer = await storage.createUser({
    username: "designer",
    password: designerPass,
    role: "designer",
    name: "Alex Designer",
    title: "Senior Graphic Designer",
    avatar: "https://github.com/shadcn.png"
  });

  // Create Orders
  await storage.createOrder({
    clientName: "Banee Pasth",
    clientPhone: "+92 300 1234567",
    status: "working",
    priority: "normal",
    assignedToId: designer.id,
    totalPrice: 1500000, // PKR 15,000
    amountPaid: 1000000, // PKR 10,000
    paymentStatus: "pending",
    orderNumber: await storage.generateOrderNumber(),
    createdById: admin.id,
  }, [{ serviceType: "ATS CV", quantity: 1, instructions: "Professional CV for Tech industry" }]);

  await storage.createOrder({
    clientName: "John Doe",
    clientPhone: "+92 333 9876543",
    status: "new",
    priority: "high",
    totalPrice: 2000000, // PKR 20,000
    amountPaid: 0,
    paymentStatus: "pending",
    orderNumber: await storage.generateOrderNumber(),
    createdById: support.id,
  }, [{ serviceType: "LinkedIn Profile", quantity: 1, instructions: "Full profile revamp" }]);

  // Create Chats
  const chat1 = await storage.createChat({
    clientName: "Banee Pasth",
    clientPhone: "+1234567890",
    platform: "whatsapp",
    status: "changes",
    assignedToId: designer.id,
    lastMessage: "Can you update the header?",
    unreadCount: 2,
    tags: ["Changes", "Urgent"]
  });

  await storage.createMessage(chat1.id, null, "client", "Hi, I need some changes.");
  await storage.createMessage(chat1.id, null, "client", "Can you update the header?");
  
  const chat2 = await storage.createChat({
    clientName: "New Lead",
    clientPhone: "+987654321",
    platform: "whatsapp",
    status: "new",
    lastMessage: "I'm interested in your services.",
    unreadCount: 1,
    tags: ["New"]
  });
  
  await storage.createMessage(chat2.id, null, "client", "I'm interested in your services.");

  console.log("Database seeded!");
}
