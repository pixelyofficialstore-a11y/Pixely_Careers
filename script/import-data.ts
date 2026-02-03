import { db } from "../server/db";
import { users, orders, orderServices, chats, messages, notifications, paymentVerifications } from "../shared/schema";
import { sql } from "drizzle-orm";
import fs from "fs";

async function importData() {
  console.log("Starting data import...");

  const usersData = JSON.parse(fs.readFileSync("/tmp/db_import/users.json", "utf-8"));
  const ordersData = JSON.parse(fs.readFileSync("/tmp/db_import/orders (1).json", "utf-8"));
  const orderServicesData = JSON.parse(fs.readFileSync("/tmp/db_import/order_services.json", "utf-8"));
  const chatsData = JSON.parse(fs.readFileSync("/tmp/db_import/chats.json", "utf-8"));
  const messagesData = JSON.parse(fs.readFileSync("/tmp/db_import/messages.json", "utf-8"));
  const notificationsData = JSON.parse(fs.readFileSync("/tmp/db_import/notifications.json", "utf-8"));
  const paymentVerificationsData = JSON.parse(fs.readFileSync("/tmp/db_import/payment_verifications.json", "utf-8"));

  try {
    console.log("Clearing existing data...");
    await db.delete(paymentVerifications);
    await db.delete(notifications);
    await db.delete(messages);
    await db.delete(chats);
    await db.delete(orderServices);
    await db.delete(orders);
    await db.delete(users);

    console.log("Importing users...");
    for (const user of usersData) {
      await db.insert(users).values({
        id: user.id,
        username: user.username,
        password: user.password,
        role: user.role,
        name: user.name,
        title: user.title,
        avatar: user.avatar,
        isActive: user.is_active,
        createdAt: new Date(user.created_at),
      });
    }
    await db.execute(sql`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);

    console.log("Importing orders...");
    for (const order of ordersData) {
      await db.insert(orders).values({
        id: order.id,
        orderNumber: order.order_number,
        clientName: order.client_name,
        status: order.status,
        priority: order.priority,
        assignedToId: order.assigned_to_id,
        createdAt: new Date(order.created_at),
        clientPhone: order.client_phone,
        clientEmail: order.client_email,
        paymentStatus: order.payment_status,
        totalPrice: order.total_price,
        notes: order.notes,
        createdById: order.created_by_id,
        campaign: order.campaign,
        adSet: order.ad_set,
        creative: order.creative,
        readyDate: order.ready_date ? new Date(order.ready_date) : null,
        advanceAmount: order.advance_amount,
        remainingAmount: order.remaining_amount,
        internalNotes: order.internal_notes,
        linkedChatId: order.linked_chat_id,
        advancePaymentStatus: order.advance_payment_status,
        intendedDesignerId: order.intended_designer_id,
      });
    }
    await db.execute(sql`SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders))`);

    console.log("Importing order services...");
    for (const service of orderServicesData) {
      await db.insert(orderServices).values({
        id: service.id,
        orderId: service.order_id,
        serviceType: service.service_type,
        quantity: service.quantity,
        instructions: service.instructions,
        status: service.status,
      });
    }
    await db.execute(sql`SELECT setval('order_services_id_seq', (SELECT MAX(id) FROM order_services))`);

    console.log("Importing chats...");
    for (const chat of chatsData) {
      await db.insert(chats).values({
        id: chat.id,
        clientName: chat.client_name,
        clientPhone: chat.client_phone,
        platform: chat.platform,
        status: chat.status,
        assignedToId: chat.assigned_to_id,
        lastMessage: chat.last_message,
        lastMessageAt: chat.last_message_at ? new Date(chat.last_message_at) : null,
        unreadCount: chat.unread_count,
        tags: chat.tags,
        linkedOrderId: chat.linked_order_id,
        externalChatId: chat.external_chat_id,
        isInternal: chat.is_internal,
        createdAt: new Date(chat.created_at),
      });
    }
    await db.execute(sql`SELECT setval('chats_id_seq', (SELECT MAX(id) FROM chats))`);

    console.log("Importing messages...");
    for (const message of messagesData) {
      await db.insert(messages).values({
        id: message.id,
        chatId: message.chat_id,
        senderType: message.sender_type,
        senderId: message.sender_id,
        content: message.content,
        createdAt: new Date(message.created_at),
        messageType: message.message_type,
        fileUrl: message.file_url,
        fileName: message.file_name,
        fileMeta: message.file_meta,
        externalMessageId: message.external_message_id,
        isRead: message.is_read,
      });
    }
    await db.execute(sql`SELECT setval('messages_id_seq', (SELECT MAX(id) FROM messages))`);

    console.log("Importing notifications...");
    for (const notification of notificationsData) {
      await db.insert(notifications).values({
        id: notification.id,
        userId: notification.user_id,
        type: notification.type,
        message: notification.message,
        read: notification.read,
        relatedId: notification.related_id,
        relatedType: notification.related_type,
        createdAt: new Date(notification.created_at),
      });
    }
    await db.execute(sql`SELECT setval('notifications_id_seq', (SELECT MAX(id) FROM notifications))`);

    console.log("Importing payment verifications...");
    for (const pv of paymentVerificationsData) {
      await db.insert(paymentVerifications).values({
        id: pv.id,
        orderId: pv.order_id,
        amount: pv.amount,
        screenshotUrl: pv.screenshot_url,
        submittedById: pv.submitted_by_id,
        status: pv.status,
        reviewedById: pv.reviewed_by_id,
        reviewedAt: pv.reviewed_at ? new Date(pv.reviewed_at) : null,
        notes: pv.notes,
        createdAt: new Date(pv.created_at),
        paymentType: pv.payment_type,
      });
    }
    await db.execute(sql`SELECT setval('payment_verifications_id_seq', (SELECT MAX(id) FROM payment_verifications))`);

    console.log("Data import completed successfully!");
  } catch (error) {
    console.error("Error importing data:", error);
    throw error;
  }

  process.exit(0);
}

importData();
