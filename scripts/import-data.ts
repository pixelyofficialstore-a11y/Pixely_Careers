import pg from "pg";

const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function importData() {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Import users
    console.log('Importing users...');
    await client.query(`
      INSERT INTO users (id, username, password, role, name, title, avatar, is_active, created_at) VALUES
      (1, 'admin', 'a182d225c93f4940eea55b1bb62e64ba0722de29d85688e13bad3ea38aa4e1cc87d8e12b249ef6fa36ae7a9c7c1459ad1ebe22911f1e2ea6a1d84a1079ba3c6d.7747eb8da402070dcc6d42cae4b4d50f', 'admin', 'Admin User', 'Agency Owner', 'https://github.com/shadcn.png', true, '2026-02-02 19:33:31.029593'),
      (2, 'support', '270120305a9c53887d2890cee2a54c320806063e56ebda43ed1e764cd3ab3e440bce654cfe56679bb49a33a287631866d6c4af284828399fd7dee25daae3e21c.532e12676e9ef9a8e13e42c98829f46b', 'support', 'Support Agent', 'Customer Success', 'https://github.com/shadcn.png', true, '2026-02-02 19:33:31.082328'),
      (3, 'designer', '1f7f5d3ac8bd467f8882fcea566ef6a3f4e85fce73ee63990631c55893b282cdfdacef055980bbe86818b1f827f0ef223aa22ddd883ff89b91b80fd0ab5c22dc.58f01692a8451aeb66ef88231057f6e8', 'designer', 'Alex Designer', 'Senior Graphic Designer', 'https://github.com/shadcn.png', true, '2026-02-02 19:33:31.138566'),
      (4, 'designer2', '0dfc6a7b867f86dbbfddb2f2cd00c1cd945aaae59f6f26296f3cf190de6754089f5abff00b1fec6869aa1327da84e51a98627de6ecd59ef4fdf31154afd86689.6361ef9023d6743ac3d74404c07dc9c3', 'designer', 'Maria Chen', 'CV Specialist', 'https://github.com/shadcn.png', true, '2026-02-02 19:33:31.208938'),
      (5, 'designer3', 'cb09b3053bd275203d11dddd804f818cbe70f325c1eb898a4b1e825c028a8bc5a0ddb9c92fe181060b8bb59fcfdf0bf917cbb0c517a10420a885de80b570339d.0f92dce66344deca11dc97ab4a75b8eb', 'designer', 'Zain Ahmed', 'LinkedIn Expert', 'https://github.com/shadcn.png', true, '2026-02-02 19:33:31.268007')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Import orders
    console.log('Importing orders...');
    await client.query(`
      INSERT INTO orders (id, order_number, client_name, client_phone, client_email, status, priority, assigned_to_id, ready_date, payment_status, advance_payment_status, intended_designer_id, total_price, advance_amount, remaining_amount, campaign, ad_set, creative, notes, internal_notes, linked_chat_id, created_by_id, created_at) VALUES
      (1, 'PX-2602-001', 'Banee Pasth', '+92 300 1234567', NULL, 'working', 'normal', 3, NULL, 'pending', 'pending', NULL, 1500000, 1000000, 500000, NULL, NULL, NULL, NULL, NULL, NULL, 1, '2026-02-02 19:33:31.144678'),
      (2, 'PX-2602-002', 'John Doe', '+92 333 9876543', NULL, 'new', 'high', NULL, NULL, 'pending', 'pending', NULL, 2000000, 0, 2000000, NULL, NULL, NULL, NULL, NULL, NULL, 2, '2026-02-02 19:33:31.155292')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Import order_services
    console.log('Importing order_services...');
    await client.query(`
      INSERT INTO order_services (id, order_id, service_type, quantity, instructions, status) VALUES
      (1, 1, 'ATS CV', 1, 'Professional CV for Tech industry', 'new'),
      (2, 2, 'LinkedIn Profile', 1, 'Full profile revamp', 'new')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Import chats
    console.log('Importing chats...');
    await client.query(`
      INSERT INTO chats (id, client_name, client_phone, platform, status, assigned_to_id, linked_order_id, external_chat_id, last_message, last_message_at, unread_count, tags, is_internal, created_at) VALUES
      (1, 'Banee Pasth', '+1234567890', 'whatsapp', 'changes', 3, NULL, NULL, 'Can you update the header?', '2026-02-02 19:33:31.286', 2, '["Changes", "Urgent"]', false, '2026-02-02 19:33:31.271625'),
      (2, '+923001234567', '+923001234567', 'whatsapp', 'new', 4, NULL, NULL, 'I''m interested in your services.', '2026-02-02 19:33:31.299', 1, '["New"]', false, '2026-02-02 19:33:31.293571'),
      (3, 'Ali Khan', '+923009876543', 'whatsapp', 'satisfied', 4, NULL, NULL, 'Thank you, looks great!', '2026-02-02 19:33:31.311', 1, '["Satisfied"]', false, '2026-02-02 19:33:31.305477'),
      (4, 'Sara Malik', '+923331234567', 'whatsapp', 'new', 5, NULL, NULL, 'Need urgent CV update', '2026-02-02 19:33:31.323', 1, '["Issues"]', false, '2026-02-02 19:33:31.317942')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Import messages
    console.log('Importing messages...');
    await client.query(`
      INSERT INTO messages (id, chat_id, sender_type, sender_id, message_type, content, file_url, file_name, file_meta, external_message_id, is_read, created_at) VALUES
      (1, 1, 'client', NULL, 'text', 'Hi, I need some changes.', NULL, NULL, NULL, NULL, false, '2026-02-02 19:33:31.275949'),
      (2, 1, 'client', NULL, 'text', 'Can you update the header?', NULL, NULL, NULL, NULL, false, '2026-02-02 19:33:31.284191'),
      (3, 2, 'client', NULL, 'text', 'I''m interested in your services.', NULL, NULL, NULL, NULL, false, '2026-02-02 19:33:31.297047'),
      (4, 3, 'client', NULL, 'text', 'Thank you, looks great!', NULL, NULL, NULL, NULL, false, '2026-02-02 19:33:31.308617'),
      (5, 4, 'client', NULL, 'text', 'Need urgent CV update', NULL, NULL, NULL, NULL, false, '2026-02-02 19:33:31.32125')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Import message_shortcuts
    console.log('Importing message_shortcuts...');
    await client.query(`
      INSERT INTO message_shortcuts (id, command, content, created_by_id, is_active, created_at) VALUES
      (1, 'payment', 'Thank you for your order! Please complete the payment to proceed. You can send the payment to our JazzCash/Easypaisa account: 0300-1234567.', NULL, true, '2026-02-02 19:33:31.332399'),
      (2, 'ready', 'Great news! Your order is ready. Please review the attached files and let us know if you need any changes.', NULL, true, '2026-02-02 19:33:31.335878'),
      (3, 'thanks', 'Thank you for choosing Pixely Careers! We appreciate your business. Please don''t hesitate to reach out if you need anything else.', NULL, true, '2026-02-02 19:33:31.339758'),
      (4, 'changes', 'We''ve received your change request and will work on it shortly. Please allow 24-48 hours for the revisions.', NULL, true, '2026-02-02 19:33:31.342284'),
      (5, 'welcome', 'Welcome to Pixely Careers! I''m here to assist you with our CV and LinkedIn optimization services. How can I help you today?', NULL, true, '2026-02-02 19:33:31.34519'),
      (6, 'followup', 'Hi! Just following up on your order. Is there anything you''d like us to update or any questions we can answer?', NULL, true, '2026-02-02 19:33:31.347828')
      ON CONFLICT (id) DO NOTHING
    `);
    
    // Reset sequences
    console.log('Resetting sequences...');
    await client.query(`SELECT setval('users_id_seq', (SELECT MAX(id) FROM users))`);
    await client.query(`SELECT setval('orders_id_seq', (SELECT MAX(id) FROM orders))`);
    await client.query(`SELECT setval('order_services_id_seq', (SELECT MAX(id) FROM order_services))`);
    await client.query(`SELECT setval('chats_id_seq', (SELECT MAX(id) FROM chats))`);
    await client.query(`SELECT setval('messages_id_seq', (SELECT MAX(id) FROM messages))`);
    await client.query(`SELECT setval('message_shortcuts_id_seq', (SELECT MAX(id) FROM message_shortcuts))`);
    
    await client.query('COMMIT');
    console.log('Data import completed successfully!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error importing data:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

importData();
