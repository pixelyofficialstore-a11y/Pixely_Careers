import type { Express, Request, Response, NextFunction } from "express";
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
import multer from "multer";
import path from "path";
import fs from "fs";
import { ObjectStorageService, registerObjectStorageRoutes, objectStorageServiceInstance } from "./replit_integrations/object_storage";
import { messages } from "@shared/schema";
import { eq } from "drizzle-orm";

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
  // Trust proxy for Replit deployments
  if (process.env.NODE_ENV === "production") {
    app.set("trust proxy", 1);
  }
  
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "pixely_secret_key",
      resave: false,
      saveUninitialized: false,
      cookie: { 
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        httpOnly: true,
        maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year - stay logged in until manual sign out
      },
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

  // Upload own profile avatar (any authenticated user)
  app.post("/api/users/me/avatar", requireAuth, async (req, res, next) => {
    // Configure multer for avatar upload (specific to avatars directory)
    const avatarsDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(avatarsDir)) {
      fs.mkdirSync(avatarsDir, { recursive: true });
    }
    
    const avatarUpload = multer({
      storage: multer.diskStorage({
        destination: avatarsDir,
        filename: (req, file, cb) => {
          const user = req.user as User;
          const ext = path.extname(file.originalname);
          cb(null, `avatar-${user.id}-${Date.now()}${ext}`);
        }
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit for avatars
      fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new Error('Invalid image type. Only JPEG, PNG, GIF, and WebP are allowed.'));
        }
      }
    }).single('avatar');
    
    avatarUpload(req, res, async (err) => {
      if (err) {
        return res.status(400).json({ error: err.message });
      }
      
      const user = req.user as User;
      const file = req.file;
      
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }
      
      // Update user avatar URL
      const avatarUrl = `/api/avatars/${file.filename}`;
      const updatedUser = await storage.updateUser(user.id, { avatar: avatarUrl });
      
      res.json(updatedUser);
    });
  });

  // Serve avatar files (public access for avatars)
  app.get('/api/avatars/:filename', (req, res) => {
    const filename = req.params.filename;
    
    // Validate filename to prevent directory traversal
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return res.sendStatus(400);
    }
    
    const filePath = path.join(process.cwd(), 'uploads', 'avatars', filename);
    if (!fs.existsSync(filePath)) {
      return res.sendStatus(404);
    }
    
    res.sendFile(filePath);
  });

  // Orders
  app.get(api.orders.list.path, requireAuth, async (req, res) => {
    const user = req.user as User;
    const orders = await storage.getOrders(user.role, user.id);
    
    // Hide finance for non-admins, but designers can see remainingAmount for their assigned orders (for submitting remaining payments)
    const sanitizedOrders = orders.map(o => ({
      ...o,
      totalPrice: user.role === 'admin' ? o.totalPrice : undefined,
      advanceAmount: user.role === 'admin' ? o.advanceAmount : undefined,
      // Designers can see remainingAmount for their assigned orders to submit remaining payments
      remainingAmount: (user.role === 'admin' || (user.role === 'designer' && o.assignedToId === user.id)) ? o.remainingAmount : undefined,
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
      
      const user = req.user as User;
      
      // Store intended designer but don't assign until payment is approved
      const intendedDesignerId = orderData.assignedToId;
      
      // Store total price but set finance amounts to 0 until payment is approved
      // Finance amounts will be updated only when payment is approved
      const totalPrice = orderData.totalPrice || 0;
      
      // Order number is NOT generated until payment is approved
      const order = await storage.createOrder({
        ...orderData,
        totalPrice: totalPrice,
        advanceAmount: 0, // No advance collected until payment approved
        remainingAmount: totalPrice, // Full amount remains until payment approved (but won't count in finance until approved)
        paymentStatus: "pending", // Will be updated automatically when payment approved
        assignedToId: null, // Don't assign until payment approved
        intendedDesignerId: intendedDesignerId || null, // Store intended designer for later assignment
        advancePaymentStatus: "pending", // Pending payment verification
        orderNumber: null, // No order number until payment is approved
        createdById: user.id,
      }, services);

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
      advanceAmount: user.role === 'admin' ? order.advanceAmount : undefined,
      remainingAmount: user.role === 'admin' ? order.remainingAmount : undefined,
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
      
      // Designers CANNOT cancel orders, but can set any other status
      if (updates.status && updates.status === 'canceled') {
        return res.status(403).json({ message: "Designers cannot cancel orders" });
      }
    }
    
    // Record readyDate when status changes to "ready"
    if (updates.status === 'ready' && existingOrder.status !== 'ready') {
      updates.readyDate = new Date();
    }

    // When payment status changes from Pending to Paid:
    // - Add remainingAmount to advanceAmount (total collected increases)
    // - Set remainingAmount to 0 (outstanding decreases)
    if (updates.paymentStatus === 'paid' && existingOrder.paymentStatus === 'pending') {
      const currentAdvance = existingOrder.advanceAmount || 0;
      const currentRemaining = existingOrder.remainingAmount || 0;
      updates.advanceAmount = currentAdvance + currentRemaining;
      updates.remainingAmount = 0;
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
  
  // Get unread chats count for sidebar badge (must be before :id route)
  app.get("/api/chats/unread-count", requireAuth, async (req, res) => {
    const user = req.user as User;
    const allChats = await storage.getChats(user.role, user.id);
    const unreadChatsCount = allChats.filter(c => (c.unreadCount || 0) > 0).length;
    res.json({ count: unreadChatsCount });
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

  // WhatsApp Chat Analytics - Admin only
  app.get("/api/whatsapp-analytics", requireRole(["admin"]), async (req, res) => {
    const analytics = await storage.getWhatsAppAnalytics();
    res.json(analytics);
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

  // Shortcuts
  app.get(api.shortcuts.list.path, requireAuth, async (req, res) => {
    const shortcuts = await storage.getShortcuts();
    res.json(shortcuts);
  });

  // Shortcuts CRUD (Admin only)
  app.post("/api/shortcuts", requireRole(["admin"]), async (req, res) => {
    const { command, content } = req.body;
    if (!command || !content) return res.status(400).json({ error: "Command and content required" });
    
    const shortcut = await storage.createShortcut({ command, content, isActive: true });
    res.status(201).json(shortcut);
  });

  app.patch("/api/shortcuts/:id", requireRole(["admin"]), async (req, res) => {
    const id = Number(req.params.id);
    const updates = req.body;
    
    const shortcut = await storage.updateShortcut(id, updates);
    if (!shortcut) return res.sendStatus(404);
    res.json(shortcut);
  });

  app.delete("/api/shortcuts/:id", requireRole(["admin"]), async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteShortcut(id);
    res.sendStatus(204);
  });

  // Catalogs
  app.get("/api/catalogs", requireAuth, async (req, res) => {
    const user = req.user as User;
    // Admin sees all catalogs, others see only active
    const catalogList = user.role === "admin" 
      ? await storage.getCatalogs()
      : await storage.getActiveCatalogs();
    res.json(catalogList);
  });

  app.post("/api/catalogs", requireRole(["admin"]), async (req, res) => {
    const user = req.user as User;
    const { name, description, price, imageUrl, isActive, sortOrder } = req.body;
    if (!name || price === undefined) return res.status(400).json({ error: "Name and price required" });
    
    const catalog = await storage.createCatalog({ 
      name, 
      description, 
      price: Number(price), 
      imageUrl, 
      isActive: isActive !== false, 
      sortOrder: sortOrder || 0,
      createdById: user.id 
    });
    res.status(201).json(catalog);
  });

  app.patch("/api/catalogs/:id", requireRole(["admin"]), async (req, res) => {
    const id = Number(req.params.id);
    const updates = req.body;
    if (updates.price !== undefined) updates.price = Number(updates.price);
    
    const catalog = await storage.updateCatalog(id, updates);
    res.json(catalog);
  });

  app.delete("/api/catalogs/:id", requireRole(["admin"]), async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteCatalog(id);
    res.sendStatus(204);
  });

  // === WHATSAPP CLOUD API INTEGRATION ===
  const WHATSAPP_API_URL = "https://graph.facebook.com/v18.0";
  const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
  const WHATSAPP_VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  // Helper function to format phone number for WhatsApp API (Pakistan format)
  function formatPhoneForWhatsApp(phone: string): string {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/[^0-9]/g, "");
    
    // Handle Pakistani numbers
    if (cleaned.startsWith("03") && cleaned.length === 11) {
      // Convert 03XX to 92XX (remove leading 0, add 92)
      cleaned = "92" + cleaned.substring(1);
    } else if (cleaned.startsWith("3") && cleaned.length === 10) {
      // Already without leading 0, add 92
      cleaned = "92" + cleaned;
    } else if (!cleaned.startsWith("92") && cleaned.length === 10) {
      // Assume Pakistani number without country code
      cleaned = "92" + cleaned;
    }
    
    return cleaned;
  }

  // Helper function to send WhatsApp message via Cloud API
  // Returns the WhatsApp message ID on success, or null on failure
  async function sendWhatsAppMessage(to: string, message: string, replyToExternalId?: string): Promise<string | null> {
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.error("WhatsApp API credentials not configured");
      return null;
    }

    try {
      const requestBody: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formatPhoneForWhatsApp(to),
        type: "text",
        text: { body: message },
      };
      
      // Add context for reply if replying to a message
      if (replyToExternalId) {
        requestBody.context = { message_id: replyToExternalId };
        console.log("Sending reply to message:", replyToExternalId);
      }
      
      const response = await fetch(
        `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("WhatsApp API error:", error);
        return null;
      }

      const result = await response.json();
      console.log("WhatsApp message sent:", result);
      // Return the message ID from WhatsApp response
      const whatsappMessageId = result.messages?.[0]?.id || null;
      return whatsappMessageId;
    } catch (error) {
      console.error("Failed to send WhatsApp message:", error);
      return null;
    }
  }
  
  // Helper function to check if a message with externalMessageId already exists
  async function messageExistsByExternalId(chatId: number, externalMessageId: string): Promise<boolean> {
    const existingMessages = await storage.getChatMessages(chatId);
    return existingMessages.some(m => m.externalMessageId === externalMessageId);
  }

  // Helper function to download media from WhatsApp and store in object storage
  async function downloadWhatsAppMedia(mediaId: string, mediaType: string): Promise<{ url: string; fileName: string; mimeType: string } | null> {
    if (!WHATSAPP_ACCESS_TOKEN) {
      console.error("WhatsApp API credentials not configured");
      return null;
    }

    try {
      // Step 1: Get media URL from WhatsApp
      const mediaInfoResponse = await fetch(
        `${WHATSAPP_API_URL}/${mediaId}`,
        {
          headers: {
            "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          },
        }
      );

      if (!mediaInfoResponse.ok) {
        const error = await mediaInfoResponse.json();
        console.error("WhatsApp media info error:", error);
        return null;
      }

      const mediaInfo = await mediaInfoResponse.json();
      const mediaUrl = mediaInfo.url;
      const mimeType = mediaInfo.mime_type || "application/octet-stream";
      console.log(`Media info for ${mediaType}: url=${mediaUrl}, mimeType=${mimeType}`);

      // Step 2: Download the actual media file
      const mediaDownloadResponse = await fetch(mediaUrl, {
        headers: {
          "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
      });

      if (!mediaDownloadResponse.ok) {
        console.error("Failed to download WhatsApp media");
        return null;
      }

      const mediaBuffer = await mediaDownloadResponse.arrayBuffer();

      // Step 3: Determine file extension based on mime type
      let extension = "bin";
      if (mimeType.includes("audio")) {
        if (mimeType.includes("ogg") || mimeType.includes("opus")) {
          extension = "ogg";
        } else if (mimeType.includes("mp3") || mimeType.includes("mpeg")) {
          extension = "mp3";
        } else if (mimeType.includes("webm")) {
          extension = "webm";
        } else {
          extension = "m4a";
        }
      } else if (mimeType.includes("image")) {
        if (mimeType.includes("png")) extension = "png";
        else if (mimeType.includes("gif")) extension = "gif";
        else if (mimeType.includes("webp")) extension = "webp";
        else extension = "jpg";
      } else if (mimeType.includes("video")) {
        if (mimeType.includes("3gpp") || mimeType.includes("3gp")) {
          extension = "3gp";
        } else if (mimeType.includes("webm")) {
          extension = "webm";
        } else {
          extension = "mp4";
        }
      } else if (mimeType.includes("pdf") || mimeType === "application/pdf") {
        extension = "pdf";
      } else if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) {
        extension = "xlsx";
      } else if (mimeType.includes("wordprocessingml") || mimeType.includes("document") || mimeType.includes("msword")) {
        extension = mimeType.includes("openxmlformats") ? "docx" : "doc";
      }
      console.log(`Determined extension: ${extension} for mimeType: ${mimeType}`);

      const fileName = `whatsapp_${mediaType}_${Date.now()}.${extension}`;
      const objectPath = `/objects/uploads/whatsapp/${fileName}`;

      // Step 4: Store in object storage with proper content type
      await objectStorageServiceInstance.uploadObject(objectPath, Buffer.from(mediaBuffer), mimeType);

      console.log(`Downloaded and stored WhatsApp media: ${objectPath}`);
      return { url: objectPath, fileName, mimeType };
    } catch (error) {
      console.error("Failed to download WhatsApp media:", error);
      return null;
    }
  }

  // Helper function to convert audio from webm to ogg using ffmpeg (WhatsApp compatible)
  async function convertAudioToOgg(inputPath: string): Promise<{ path: string; mimeType: string } | null> {
    const { exec } = await import('child_process');
    const { promisify } = await import('util');
    const execAsync = promisify(exec);
    
    // Convert to M4A/AAC for better iOS compatibility
    // WhatsApp supports: audio/aac, audio/mp4, audio/mpeg, audio/amr, audio/ogg
    const outputPath = inputPath.replace(/\.webm$/, '.m4a');
    
    try {
      // Convert to M4A with AAC codec - better iOS compatibility than OGG/Opus
      // AAC is natively supported by iOS and works well with WhatsApp
      // -vn removes video, -map_metadata -1 strips metadata
      await execAsync(`ffmpeg -i "${inputPath}" -vn -map_metadata -1 -c:a aac -b:a 64k -ac 1 -ar 44100 "${outputPath}" -y`);
      console.log(`Converted audio to M4A: ${inputPath} -> ${outputPath}`);
      
      // Verify output file exists and has content
      if (fs.existsSync(outputPath)) {
        const stats = fs.statSync(outputPath);
        console.log(`Converted file size: ${stats.size} bytes`);
        if (stats.size > 0) {
          return { path: outputPath, mimeType: 'audio/mp4' };
        }
      }
      console.error("Converted audio file is empty or missing");
      return null;
    } catch (error) {
      console.error("Failed to convert audio:", error);
      return null;
    }
  }

  // Helper function to upload media to WhatsApp and get media ID
  async function uploadMediaToWhatsApp(filePath: string, mimeType: string, fileName?: string): Promise<string | null> {
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.error("WhatsApp API credentials not configured");
      return null;
    }

    try {
      // Check if file exists
      if (!filePath || !fs.existsSync(filePath)) {
        console.error("File not found at path:", filePath);
        return null;
      }

      let actualFilePath = filePath;
      let actualMimeType = mimeType;
      let actualFileName = fileName || path.basename(filePath);
      
      // Convert webm audio to ogg for WhatsApp compatibility
      if (mimeType.includes('audio/webm')) {
        console.log("Converting webm audio to ogg for WhatsApp compatibility...");
        const converted = await convertAudioToOgg(filePath);
        if (converted) {
          actualFilePath = converted.path;
          actualMimeType = converted.mimeType;
          actualFileName = actualFileName.replace(/\.webm$/, '.ogg');
        } else {
          console.error("Audio conversion failed");
          return null;
        }
      }

      // Read file as buffer for better compatibility
      const fileBuffer = fs.readFileSync(actualFilePath);
      
      // Create a Blob from the buffer
      const fileBlob = new Blob([fileBuffer], { type: actualMimeType });
      
      // Use native FormData (available in Node 18+)
      const formData = new FormData();
      formData.append('file', fileBlob, actualFileName);
      formData.append('type', actualMimeType);
      formData.append('messaging_product', 'whatsapp');

      console.log("Uploading to WhatsApp API:", {
        url: `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/media`,
        mimeType: actualMimeType,
        fileName: actualFileName,
        fileSize: fileBuffer.length,
      });

      const response = await fetch(
        `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/media`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("WhatsApp media upload error:", error);
        return null;
      }

      const result = await response.json();
      console.log("WhatsApp media uploaded:", result);
      return result.id || null;
    } catch (error) {
      console.error("Failed to upload media to WhatsApp:", error);
      return null;
    }
  }

  // Helper function to send media message via WhatsApp
  async function sendWhatsAppMediaMessage(
    to: string, 
    mediaType: "image" | "audio" | "document" | "video",
    mediaId: string,
    caption?: string,
    filename?: string,
    isVoiceMessage?: boolean,
    replyToExternalId?: string
  ): Promise<string | null> {
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.error("WhatsApp API credentials not configured");
      return null;
    }

    const formattedPhone = formatPhoneForWhatsApp(to);

    try {
      const mediaPayload: any = { id: mediaId };
      if (caption && (mediaType === "image" || mediaType === "video" || mediaType === "document")) {
        mediaPayload.caption = caption;
      }
      if (filename && mediaType === "document") {
        mediaPayload.filename = filename;
      }
      // Add voice flag for voice messages (required for mobile WhatsApp to display as voice note)
      if (mediaType === "audio" && isVoiceMessage) {
        mediaPayload.voice = true;
      }

      const requestBody: any = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: mediaType,
        [mediaType]: mediaPayload,
      };
      
      // Add context for reply if replying to a message
      if (replyToExternalId) {
        requestBody.context = { message_id: replyToExternalId };
        console.log("Sending media reply to message:", replyToExternalId);
      }
      
      console.log("WhatsApp media message request:", JSON.stringify(requestBody, null, 2));
      
      const response = await fetch(
        `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("WhatsApp media message error:", JSON.stringify(error, null, 2));
        return null;
      }

      const result = await response.json();
      console.log("WhatsApp media message sent:", result);
      return result.messages?.[0]?.id || null;
    } catch (error) {
      console.error("Failed to send WhatsApp media message:", error);
      return null;
    }
  }

  // Helper function to send WhatsApp template message
  async function sendWhatsAppTemplate(
    to: string,
    templateName: string,
    languageCode: string = "en",
    components?: any[]
  ): Promise<string | null> {
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.error("WhatsApp API credentials not configured");
      return null;
    }

    const formattedPhone = formatPhoneForWhatsApp(to);

    try {
      const templatePayload: any = {
        name: templateName,
        language: { code: languageCode },
      };
      if (components && components.length > 0) {
        templatePayload.components = components;
      }

      const response = await fetch(
        `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: formattedPhone,
            type: "template",
            template: templatePayload,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("WhatsApp template error:", error);
        return null;
      }

      const result = await response.json();
      console.log("WhatsApp template sent:", result);
      return result.messages?.[0]?.id || null;
    } catch (error) {
      console.error("Failed to send WhatsApp template:", error);
      return null;
    }
  }

  // WhatsApp Webhook Verification (GET) - Meta requires this for webhook setup
  app.get("/api/whatsapp/webhook", (req: Request, res: Response) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    console.log("WhatsApp webhook verification request:", { mode, token, challenge });

    if (mode === "subscribe" && token === WHATSAPP_VERIFY_TOKEN) {
      console.log("WhatsApp webhook verified successfully");
      res.status(200).send(challenge);
    } else {
      console.error("WhatsApp webhook verification failed");
      res.sendStatus(403);
    }
  });

  // WhatsApp Webhook for receiving messages (POST)
  app.post("/api/whatsapp/webhook", async (req: Request, res: Response) => {
    try {
      const body = req.body;
      console.log("WhatsApp webhook received:", JSON.stringify(body, null, 2));

      // Check if this is a WhatsApp message notification
      if (body.object === "whatsapp_business_account") {
        const entries = body.entry || [];
        
        for (const entry of entries) {
          const changes = entry.changes || [];
          
          for (const change of changes) {
            if (change.field === "messages") {
              const value = change.value;
              const messages = value.messages || [];
              const contacts = value.contacts || [];
              
              for (const message of messages) {
                const from = message.from; // Phone number of sender
                const messageType = message.type;
                let messageContent = "";
                let fileUrl: string | undefined;
                let fileName: string | undefined;
                let fileMimeType: string | undefined;
                
                // Check if this message is a reply to another message
                const replyToExternalId = message.context?.id;
                let replyToMessageId: number | undefined;
                if (replyToExternalId) {
                  console.log("Incoming message is a reply to:", replyToExternalId);
                }
                
                // Extract message content based on type and download media if needed
                if (messageType === "text") {
                  messageContent = message.text?.body || "";
                } else if (messageType === "image") {
                  const mediaId = message.image?.id;
                  if (mediaId) {
                    const mediaData = await downloadWhatsAppMedia(mediaId, "image");
                    if (mediaData) {
                      fileUrl = mediaData.url;
                      fileName = mediaData.fileName;
                      fileMimeType = mediaData.mimeType;
                      messageContent = message.image?.caption || "[Image received]";
                    } else {
                      messageContent = "[Image received - download failed]";
                    }
                  } else {
                    messageContent = "[Image received]";
                  }
                } else if (messageType === "audio") {
                  const mediaId = message.audio?.id;
                  if (mediaId) {
                    const mediaData = await downloadWhatsAppMedia(mediaId, "audio");
                    if (mediaData) {
                      fileUrl = mediaData.url;
                      fileName = mediaData.fileName;
                      fileMimeType = mediaData.mimeType;
                      messageContent = "[Voice message]";
                    } else {
                      messageContent = "[Voice message - download failed]";
                    }
                  } else {
                    messageContent = "[Audio message received]";
                  }
                } else if (messageType === "document") {
                  const mediaId = message.document?.id;
                  console.log(`Received document message with mediaId: ${mediaId}, filename: ${message.document?.filename}`);
                  if (mediaId) {
                    const mediaData = await downloadWhatsAppMedia(mediaId, "document");
                    console.log(`Document download result:`, mediaData);
                    if (mediaData) {
                      fileUrl = mediaData.url;
                      fileName = message.document?.filename || mediaData.fileName;
                      fileMimeType = mediaData.mimeType;
                      messageContent = message.document?.caption || `[Document: ${fileName}]`;
                    } else {
                      messageContent = "[Document received - download failed]";
                    }
                  } else {
                    messageContent = "[Document received]";
                  }
                } else if (messageType === "video") {
                  const mediaId = message.video?.id;
                  console.log(`Received video message with mediaId: ${mediaId}`);
                  if (mediaId) {
                    const mediaData = await downloadWhatsAppMedia(mediaId, "video");
                    console.log(`Video download result:`, mediaData);
                    if (mediaData) {
                      fileUrl = mediaData.url;
                      fileName = mediaData.fileName;
                      fileMimeType = mediaData.mimeType;
                      messageContent = message.video?.caption || "[Video received]";
                    } else {
                      messageContent = "[Video received - download failed]";
                    }
                  } else {
                    messageContent = "[Video received]";
                  }
                } else if (messageType === "sticker") {
                  const mediaId = message.sticker?.id;
                  if (mediaId) {
                    const mediaData = await downloadWhatsAppMedia(mediaId, "sticker");
                    if (mediaData) {
                      fileUrl = mediaData.url;
                      fileName = mediaData.fileName || "sticker.webp";
                      fileMimeType = mediaData.mimeType || "image/webp";
                      messageContent = "[Sticker]";
                    } else {
                      messageContent = "[Sticker - download failed]";
                    }
                  } else {
                    messageContent = "[Sticker]";
                  }
                } else if (messageType === "location") {
                  const location = message.location;
                  if (location) {
                    const lat = location.latitude;
                    const lng = location.longitude;
                    const name = location.name || "";
                    const address = location.address || "";
                    messageContent = JSON.stringify({
                      type: "location",
                      latitude: lat,
                      longitude: lng,
                      name: name,
                      address: address
                    });
                  } else {
                    messageContent = "[Location received]";
                  }
                } else if (messageType === "contacts") {
                  const contactsData = message.contacts;
                  if (contactsData && contactsData.length > 0) {
                    const contactInfo = contactsData.map((c: any) => ({
                      name: c.name?.formatted_name || "Unknown",
                      phones: c.phones?.map((p: any) => p.phone) || []
                    }));
                    messageContent = JSON.stringify({
                      type: "contacts",
                      contacts: contactInfo
                    });
                  } else {
                    messageContent = "[Contact received]";
                  }
                } else if (messageType === "reaction") {
                  const reaction = message.reaction;
                  console.log(`[REACTION] Received reaction webhook:`, JSON.stringify(reaction));
                  if (reaction && reaction.message_id) {
                    // Handle reaction by updating the target message
                    const targetMessageId = reaction.message_id;
                    const emoji = reaction.emoji;
                    console.log(`[REACTION] Looking for message with externalMessageId: ${targetMessageId}, emoji: ${emoji || '(removed)'}, from: ${from}`);
                    
                    // Find the message that was reacted to
                    const targetMessages = await db.select().from(messages)
                      .where(eq(messages.externalMessageId, targetMessageId))
                      .limit(1);
                    
                    console.log(`[REACTION] Found ${targetMessages.length} matching messages`);
                    
                    if (targetMessages.length > 0) {
                      const targetMsg = targetMessages[0];
                      console.log(`[REACTION] Target message id: ${targetMsg.id}, current reactions:`, JSON.stringify(targetMsg.reactions));
                      const currentReactions = (targetMsg.reactions as { emoji: string; senderPhone?: string }[] | null) || [];
                      
                      if (emoji === "") {
                        // Remove reaction (empty emoji means reaction removed)
                        const updatedReactions = currentReactions.filter(r => r.senderPhone !== from);
                        await db.update(messages)
                          .set({ reactions: updatedReactions.length > 0 ? updatedReactions : null })
                          .where(eq(messages.id, targetMsg.id));
                        console.log(`[REACTION] Removed reaction from message ${targetMessageId}, updated reactions:`, JSON.stringify(updatedReactions));
                      } else {
                        // Add or update reaction
                        const existingIndex = currentReactions.findIndex(r => r.senderPhone === from);
                        if (existingIndex >= 0) {
                          currentReactions[existingIndex].emoji = emoji;
                        } else {
                          currentReactions.push({ emoji, senderPhone: from });
                        }
                        await db.update(messages)
                          .set({ reactions: currentReactions })
                          .where(eq(messages.id, targetMsg.id));
                        console.log(`[REACTION] Added reaction ${emoji} to message ${targetMessageId}, updated reactions:`, JSON.stringify(currentReactions));
                      }
                    } else {
                      console.log(`[REACTION] WARNING: Could not find message with externalMessageId: ${targetMessageId}`);
                    }
                    // Skip creating a new message for reactions
                    continue;
                  } else {
                    console.log(`[REACTION] Invalid reaction - missing message_id`);
                    messageContent = "[Reaction]";
                  }
                } else if (messageType === "button") {
                  messageContent = message.button?.text || "[Button response]";
                } else if (messageType === "interactive") {
                  const interactive = message.interactive;
                  if (interactive?.type === "button_reply") {
                    messageContent = interactive.button_reply?.title || "[Button selected]";
                  } else if (interactive?.type === "list_reply") {
                    messageContent = interactive.list_reply?.title || "[List item selected]";
                  } else {
                    messageContent = "[Interactive response]";
                  }
                } else {
                  messageContent = `[${messageType} message received]`;
                }

                // Get contact name if available
                const contact = contacts.find((c: any) => c.wa_id === from);
                const contactName = contact?.profile?.name || `+${from}`;

                // Find or create chat for this phone number
                let chat = await storage.getChatByPhone(`+${from}`);
                
                if (!chat) {
                  // Create new chat for incoming message
                  chat = await storage.createChat({
                    clientName: contactName,
                    clientPhone: `+${from}`,
                    platform: "whatsapp",
                    status: "new",
                    lastMessage: messageContent,
                    tags: ["New"],
                  });
                  console.log("Created new chat for incoming WhatsApp message:", chat.id);
                }
                
                // Deduplication: Check if message with this ID already exists
                const isDuplicate = await messageExistsByExternalId(chat.id, message.id);
                if (isDuplicate) {
                  console.log(`Duplicate message ${message.id} ignored`);
                  continue;
                }
                
                // Resolve replyToMessageId from external ID if this is a reply
                if (replyToExternalId) {
                  const chatMessages = await storage.getChatMessages(chat.id);
                  const originalMsg = chatMessages.find(m => m.externalMessageId === replyToExternalId);
                  if (originalMsg) {
                    replyToMessageId = originalMsg.id;
                    console.log("Resolved reply to local message ID:", replyToMessageId);
                  }
                }
                
                // Update existing chat with new message
                await storage.updateChat(chat.id, {
                  lastMessage: messageContent,
                  unreadCount: (chat.unreadCount || 0) + 1,
                });

                // Store the message with file info if available
                if (fileUrl) {
                  await storage.createMessageWithFile(
                    chat.id,
                    null, // No user (incoming from client)
                    "client",
                    messageContent,
                    fileUrl,
                    fileName,
                    fileMimeType ? { type: fileMimeType } : undefined,
                    replyToMessageId // Include reply reference
                  );
                  // Update the external message ID
                  const latestMessages = await storage.getChatMessages(chat.id);
                  const latestMsg = latestMessages.find(m => m.fileUrl === fileUrl);
                  if (latestMsg) {
                    await db.update(messages).set({ externalMessageId: message.id }).where(eq(messages.id, latestMsg.id));
                  }
                } else {
                  await storage.createMessage(
                    chat.id,
                    null, // No user (incoming from client)
                    "client",
                    messageContent,
                    undefined, // No file
                    message.id, // WhatsApp message ID
                    replyToMessageId // Include reply reference
                  );
                }

                console.log(`Received WhatsApp message from ${from}: ${messageContent}`);
              }
            }
          }
        }
      }

      // Always respond with 200 to acknowledge receipt
      res.sendStatus(200);
    } catch (error) {
      console.error("Error processing WhatsApp webhook:", error);
      res.sendStatus(200); // Still return 200 to prevent retries
    }
  });

  // Zod schema for WhatsApp message sending
  const sendWhatsAppSchema = z.object({
    message: z.string().min(1, "Message cannot be empty").max(4096, "Message too long"),
    replyToMessageId: z.number().optional()
  });

  // Endpoint to send WhatsApp message (called when staff sends message in UI)
  app.post("/api/chats/:id/send-whatsapp", requireAuth, async (req: Request, res: Response) => {
    const chatId = Number(req.params.id);
    const user = req.user as User;

    // Validate request body
    const parseResult = sendWhatsAppSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }
    const { message, replyToMessageId } = parseResult.data;

    const chat = await storage.getChat(chatId);
    if (!chat) {
      return res.sendStatus(404);
    }

    // Check permissions
    if (user.role === "designer" && chat.assignedToId !== user.id) {
      return res.sendStatus(403);
    }

    if (!chat.clientPhone) {
      return res.status(400).json({ error: "Chat has no phone number for WhatsApp" });
    }

    // Get the external message ID of the message being replied to (for WhatsApp context)
    let replyToExternalId: string | undefined;
    if (replyToMessageId) {
      const originalMessage = await storage.getMessage(replyToMessageId);
      if (originalMessage?.externalMessageId) {
        replyToExternalId = originalMessage.externalMessageId;
        console.log("Reply context - original message external ID:", replyToExternalId);
      }
    }

    // Send via WhatsApp Cloud API with reply context
    const whatsappMessageId = await sendWhatsAppMessage(chat.clientPhone, message, replyToExternalId);
    
    if (!whatsappMessageId) {
      console.error("WhatsApp send failed for chat:", chatId, "to:", chat.clientPhone);
      return res.status(500).json({ error: "Failed to send WhatsApp message. Please check API credentials or try again." });
    }

    // Store the message in our database with the WhatsApp message ID
    const storedMessage = await storage.createMessage(
      chatId,
      user.id,
      "agent",
      message,
      undefined, // No file
      whatsappMessageId, // Store the WhatsApp message ID for tracking
      replyToMessageId // Store the reply reference
    );

    // Update chat's last message
    await storage.updateChat(chatId, {
      lastMessage: message,
    });

    res.json({ success: true, message: storedMessage });
  });

  // Configure multer for WhatsApp media uploads
  const whatsappUploadsDir = path.join(process.cwd(), 'uploads', 'whatsapp');
  if (!fs.existsSync(whatsappUploadsDir)) {
    fs.mkdirSync(whatsappUploadsDir, { recursive: true });
  }

  const whatsappMediaStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, whatsappUploadsDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `wa-${Date.now()}${ext}`;
      cb(null, filename);
    },
  });

  const whatsappMediaUpload = multer({
    storage: whatsappMediaStorage,
    limits: { fileSize: 16 * 1024 * 1024 }, // 16MB limit for WhatsApp media
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/amr', 'audio/aac', 'audio/webm',
        'video/mp4', 'video/3gpp', 'video/quicktime', 'video/webm', 'video/x-msvideo',
        'application/pdf', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      ];
      console.log("WhatsApp media upload filter:", { mimetype: file.mimetype, allowed: allowedTypes.includes(file.mimetype) });
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('File type not supported by WhatsApp'));
      }
    },
  });

  // Endpoint to send WhatsApp media message (image, audio, document, video)
  app.post("/api/chats/:id/send-whatsapp-media", requireAuth, whatsappMediaUpload.single('media'), async (req: Request, res: Response) => {
    const chatId = Number(req.params.id);
    const user = req.user as User;
    const { caption, mediaType, replyToMessageId } = req.body;
    const file = req.file;
    const replyToId = replyToMessageId ? Number(replyToMessageId) : undefined;

    if (!file) {
      return res.status(400).json({ error: "No media file provided" });
    }

    const chat = await storage.getChat(chatId);
    if (!chat) {
      return res.sendStatus(404);
    }

    // Check permissions
    if (user.role === "designer" && chat.assignedToId !== user.id) {
      return res.sendStatus(403);
    }

    if (!chat.clientPhone) {
      return res.status(400).json({ error: "Chat has no phone number for WhatsApp" });
    }

    // Get the external message ID for reply context
    let replyToExternalId: string | undefined;
    if (replyToId) {
      const originalMessage = await storage.getMessage(replyToId);
      if (originalMessage?.externalMessageId) {
        replyToExternalId = originalMessage.externalMessageId;
        console.log("Media reply context - original message external ID:", replyToExternalId);
      }
    }

    // Determine media type from file mimetype
    let whatsappMediaType: "image" | "audio" | "document" | "video" = "document";
    let isVoiceMessage = false;
    if (file.mimetype.startsWith('image/')) {
      whatsappMediaType = "image";
    } else if (file.mimetype.startsWith('audio/')) {
      whatsappMediaType = "audio";
      // Check if this is a voice message (voice_message in filename or webm format)
      isVoiceMessage = file.originalname.includes('voice_message') || file.mimetype.includes('webm');
    } else if (file.mimetype.startsWith('video/')) {
      whatsappMediaType = "video";
    }

    // Log file info for debugging
    console.log("Uploading media to WhatsApp:", { 
      path: file.path, 
      mimetype: file.mimetype, 
      size: file.size,
      originalname: file.originalname,
      exists: file.path ? fs.existsSync(file.path) : false
    });

    // Upload media to WhatsApp
    const mediaId = await uploadMediaToWhatsApp(file.path, file.mimetype, file.originalname);
    if (!mediaId) {
      return res.status(500).json({ error: "Failed to upload media to WhatsApp" });
    }

    // Send media via WhatsApp
    console.log("Sending media to WhatsApp:", {
      phone: chat.clientPhone,
      mediaType: whatsappMediaType,
      mediaId,
      caption,
      filename: file.originalname
    });
    
    const whatsappMessageId = await sendWhatsAppMediaMessage(
      chat.clientPhone,
      whatsappMediaType,
      mediaId,
      caption,
      file.originalname,
      isVoiceMessage,
      replyToExternalId
    );

    if (!whatsappMessageId) {
      console.error("Failed to send media message - no message ID returned");
      return res.status(500).json({ error: "Failed to send WhatsApp media message" });
    }
    
    console.log("Media message sent successfully:", whatsappMessageId);

    // Store the message in our database with file metadata
    const displayMessage = caption || `[${whatsappMediaType.charAt(0).toUpperCase() + whatsappMediaType.slice(1)} sent]`;
    const storedMessage = await storage.createMessageWithFile(
      chatId,
      user.id,
      "agent",
      displayMessage,
      `/api/whatsapp-media/${file.filename}`,
      file.originalname,
      { type: file.mimetype, size: file.size },
      replyToId
    );
    
    // Update the message with external message ID
    if (whatsappMessageId) {
      await storage.updateMessageExternalId(storedMessage.id, whatsappMessageId);
    }

    // Update chat's last message
    await storage.updateChat(chatId, {
      lastMessage: displayMessage,
    });

    res.json({ success: true, message: storedMessage });
  });

  // Zod schema for WhatsApp template sending
  const sendWhatsAppTemplateSchema = z.object({
    templateName: z.string().min(1, "Template name is required").max(512, "Template name too long"),
    languageCode: z.string().max(10).optional().default("en"),
    components: z.array(z.any()).optional()
  });

  // Endpoint to send WhatsApp template message
  app.post("/api/chats/:id/send-whatsapp-template", requireAuth, async (req: Request, res: Response) => {
    const chatId = Number(req.params.id);
    const user = req.user as User;

    // Validate request body
    const parseResult = sendWhatsAppTemplateSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: parseResult.error.errors[0]?.message || "Invalid request" });
    }
    const { templateName, languageCode, components } = parseResult.data;

    const chat = await storage.getChat(chatId);
    if (!chat) {
      return res.sendStatus(404);
    }

    // Check permissions
    if (user.role === "designer" && chat.assignedToId !== user.id) {
      return res.sendStatus(403);
    }

    if (!chat.clientPhone) {
      return res.status(400).json({ error: "Chat has no phone number for WhatsApp" });
    }

    // Send template via WhatsApp
    const whatsappMessageId = await sendWhatsAppTemplate(
      chat.clientPhone,
      templateName,
      languageCode || "en",
      components
    );

    if (!whatsappMessageId) {
      return res.status(500).json({ error: "Failed to send WhatsApp template. Make sure the template is approved." });
    }

    // Store the message in our database
    const displayMessage = `[Template: ${templateName}]`;
    const storedMessage = await storage.createMessage(
      chatId,
      user.id,
      "agent",
      displayMessage,
      undefined,
      whatsappMessageId
    );

    // Update chat's last message
    await storage.updateChat(chatId, {
      lastMessage: displayMessage,
    });

    res.json({ success: true, message: storedMessage });
  });

  // Serve WhatsApp media files
  app.get("/api/whatsapp-media/:filename", requireAuth, (req: Request, res: Response) => {
    const filename = req.params.filename as string;
    
    // Validate filename to prevent path traversal attacks
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.sendStatus(400);
    }
    
    const filePath = path.join(whatsappUploadsDir, filename);
    
    // Ensure resolved path is within the uploads directory
    const resolvedPath = path.resolve(filePath);
    if (!resolvedPath.startsWith(path.resolve(whatsappUploadsDir))) {
      return res.sendStatus(403);
    }
    
    if (!fs.existsSync(filePath)) {
      return res.sendStatus(404);
    }
    
    res.sendFile(filePath);
  });

  // Configure multer for catalog image uploads
  const catalogUploadsDir = path.join(process.cwd(), 'uploads', 'catalogs');
  if (!fs.existsSync(catalogUploadsDir)) {
    fs.mkdirSync(catalogUploadsDir, { recursive: true });
  }

  const catalogImageStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, catalogUploadsDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const filename = `catalog-${Date.now()}${ext}`;
      cb(null, filename);
    },
  });

  const catalogUpload = multer({
    storage: catalogImageStorage,
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB limit for high-quality product images
    fileFilter: (req, file, cb) => {
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Only image files are allowed'));
      }
    },
  });

  app.post("/api/catalogs/upload-image", requireRole(["admin"]), catalogUpload.single('image'), (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ error: "No image file provided" });
    }
    
    const imageUrl = `/api/catalog-images/${file.filename}`;
    res.json({ imageUrl });
  });

  // Serve catalog images
  app.get("/api/catalog-images/:filename", (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(catalogUploadsDir, filename);
    
    if (!fs.existsSync(filepath)) {
      return res.sendStatus(404);
    }
    
    res.sendFile(filepath);
  });

  // Configure multer for file uploads
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  
  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadsDir,
      filename: (req, file, cb) => {
        const uniqueName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}${path.extname(file.originalname)}`;
        cb(null, uniqueName);
      }
    }),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
    fileFilter: (req, file, cb) => {
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/3gpp',
        'audio/mpeg', 'audio/ogg', 'audio/webm', 'audio/wav', 'audio/mp4',
        'application/pdf', 
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Invalid file type'));
      }
    }
  });

  // Multer error handling middleware
  const handleMulterError = (err: Error | null, req: Request, res: Response, next: NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'File too large. Maximum size is 10MB.' });
      }
      return res.status(400).json({ error: err.message });
    } else if (err) {
      return res.status(400).json({ error: err.message || 'Invalid file upload' });
    }
    next();
  };

  // File upload for messages
  app.post("/api/chats/:id/messages/upload", requireAuth, upload.single('file'), handleMulterError, async (req: Request, res: Response) => {
    const chatId = Number(req.params.id);
    const user = req.user as User;
    
    const chat = await storage.getChat(chatId);
    if (!chat) return res.sendStatus(404);
    
    if (user.role === 'designer' && chat.assignedToId !== user.id) {
      return res.sendStatus(403);
    }
    
    const content = req.body?.content || "Sent a file";
    const file = req.file;
    const replyToMessageId = req.body?.replyToMessageId ? Number(req.body.replyToMessageId) : undefined;
    
    // Create message with file info (storage method handles chat metadata update)
    // senderType should be "agent" since it's the CRM user sending to the client
    const message = await storage.createMessageWithFile(
      chatId, 
      user.id, 
      "agent", 
      content,
      file ? `/api/files/${chatId}/${file.filename}` : undefined,
      file?.originalname,
      file ? { size: file.size, type: file.mimetype } : undefined,
      replyToMessageId
    );
    
    res.status(201).json(message);
  });

  // Secure file serving with chat-level authorization and filename validation
  app.get('/api/files/:chatId/:filename', requireAuth, async (req, res) => {
    const user = req.user as User;
    const chatId = Number(req.params.chatId);
    const filename = req.params.filename;
    
    // Verify user has access to this chat
    const chat = await storage.getChat(chatId);
    if (!chat) return res.sendStatus(404);
    
    // Role-based authorization check
    if (user.role === 'designer' && chat.assignedToId !== user.id) {
      return res.sendStatus(403);
    }
    
    // Verify this file actually belongs to a message in this chat via direct DB query
    const expectedFileUrl = `/api/files/${chatId}/${filename}`;
    const fileMessage = await storage.getMessageByFileUrl(chatId, expectedFileUrl);
    
    if (!fileMessage) {
      return res.sendStatus(404); // File not associated with this chat
    }
    
    const filePath = path.join(uploadsDir, filename);
    if (!fs.existsSync(filePath)) {
      return res.sendStatus(404);
    }
    
    res.sendFile(filePath);
  });

  // Chat messages endpoint
  app.get("/api/chats/:id/messages", requireAuth, async (req, res) => {
    const chatId = Number(req.params.id);
    const user = req.user as User;
    
    const chat = await storage.getChat(chatId);
    if (!chat) return res.sendStatus(404);
    
    if (user.role === 'designer' && chat.assignedToId !== user.id) {
      return res.sendStatus(403);
    }
    
    const messages = await storage.getChatMessages(chatId);
    res.json(messages);
  });

  // Valid chat tags
  const VALID_CHAT_TAGS = ["New", "Working", "Pending", "Changes", "Issues", "Satisfied Client"];
  
  // Update chat endpoint
  app.patch("/api/chats/:id", requireAuth, async (req, res) => {
    const chatId = Number(req.params.id);
    let updates = req.body;
    const user = req.user as User;
    
    const chat = await storage.getChat(chatId);
    if (!chat) return res.sendStatus(404);
    
    // Validate tags if provided
    if (updates.tags) {
      const tags = updates.tags as string[];
      if (!Array.isArray(tags) || tags.some(t => !VALID_CHAT_TAGS.includes(t))) {
        return res.status(400).json({ error: "Invalid tags" });
      }
    }
    
    // Designers can only update tags (and assignedToId only when setting "Satisfied Client")
    if (user.role === 'designer') {
      // Check if designer is assigned to this chat
      if (chat.assignedToId !== user.id) {
        return res.sendStatus(403);
      }
      
      const allowedUpdates = ['tags'];
      const keys = Object.keys(updates);
      
      // Allow assignedToId update only when setting "Satisfied Client" tag (auto-unassign)
      const tags = updates.tags as string[] | undefined;
      const isSatisfiedClient = tags?.includes("Satisfied Client");
      
      if (isSatisfiedClient) {
        // Force unassign when designer marks as "Satisfied Client"
        updates = { ...updates, assignedToId: null };
        allowedUpdates.push('assignedToId');
      }
      
      if (keys.some(k => !allowedUpdates.includes(k))) {
        return res.sendStatus(403);
      }
    } else if (user.role === 'support') {
      // Support can update: tags, assignedToId, linkedOrderId, isPinned
      const allowedUpdates = ['tags', 'assignedToId', 'linkedOrderId', 'isPinned'];
      const keys = Object.keys(updates);
      if (keys.some(k => !allowedUpdates.includes(k))) {
        return res.sendStatus(403);
      }
    }
    // Admin can update all fields
    
    const updated = await storage.updateChat(chatId, updates);
    res.json(updated);
  });

  // Mark chat as read (reset unread count)
  app.post("/api/chats/:id/mark-read", requireAuth, async (req, res) => {
    const chatId = Number(req.params.id);
    const chat = await storage.getChat(chatId);
    if (!chat) return res.sendStatus(404);
    
    await storage.updateChat(chatId, { unreadCount: 0 });
    res.json({ success: true });
  });

  // Note: WhatsApp Business Cloud API does NOT support deleting sent messages ("delete for everyone")
  // This is a platform limitation from Meta. Messages can only be deleted locally.
  // See: https://developers.facebook.com/docs/whatsapp/cloud-api/

  // Helper function to send reaction to a WhatsApp message
  async function sendWhatsAppReaction(
    to: string,
    messageId: string,
    emoji: string
  ): Promise<string | null> {
    if (!WHATSAPP_PHONE_NUMBER_ID || !WHATSAPP_ACCESS_TOKEN) {
      console.error("WhatsApp API credentials not configured");
      return null;
    }

    const formattedPhone = formatPhoneForWhatsApp(to);

    try {
      const requestBody = {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: formattedPhone,
        type: "reaction",
        reaction: {
          message_id: messageId,
          emoji: emoji, // Empty string to remove reaction
        },
      };

      console.log("Sending WhatsApp reaction:", JSON.stringify(requestBody, null, 2));

      const response = await fetch(
        `${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        console.error("WhatsApp reaction error:", error);
        return null;
      }

      const result = await response.json();
      console.log("WhatsApp reaction sent:", result);
      return result.messages?.[0]?.id || null;
    } catch (error) {
      console.error("Failed to send WhatsApp reaction:", error);
      return null;
    }
  }

  // Delete a message (admin/support only) - local deletion only
  // Note: WhatsApp Business API does not support "delete for everyone"
  app.delete("/api/messages/:id", requireRole(["admin", "support"]), async (req, res) => {
    const messageId = Number(req.params.id);
    
    // Get the message to check if it has a file
    const message = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (message.length === 0) {
      return res.sendStatus(404);
    }
    
    const msg = message[0];
    
    if (msg.fileUrl) {
      // Delete the file from object storage if it's stored there
      if (msg.fileUrl.startsWith("/objects/")) {
        try {
          console.log(`Deleting message with file: ${msg.fileUrl}`);
        } catch (error) {
          console.error("Error deleting file:", error);
        }
      }
    }
    
    await storage.deleteMessage(messageId);
    res.sendStatus(204);
  });

  // Send a reaction to a message
  app.post("/api/messages/:id/react", requireRole(["admin", "support"]), async (req, res) => {
    const messageId = Number(req.params.id);
    const { emoji } = req.body;
    const user = req.user as User;

    if (!emoji) {
      return res.status(400).json({ error: "Emoji is required" });
    }

    // Get the message
    const message = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (message.length === 0) {
      return res.sendStatus(404);
    }

    const msg = message[0];

    // Can only react to messages from clients that have a WhatsApp message ID
    if (!msg.externalMessageId) {
      return res.status(400).json({ error: "Cannot react to this message - no WhatsApp ID" });
    }

    // Get the chat to find the phone number
    const chat = await storage.getChat(msg.chatId);
    if (!chat || !chat.clientPhone) {
      return res.status(400).json({ error: "Chat has no phone number" });
    }

    // Send reaction to WhatsApp
    const reactionId = await sendWhatsAppReaction(chat.clientPhone, msg.externalMessageId, emoji);
    if (!reactionId) {
      return res.status(500).json({ error: "Failed to send reaction" });
    }
    
    // Store the reaction in the database
    const existingReactions = (msg.reactions as { emoji: string; senderPhone?: string }[] | null) || [];
    const newReaction = { emoji, senderPhone: "agent" };
    const updatedReactions = [...existingReactions.filter(r => r.senderPhone !== "agent"), newReaction];
    await db.update(messages).set({ reactions: updatedReactions }).where(eq(messages.id, messageId));

    res.json({ success: true, reactionId });
  });

  // Forward a message to multiple chats
  app.post("/api/messages/:id/forward", requireRole(["admin", "support"]), async (req, res) => {
    const messageId = Number(req.params.id);
    const { chatIds } = req.body as { chatIds: number[] };
    const user = req.user as User;

    if (!chatIds || !Array.isArray(chatIds) || chatIds.length === 0) {
      return res.status(400).json({ error: "At least one chat ID is required" });
    }

    // Get the original message
    const originalMessage = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    if (originalMessage.length === 0) {
      return res.sendStatus(404);
    }

    const msg = originalMessage[0];
    const results: { chatId: number; success: boolean; error?: string }[] = [];

    // Forward to each chat
    for (const targetChatId of chatIds) {
      try {
        const targetChat = await storage.getChat(targetChatId);
        if (!targetChat) {
          results.push({ chatId: targetChatId, success: false, error: "Chat not found" });
          continue;
        }

        // Create a copy of the message in the target chat (without forwarded prefix)
        const forwardedContent = msg.content;

        let newMessage;
        if (msg.messageType === "file" && msg.fileUrl) {
          newMessage = await storage.createMessageWithFile(
            targetChatId,
            user.id,
            "agent",
            forwardedContent,
            msg.fileUrl,
            msg.fileName || undefined,
            msg.fileMeta as { size?: number; type?: string } | undefined
          );
        } else {
          newMessage = await storage.createMessage(
            targetChatId,
            user.id,
            "agent",
            forwardedContent
          );
        }

        // Update the target chat's last message
        await storage.updateChat(targetChatId, {
          lastMessage: forwardedContent.substring(0, 100),
          lastMessageAt: new Date(),
        });

        // If the target chat has a WhatsApp phone, send the message via WhatsApp
        if (targetChat.clientPhone && targetChat.platform === "whatsapp") {
          const formattedPhone = formatPhoneForWhatsApp(targetChat.clientPhone);
          
          if (msg.messageType === "file" && msg.fileUrl) {
            // For files, we need to re-upload and send
            // This is a simplified version - just send a text notification
            await sendWhatsAppMessage(formattedPhone, forwardedContent);
          } else {
            // Send text message
            const waResult = await sendWhatsAppMessage(formattedPhone, msg.content);
            if (waResult) {
              await storage.updateMessageExternalId(newMessage.id, waResult);
            }
          }
        }

        results.push({ chatId: targetChatId, success: true });
      } catch (error) {
        console.error(`Failed to forward to chat ${targetChatId}:`, error);
        results.push({ chatId: targetChatId, success: false, error: "Internal error" });
      }
    }

    const successCount = results.filter(r => r.success).length;
    res.json({ 
      success: successCount > 0, 
      forwarded: successCount, 
      total: chatIds.length,
      results 
    });
  });

  // Delete a chat (any authenticated user)
  app.delete("/api/chats/:id", requireAuth, async (req, res) => {
    const chatId = Number(req.params.id);
    const chat = await storage.getChat(chatId);
    if (!chat) return res.sendStatus(404);
    
    await storage.deleteChat(chatId);
    res.sendStatus(204);
  });

  // Create a new chat
  app.post("/api/chats", requireRole(["admin", "support"]), async (req, res) => {
    const { clientName, clientPhone } = req.body;
    if (!clientName) {
      return res.status(400).json({ error: "Client name is required" });
    }
    
    // Format phone number if provided
    let formattedPhone = clientPhone;
    if (clientPhone) {
      formattedPhone = formatPhoneForWhatsApp(clientPhone);
      // Add + prefix for display
      if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+" + formattedPhone;
      }
    }
    
    const chat = await storage.createChat({
      clientName: clientName.trim(),
      clientPhone: formattedPhone || undefined,
      tags: ["New"],
    });
    
    res.status(201).json(chat);
  });

  // === PAYMENT VERIFICATIONS ===
  
  // Get count of pending payment verifications (admin only, for notification badge)
  app.get("/api/payment-verifications/pending-count", requireRole(["admin"]), async (req, res) => {
    const verifications = await storage.getPaymentVerifications("admin", 0);
    const pendingCount = verifications.filter(v => v.status === 'pending_confirmation').length;
    res.json({ count: pendingCount });
  });
  
  // Get all payment verifications (role-based filtering)
  app.get("/api/payment-verifications", requireAuth, async (req, res) => {
    const user = req.user as User;
    const verifications = await storage.getPaymentVerifications(user.role, user.id);
    
    // Add sanitized order info to each verification (only basic order details, no finance for non-admin)
    const orders = await storage.getOrders(user.role, user.id);
    const result = verifications.map(v => {
      const order = orders.find(o => o.id === v.orderId);
      // For non-admins, only expose orderNumber and clientName
      const sanitizedOrder = order ? (user.role === 'admin' ? {
        orderNumber: order.orderNumber,
        clientName: order.clientName,
        totalPrice: order.totalPrice,
      } : {
        orderNumber: order.orderNumber,
        clientName: order.clientName,
      }) : null;
      return {
        ...v,
        order: sanitizedOrder,
      };
    });
    
    res.json(result);
  });

  // Get payment verifications for a specific order
  app.get("/api/orders/:id/payment-verifications", requireAuth, async (req, res) => {
    const orderId = Number(req.params.id);
    const user = req.user as User;
    
    const order = await storage.getOrder(orderId);
    if (!order) return res.sendStatus(404);
    
    // Designers can only see verifications for their assigned orders
    if (user.role === 'designer' && order.assignedToId !== user.id) {
      return res.sendStatus(403);
    }
    
    const verifications = await storage.getPaymentVerificationsByOrder(orderId);
    res.json(verifications);
  });

  // Create a payment verification request
  app.post("/api/payment-verifications", requireAuth, upload.single('screenshot'), async (req, res) => {
    const user = req.user as User;
    const { orderId, paymentType, amount } = req.body;
    
    const order = await storage.getOrder(Number(orderId));
    if (!order) return res.status(400).json({ error: "Order not found" });
    
    // Designers can only submit for their assigned orders
    if (user.role === 'designer' && order.assignedToId !== user.id) {
      return res.status(403).json({ error: "You can only submit payment requests for assigned orders" });
    }
    
    // Support can only create at order creation (advance/full), Designer can only create remaining
    if (user.role === 'designer' && paymentType !== 'remaining') {
      return res.status(403).json({ error: "Designers can only submit remaining payment requests" });
    }
    
    // Validate amount
    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Invalid payment amount" });
    }
    
    // For remaining payments, validate that amount doesn't exceed order's remaining balance
    if (paymentType === 'remaining') {
      const orderRemaining = order.remainingAmount || 0;
      if (parsedAmount > orderRemaining) {
        return res.status(400).json({ error: `Amount exceeds remaining balance (₨${(orderRemaining / 100).toFixed(2)})` });
      }
    }
    
    // Validate paymentType
    const validPaymentTypes = ['advance', 'full', 'remaining'];
    if (!validPaymentTypes.includes(paymentType)) {
      return res.status(400).json({ error: "Invalid payment type" });
    }
    
    // Screenshot is recommended but not strictly required (to allow flexibility)
    // Upload to Object Storage for persistence across deployments
    const file = req.file;
    let screenshotUrl: string | null = null;
    
    if (file) {
      const objectPath = `payments/${Date.now()}-${file.originalname}`;
      const fileBuffer = fs.readFileSync(file.path);
      await objectStorageServiceInstance.uploadObject(objectPath, fileBuffer, file.mimetype);
      screenshotUrl = `/api/payment-files/${encodeURIComponent(objectPath.replace('payments/', ''))}`;
      // Clean up local temp file
      fs.unlinkSync(file.path);
    }
    
    const verification = await storage.createPaymentVerification({
      orderId: Number(orderId),
      paymentType,
      amount: Number(amount),
      screenshotUrl,
      submittedById: user.id,
      status: "pending_confirmation",
    });
    
    res.status(201).json(verification);
  });

  // Admin approve payment verification
  app.patch("/api/payment-verifications/:id/approve", requireAuth, async (req, res) => {
    const user = req.user as User;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: "Only admin can approve payments" });
    }
    
    const verificationId = Number(req.params.id);
    const { notes } = req.body;
    
    // Get current verification
    const verifications = await storage.getPaymentVerifications("admin", 0);
    const verification = verifications.find(v => v.id === verificationId);
    if (!verification) return res.sendStatus(404);
    
    // Update verification status
    await storage.updatePaymentVerification(verificationId, {
      status: "approved",
      reviewedById: user.id,
      reviewedAt: new Date(),
      notes,
    });
    
    // Get the order to update finances
    const order = await storage.getOrder(verification.orderId);
    if (!order) return res.sendStatus(404);
    
    // Update order finances based on payment type
    const currentAdvance = order.advanceAmount || 0;
    const currentRemaining = order.remainingAmount || 0;
    
    if (verification.paymentType === 'advance') {
      // Generate order number now that payment is approved
      const orderNumber = await storage.generateOrderNumber();
      
      // Advance payment: add to collected amount, set remaining, assign designer, set status
      const newAdvance = currentAdvance + verification.amount;
      const newRemaining = Math.max(0, (order.totalPrice || 0) - newAdvance);
      await storage.updateOrder(order.id, {
        orderNumber, // Assign order number on approval
        advanceAmount: newAdvance,
        remainingAmount: newRemaining,
        paymentStatus: newRemaining === 0 ? "paid" : "pending",
        advancePaymentStatus: "approved",
        assignedToId: order.intendedDesignerId, // Assign to intended designer
        status: "new", // Order is now active
      });
      
      // Notify designer of assignment
      if (order.intendedDesignerId) {
        await storage.createNotification(order.intendedDesignerId, "assignment", `New order assigned: ${orderNumber}`, order.id, "order");
      }
    } else if (verification.paymentType === 'full') {
      // Generate order number now that payment is approved
      const orderNumber = await storage.generateOrderNumber();
      
      // Full payment: mark as fully paid, assign designer, set status
      await storage.updateOrder(order.id, {
        orderNumber, // Assign order number on approval
        advanceAmount: order.totalPrice, // Full amount collected
        remainingAmount: 0,
        paymentStatus: "paid",
        advancePaymentStatus: "approved",
        assignedToId: order.intendedDesignerId, // Assign to intended designer
        status: "new", // Order is now active
      });
      
      // Notify designer of assignment
      if (order.intendedDesignerId) {
        await storage.createNotification(order.intendedDesignerId, "assignment", `New order assigned: ${orderNumber}`, order.id, "order");
      }
    } else if (verification.paymentType === 'remaining') {
      // Remaining payment: add remaining to collected, clear remaining
      await storage.updateOrder(order.id, {
        advanceAmount: currentAdvance + verification.amount,
        remainingAmount: Math.max(0, currentRemaining - verification.amount),
        paymentStatus: (currentRemaining - verification.amount) <= 0 ? "paid" : "pending",
      });
    }
    
    const updatedVerification = await storage.getPaymentVerifications("admin", 0);
    res.json(updatedVerification.find(v => v.id === verificationId));
  });

  // Admin disapprove payment verification
  app.patch("/api/payment-verifications/:id/disapprove", requireAuth, async (req, res) => {
    const user = req.user as User;
    if (user.role !== 'admin') {
      return res.status(403).json({ error: "Only admin can disapprove payments" });
    }
    
    const verificationId = Number(req.params.id);
    const { notes } = req.body;
    
    // Get verification to find order
    const verifications = await storage.getPaymentVerifications("admin", 0);
    const verification = verifications.find(v => v.id === verificationId);
    if (!verification) return res.sendStatus(404);
    
    // Update verification status
    await storage.updatePaymentVerification(verificationId, {
      status: "disapproved",
      reviewedById: user.id,
      reviewedAt: new Date(),
      notes,
    });
    
    // Get order and cancel it (for advance/full payments, not remaining)
    if (verification.paymentType !== 'remaining') {
      const order = await storage.getOrder(verification.orderId);
      if (order) {
        await storage.updateOrder(order.id, {
          advancePaymentStatus: "disapproved",
          status: "canceled",
        });
      }
    }
    
    const updatedVerifications = await storage.getPaymentVerifications("admin", 0);
    res.json(updatedVerifications.find(v => v.id === verificationId));
  });

  // Serve payment screenshot files (authenticated) - serves from Object Storage
  const objectStorageService = new ObjectStorageService();
  
  app.get('/api/payment-files/:filename', requireAuth, async (req, res) => {
    const filename = req.params.filename;
    const sanitized = path.basename(filename);
    
    // First check if file exists in local uploads (for backwards compatibility)
    const localFilePath = path.join(process.cwd(), 'uploads', sanitized);
    if (fs.existsSync(localFilePath)) {
      return res.sendFile(localFilePath);
    }
    
    // Try to find in object storage (using private directory where files are uploaded)
    try {
      const objectFile = await objectStorageService.getPrivateObject(`payments/${sanitized}`);
      if (objectFile) {
        await objectStorageService.downloadObject(objectFile, res);
        return;
      }
    } catch (error) {
      console.error("Error fetching from object storage:", error);
    }
    
    return res.sendStatus(404);
  });

  // Register object storage routes for new uploads
  registerObjectStorageRoutes(app);

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
    advanceAmount: 1000000, // PKR 10,000 advance
    remainingAmount: 500000, // PKR 5,000 remaining
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
    advanceAmount: 0,
    remainingAmount: 2000000,
    paymentStatus: "pending",
    orderNumber: await storage.generateOrderNumber(),
    createdById: support.id,
  }, [{ serviceType: "LinkedIn Profile", quantity: 1, instructions: "Full profile revamp" }]);

  // Create additional designers for testing "By Designer" section
  const designer2Pass = await hashPassword("designer2");
  const designer2 = await storage.createUser({
    username: "designer2",
    password: designer2Pass,
    role: "designer",
    name: "Maria Chen",
    title: "CV Specialist",
    avatar: "https://github.com/shadcn.png"
  });

  const designer3Pass = await hashPassword("designer3");
  const designer3 = await storage.createUser({
    username: "designer3",
    password: designer3Pass,
    role: "designer",
    name: "Zain Ahmed",
    title: "LinkedIn Expert",
    avatar: "https://github.com/shadcn.png"
  });

  // Create Chats
  const chat1 = await storage.createChat({
    clientName: "Banee Pasth",
    clientPhone: "+1234567890",
    platform: "whatsapp",
    status: "changes",
    assignedToId: designer.id,
    lastMessage: "Can you update the header?",
    tags: ["Changes", "Urgent"]
  });

  await storage.createMessage(chat1.id, null, "client", "Hi, I need some changes.");
  await storage.createMessage(chat1.id, null, "client", "Can you update the header?");
  
  // Update unread count directly
  await storage.updateChat(chat1.id, { unreadCount: 2 });
  
  const chat2 = await storage.createChat({
    clientName: "+923001234567",
    clientPhone: "+923001234567",
    platform: "whatsapp",
    status: "new",
    assignedToId: designer2.id,
    lastMessage: "I'm interested in your services.",
    tags: ["New"]
  });
  
  await storage.createMessage(chat2.id, null, "client", "I'm interested in your services.");
  await storage.updateChat(chat2.id, { unreadCount: 1 });
  
  // Add more chats for different designers
  const chat3 = await storage.createChat({
    clientName: "Ali Khan",
    clientPhone: "+923009876543",
    platform: "whatsapp",
    status: "satisfied",
    assignedToId: designer2.id,
    lastMessage: "Thank you, looks great!",
    tags: ["Satisfied"]
  });
  
  await storage.createMessage(chat3.id, null, "client", "Thank you, looks great!");
  
  const chat4 = await storage.createChat({
    clientName: "Sara Malik",
    clientPhone: "+923331234567",
    platform: "whatsapp",
    status: "new",
    assignedToId: designer3.id,
    lastMessage: "Need urgent CV update",
    tags: ["Issues"]
  });
  
  await storage.createMessage(chat4.id, null, "client", "Need urgent CV update");
  await storage.updateChat(chat4.id, { unreadCount: 1 });

  // Create Message Shortcuts
  await seedMessageShortcuts();

  console.log("Database seeded!");
}

async function seedMessageShortcuts() {
  const { messageShortcuts } = await import("@shared/schema");
  const existingShortcuts = await db.select().from(messageShortcuts);
  if (existingShortcuts.length > 0) return;

  const shortcuts = [
    { command: "payment", content: "Thank you for your order! Please complete the payment to proceed. You can send the payment to our JazzCash/Easypaisa account: 0300-1234567." },
    { command: "ready", content: "Great news! Your order is ready. Please review the attached files and let us know if you need any changes." },
    { command: "thanks", content: "Thank you for choosing Pixely Careers! We appreciate your business. Please don't hesitate to reach out if you need anything else." },
    { command: "changes", content: "We've received your change request and will work on it shortly. Please allow 24-48 hours for the revisions." },
    { command: "welcome", content: "Welcome to Pixely Careers! I'm here to assist you with our CV and LinkedIn optimization services. How can I help you today?" },
    { command: "followup", content: "Hi! Just following up on your order. Is there anything you'd like us to update or any questions we can answer?" },
  ];

  for (const shortcut of shortcuts) {
    await db.insert(messageShortcuts).values({
      command: shortcut.command,
      content: shortcut.content,
      isActive: true,
    });
  }
}
