import { db, pool } from "./db";
import { users, orders, orderServices, chats, messages, notifications, messageShortcuts, paymentVerifications } from "@shared/schema";
import { eq } from "drizzle-orm";

export async function seedDatabase() {
  const existingUsers = await db.select().from(users).limit(1);
  
  if (existingUsers.length > 0) {
    const firstUser = existingUsers[0];
    if (firstUser.username === "Muhammad Hamza" || firstUser.username === "Soban Masood") {
      console.log("Database already has production data, skipping seed.");
      return;
    }
  }
  
  console.log("Seeding database with production data...");
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    await client.query('DELETE FROM payment_verifications');
    await client.query('DELETE FROM notifications');
    await client.query('DELETE FROM messages');
    await client.query('DELETE FROM message_shortcuts');
    await client.query('DELETE FROM chats');
    await client.query('DELETE FROM order_services');
    await client.query('DELETE FROM orders');
    await client.query('DELETE FROM users');
    
    // Insert users
    await client.query(`
      INSERT INTO users (id, username, password, role, name, title, avatar, is_active, created_at) VALUES
      (1, 'Muhammad Hamza', '92c7b8dfd7bc68730e01793811d40bf253504f3a9194ebe230de8943f44202813cf4c06ca5c9ef1eaa98d864dec9088b704a621f572db95932093547b42d7f4b.ce73c1ca8158d40ce2799358033e330d', 'designer', 'Muhammad Hamza', 'Junior Graphic Designer', NULL, true, '2026-01-26T16:40:34.582Z'),
      (2, 'Husnain Atta', '93bf8f11824d290764e22035b6075e0a51c6acfa1673bddf11935823a66ee0c066085b3ea15bc9e0d93d923492793162e6263ac695d7b31046110fb701b72899.c2baa28b7ccf0314bf7a1667fd4d1a93', 'support', 'Support Agent', 'Customer Success', NULL, true, '2026-01-26T16:40:34.691Z'),
      (3, 'Muhammad Anas', '26f09d3f9258d872d5d79b7b50cc0d82301a1d7ab201149d78624b9adf9550691f31a27890f42aac10d3f6957e680cb9be1184dd954791091d99f05e3122f619.a268de57b0ecf24e64aab6f0bb6a8a0d', 'designer', 'Muhammad Anas', 'Senior Graphic Designer', '/api/avatars/avatar-3-1770038999542.jpeg', true, '2026-01-26T16:40:34.799Z'),
      (4, 'Soban Masood', 'fd09ed74854c0d214a41262b912e8c06121ab6ef20c9da9439c183a8d5a2abc43dda4d28d8c8d5559a71477938b075f19ffd1666330fca93011392927e9feac1.99750c95fe169d4ac48e59746218607a', 'admin', 'Soban Masood', 'Agency Owner', NULL, true, '2026-01-31T18:10:32.800Z'),
      (5, 'Safwan Masood', 'f9d6bc4cb41c1e4e0a490091d125af3d8b3016cdf8407efcef21647d43437454201a31291149e5b8e687fcc5c4de061bbcde7620ec0fd6aa7c043ad42517d247.e7c1e3529ebd747855d645063c83fc53', 'designer', 'Safwan Masood', NULL, NULL, true, '2026-02-01T19:26:44.553Z')
    `);
    
    // Insert orders
    await client.query(`
      INSERT INTO orders (id, order_number, client_name, client_phone, client_email, status, priority, assigned_to_id, ready_date, payment_status, advance_payment_status, intended_designer_id, total_price, advance_amount, remaining_amount, campaign, ad_set, creative, notes, internal_notes, linked_chat_id, created_by_id, created_at) VALUES
      (3, 'PX-2602-001', 'Sajid Rauf', '+92 302 1015887', NULL, 'delivered', 'normal', 3, '2026-02-02T14:22:34.514Z', 'paid', 'approved', NULL, 200000, 200000, 0, 'C1', 'AS02', 'CR05', NULL, NULL, NULL, 2, '2026-02-01T17:17:43.308Z'),
      (4, 'PX-2602-002', 'Saqib Farhat Ali', '+92 333 2114078', NULL, 'new', 'normal', 1, '2026-02-01T18:02:36.192Z', 'pending', 'approved', NULL, 170000, 70000, 100000, 'C1', 'AS02', 'CR05', NULL, NULL, NULL, 2, '2026-02-01T17:34:56.537Z'),
      (5, 'PX-2602-003', 'Saqib ur rahman', '+92 345 6143736', NULL, 'delivered', 'normal', 3, NULL, 'paid', 'approved', NULL, 170000, 170000, 0, NULL, NULL, NULL, NULL, NULL, NULL, 2, '2026-02-01T19:22:23.685Z'),
      (6, 'PX-2602-004', 'Shahzaib', '+92 300 0786108', NULL, 'delivered', 'normal', 5, NULL, 'paid', 'approved', NULL, 150000, 150000, 0, 'C2', 'AS02', 'CR06', NULL, NULL, NULL, 2, '2026-02-01T19:33:13.828Z')
    `);
    
    // Insert order_services
    await client.query(`
      INSERT INTO order_services (id, order_id, service_type, quantity, instructions, status) VALUES
      (1, 3, 'ATS CV', 1, NULL, 'new'),
      (2, 3, 'LinkedIn Profile', 1, NULL, 'new'),
      (3, 3, 'Cover Letter (Professional)', 1, NULL, 'new'),
      (4, 4, 'ATS CV', 1, NULL, 'new'),
      (5, 4, 'LinkedIn Profile', 1, NULL, 'new'),
      (6, 4, 'Cover Letter (Professional)', 1, NULL, 'new'),
      (7, 5, 'ATS CV', 1, NULL, 'new'),
      (8, 5, 'LinkedIn Profile', 1, NULL, 'new'),
      (9, 5, 'Cover Letter (Professional)', 1, NULL, 'new'),
      (10, 6, 'ATS CV', 1, NULL, 'new'),
      (11, 6, 'Cover Letter (Professional)', 1, NULL, 'new')
    `);
    
    // Insert chats
    await client.query(`
      INSERT INTO chats (id, client_name, client_phone, platform, status, assigned_to_id, linked_order_id, external_chat_id, last_message, last_message_at, unread_count, tags, is_internal, created_at) VALUES
      (1, 'Banee Pasth', '+1234567890', 'whatsapp', 'changes', 3, NULL, NULL, 'yes', '2026-02-01T09:34:33.008Z', 5, '["Changes","Urgent"]', false, '2026-01-31T17:47:03.723Z'),
      (2, 'New Lead', '+987654321', 'whatsapp', 'new', NULL, NULL, NULL, 'I''m interested in your services.', '2026-01-26T16:40:35.080Z', 2, '["New"]', false, '2026-01-31T17:47:03.723Z')
    `);
    
    // Insert messages
    await client.query(`
      INSERT INTO messages (id, chat_id, sender_type, sender_id, message_type, content, file_url, file_name, file_meta, external_message_id, is_read, created_at) VALUES
      (1, 1, 'client', NULL, 'text', 'Hi, I need some changes.', NULL, NULL, NULL, NULL, false, '2026-01-26T16:40:34.949Z'),
      (2, 1, 'client', NULL, 'text', 'Can you update the header?', NULL, NULL, NULL, NULL, false, '2026-01-26T16:40:35.001Z'),
      (3, 2, 'client', NULL, 'text', 'I''m interested in your services.', NULL, NULL, NULL, NULL, false, '2026-01-26T16:40:35.067Z'),
      (4, 1, 'user', 3, 'text', 'yes', NULL, NULL, NULL, NULL, false, '2026-02-01T09:34:32.936Z')
    `);
    
    // Insert notifications
    await client.query(`
      INSERT INTO notifications (id, user_id, type, message, read, related_id, related_type, created_at) VALUES
      (1, 3, 'assignment', 'New order assigned: PX-2602-003', false, 3, 'order', '2026-02-01T17:17:43.419Z'),
      (2, 1, 'assignment', 'New order assigned: PX-2602-004', false, 4, 'order', '2026-02-01T17:34:56.643Z'),
      (3, 3, 'assignment', 'New order assigned: PX-2602-003', false, 5, 'order', '2026-02-01T19:22:23.790Z'),
      (4, 5, 'assignment', 'New order assigned: PX-2602-004', false, 6, 'order', '2026-02-01T19:33:13.907Z')
    `);
    
    // Insert payment_verifications
    await client.query(`
      INSERT INTO payment_verifications (id, order_id, payment_type, amount, screenshot_url, submitted_by_id, status, reviewed_by_id, reviewed_at, notes, created_at) VALUES
      (2, 3, 'remaining', 100000, '/api/payment-files/1770053317494-9ugwtewkk.jpg', 3, 'approved', 4, '2026-02-02T17:36:01.426Z', '', '2026-02-02T17:28:37.567Z')
    `);
    
    // Insert message_shortcuts
    await client.query(`
      INSERT INTO message_shortcuts (id, command, content, created_by_id, is_active, created_at) VALUES
      (1, 'payment', 'Thank you for your order! Please complete the payment to proceed. You can send the payment to our JazzCash/Easypaisa account: 0300-1234567.', NULL, true, NOW()),
      (2, 'ready', 'Great news! Your order is ready. Please review the attached files and let us know if you need any changes.', NULL, true, NOW()),
      (3, 'thanks', 'Thank you for choosing Pixely Careers! We appreciate your business. Please don''t hesitate to reach out if you need anything else.', NULL, true, NOW()),
      (4, 'changes', 'We''ve received your change request and will work on it shortly. Please allow 24-48 hours for the revisions.', NULL, true, NOW()),
      (5, 'welcome', 'Welcome to Pixely Careers! I''m here to assist you with our CV and LinkedIn optimization services. How can I help you today?', NULL, true, NOW()),
      (6, 'followup', 'Hi! Just following up on your order. Is there anything you''d like us to update or any questions we can answer?', NULL, true, NOW())
    `);
    
    // Reset sequences
    await client.query(`SELECT setval('users_id_seq', COALESCE((SELECT MAX(id) FROM users), 1))`);
    await client.query(`SELECT setval('orders_id_seq', COALESCE((SELECT MAX(id) FROM orders), 1))`);
    await client.query(`SELECT setval('order_services_id_seq', COALESCE((SELECT MAX(id) FROM order_services), 1))`);
    await client.query(`SELECT setval('chats_id_seq', COALESCE((SELECT MAX(id) FROM chats), 1))`);
    await client.query(`SELECT setval('messages_id_seq', COALESCE((SELECT MAX(id) FROM messages), 1))`);
    await client.query(`SELECT setval('notifications_id_seq', COALESCE((SELECT MAX(id) FROM notifications), 1))`);
    await client.query(`SELECT setval('message_shortcuts_id_seq', COALESCE((SELECT MAX(id) FROM message_shortcuts), 1))`);
    await client.query(`SELECT setval('payment_verifications_id_seq', COALESCE((SELECT MAX(id) FROM payment_verifications), 1))`);
    
    await client.query('COMMIT');
    console.log("Database seeded with production data successfully!");
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error seeding database:", error);
    throw error;
  } finally {
    client.release();
  }
}
