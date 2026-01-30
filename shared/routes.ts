import { z } from "zod";
import { insertUserSchema, insertOrderSchema, insertChatSchema, insertMessageSchema, users, orders, chats, messages, notifications, messageShortcuts } from "./schema";

export const errorSchemas = {
  validation: z.object({
    message: z.string(),
    field: z.string().optional(),
  }),
  notFound: z.object({
    message: z.string(),
  }),
  internal: z.object({
    message: z.string(),
  }),
  unauthorized: z.object({
    message: z.string(),
  }),
};

export const api = {
  auth: {
    login: {
      method: "POST" as const,
      path: "/api/login",
      input: z.object({
        username: z.string(),
        password: z.string(),
      }),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
    logout: {
      method: "POST" as const,
      path: "/api/logout",
      responses: {
        200: z.object({ message: z.string() }),
      },
    },
    me: {
      method: "GET" as const,
      path: "/api/user",
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        401: errorSchemas.unauthorized,
      },
    },
  },
  users: {
    list: {
      method: "GET" as const,
      path: "/api/users",
      responses: {
        200: z.array(z.custom<typeof users.$inferSelect>()),
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/users",
      input: insertUserSchema,
      responses: {
        201: z.custom<typeof users.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/users/:id",
      input: insertUserSchema.partial(),
      responses: {
        200: z.custom<typeof users.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  orders: {
    list: {
      method: "GET" as const,
      path: "/api/orders",
      responses: {
        200: z.array(z.custom<typeof orders.$inferSelect & { assignee?: typeof users.$inferSelect | null }>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/orders/:id",
      responses: {
        200: z.custom<typeof orders.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    create: {
      method: "POST" as const,
      path: "/api/orders",
      input: insertOrderSchema,
      responses: {
        201: z.custom<typeof orders.$inferSelect>(),
        400: errorSchemas.validation,
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/orders/:id",
      input: insertOrderSchema.partial(),
      responses: {
        200: z.custom<typeof orders.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
  },
  chats: {
    list: {
      method: "GET" as const,
      path: "/api/chats",
      responses: {
        200: z.array(z.custom<typeof chats.$inferSelect & { assignee?: typeof users.$inferSelect | null }>()),
      },
    },
    get: {
      method: "GET" as const,
      path: "/api/chats/:id",
      responses: {
        200: z.custom<typeof chats.$inferSelect & { messages: (typeof messages.$inferSelect)[] }>(),
        404: errorSchemas.notFound,
      },
    },
    update: {
      method: "PATCH" as const,
      path: "/api/chats/:id",
      input: insertChatSchema.partial(),
      responses: {
        200: z.custom<typeof chats.$inferSelect>(),
        404: errorSchemas.notFound,
      },
    },
    sendMessage: {
      method: "POST" as const,
      path: "/api/chats/:id/messages",
      input: z.object({ content: z.string() }),
      responses: {
        201: z.custom<typeof messages.$inferSelect>(),
      },
    },
  },
  notifications: {
    list: {
      method: "GET" as const,
      path: "/api/notifications",
      responses: {
        200: z.array(z.custom<typeof notifications.$inferSelect>()),
      },
    },
    markRead: {
      method: "PATCH" as const,
      path: "/api/notifications/:id/read",
      responses: {
        200: z.custom<typeof notifications.$inferSelect>(),
      },
    },
  },
  stats: {
    dashboard: {
      method: "GET" as const,
      path: "/api/stats",
      responses: {
        200: z.object({
          orders: z.object({
            total: z.number(),
            pending: z.number(),
            working: z.number(),
            ready: z.number(),
            delivered: z.number(),
          }),
          finance: z.object({
            totalRevenue: z.number().optional(),
            monthlyRevenue: z.number().optional(),
            pendingPayments: z.number().optional(),
          }).optional(),
          chats: z.object({
            new: z.number(),
            active: z.number(),
          })
        }),
      },
    },
  },
  shortcuts: {
    list: {
      method: "GET" as const,
      path: "/api/shortcuts",
      responses: {
        200: z.array(z.custom<typeof messageShortcuts.$inferSelect>()),
      },
    },
  },
};

export function buildUrl(path: string, params?: Record<string, string | number>): string {
  let url = path;
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (url.includes(`:${key}`)) {
        url = url.replace(`:${key}`, String(value));
      }
    });
  }
  return url;
}
