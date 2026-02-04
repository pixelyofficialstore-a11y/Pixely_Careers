# PixelCRM (Pixely Careers)

## Overview

PixelCRM is an internal agency management platform for Pixely Careers, designed to manage orders for ATS CV, LinkedIn optimization, and Cover Letter services. The system implements role-based access control with three user types (Admin, Support, Designer) and provides order tracking, team management, and client communication features.

The application uses a monorepo structure with a React frontend and Express backend, connected to a PostgreSQL database via Drizzle ORM.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom dark theme (slate-based colors, blue primary)
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Framework**: Express 5 on Node.js
- **Authentication**: Passport.js with local strategy, session-based auth using express-session
- **Password Hashing**: scrypt with timing-safe comparison
- **API Design**: RESTful endpoints defined in shared routes file with Zod validation schemas

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` contains all table definitions
- **Key Tables**: users, orders, order_services, chats, messages, notifications

### Role-Based Access Control
Three user roles with distinct permissions:
- **Admin**: Full access including finance, user management, all orders/chats
- **Support**: Can create/edit orders, assign designers, see payment status (no amounts)
- **Designer**: Can only view assigned orders, update delivery status, no finance visibility

### Project Structure
```
├── client/           # React frontend
│   └── src/
│       ├── components/   # UI components including shadcn/ui
│       ├── hooks/        # Custom hooks for auth, orders, users
│       ├── pages/        # Page components
│       └── lib/          # Utilities and query client
├── server/           # Express backend
│   ├── routes.ts     # API route definitions
│   ├── storage.ts    # Database operations
│   └── db.ts         # Database connection
├── shared/           # Shared code between client/server
│   ├── schema.ts     # Drizzle database schema
│   └── routes.ts     # API contract definitions
└── migrations/       # Database migrations
```

### Build System
- Development: tsx for running TypeScript directly
- Production: Custom build script using esbuild (server) and Vite (client)
- Output: `dist/` directory with bundled server and static client files

## External Dependencies

### Database
- **PostgreSQL**: Replit's built-in PostgreSQL database (Neon-backed)
- **Connection**: Uses `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage in PostgreSQL
- **Drizzle ORM**: Schema management with `npm run db:push` for migrations

### UI Libraries
- **Radix UI**: Full suite of accessible primitives (dialog, select, tabs, etc.)
- **Recharts**: Dashboard analytics charts (admin view)
- **Embla Carousel**: Carousel component
- **date-fns**: Date formatting and manipulation

### Development Tools
- **Drizzle Kit**: Database migrations via `db:push` command
- **Replit Plugins**: Runtime error overlay, cartographer, dev banner for Replit environment

### Currency
All monetary values displayed in PKR (₨), stored as integers (cents) in the database.

## Demo Credentials
- **Admin**: admin / admin123 (full access)
- **Support**: support / support123 (orders, no finance)
- **Designer**: designer / designer123 (assigned orders only)

## Recent Changes (January 2026)
- Multi-service order system implemented with line items (ATS CV, Professional CV, Europass CV, LinkedIn Profile, Cover Letters)
- Orders page with Today's/Monthly tabs and role-based visibility
- Team Management page for Admin-only user creation/editing
- Dashboard with business-focused financial metrics (Admin only)
- Dark mode UI with blue primary (#2563EB)
- Pixely Careers logo integrated
- Order status system updated to: New, Working, Ready, Delivered, Canceled
- Deadline field removed entirely; replaced with automatic readyDate tracking when status changes to Ready
- Services column now shows collapsed count "X Services" with hover tooltip showing details
- Order deletion implemented as soft delete via "Canceled" status (Admin/Support only)
- Payment status (Pending/Paid) editable by all roles (Admin, Support, Designer)
- Role-based dashboards: Designer sees only assigned orders with no finance, Support sees operational data, Admin has full access
- Designer status transitions updated: can now change New→Working→Ready→Delivered (forward only, no cancel)
- Monthly Orders tab restricted to Admin/Support only with editable status dropdowns
- Analytics page (Admin-only) with two modules:
  - Designer Performance: tracks completions based on readyDate (Working→Ready transitions)
  - Marketing Analytics: Campaign → Ad Set → Creative hierarchy breakdown

### WhatsApp Module (February 2026)
- Renamed "Chats" section to "WhatsApp" with WhatsApp icon in sidebar
- Route changed from /chats to /whatsapp; opens in same window (not new tab)
- Exact WhatsApp Web UI design with dark theme (#0b141a, #111b21, #202c33, #00a884 green accents)
- Custom chat background using decorative pattern image
- Full chat UI with chat list sidebar and messaging interface
- Tab navigation: All, New (chats tagged "New"), By Designer (assigned chats with optional designer filter)
- Designer filter dropdown in By Designer tab to filter chats by specific designer
- Create New Chat button (+) and dialog for admin/support to create chats with client name and optional phone
- Search functionality to filter by client name or phone number
- Message shortcuts system with 6 default templates (type "/" to access)
- Voice message recording: mic button starts recording with visual timer, stop/cancel options, sends as audio file
- Emoji picker: grid-based picker with 5 categories (smileys, gestures, hearts, objects, nature), 150+ emojis
- Catalog feature: database-driven catalog management (admin-only CatalogsPage at /catalogs)
  - Catalog items with name, description, price (PKR), image URL, active status, sort order
  - WhatsApp catalog dialog fetches from database and displays product images with details
  - Sends formatted message with product info when selected
- Updated tag system: New, Working, Pending, Changes, Issues, Satisfied Client
- Auto-unassign logic: When designer sets "Satisfied Client" tag, chat is automatically unassigned
- Role-based visibility: Admin/Support see all chats, Designer sees only assigned
- Order linking feature via 3-dot menu:
  - Admin/Support can link/unlink chats to orders
  - View linked order details dialog with client info, status, payment info (admin only)
  - One-click navigation to Orders page
  - Designers can view linked orders but cannot link/unlink
- Backend enforces role-based permissions:
  - Tag values validated against allowed list
  - Designers can only update tags (and auto-unassign via "Satisfied Client")
  - Support can update tags, assignments, and order linking
  - Admin has full access
- WhatsApp Cloud API fully integrated (February 2026):
  - Webhook endpoint: GET/POST /api/whatsapp/webhook for Meta verification and message receiving
  - Outbound messaging: POST /api/chats/:id/send-whatsapp sends via WhatsApp Cloud API
  - Inbound messages automatically create/update chats with proper phone number matching
  - Message types supported: text, image, audio, document, video (with type indicators)
  - External message IDs stored for tracking (externalMessageId field)
  - Required secrets: WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_ACCESS_TOKEN, WHATSAPP_VERIFY_TOKEN
- Send messages via /api/chats/:id/messages endpoint (internal storage only)
- Send WhatsApp messages via /api/chats/:id/send-whatsapp (sends to WhatsApp + stores)
- File upload support via multer (10MB limit, images/PDFs/docs)
- Files stored in /uploads directory, served with authentication
- ShortcutsPage for admin to manage message templates (CRUD)
- Real-time sync via polling (5s for chats, 3s for messages)

### Finance Updates (January 30, 2026)
- Replaced single amountPaid field with advanceAmount and remainingAmount split
- Dashboard now shows: Total Collected, Monthly Collection, Monthly Remaining, Total Outstanding
- Finance fields hidden from non-admin users via API sanitization
- All monetary values stored as integers (PKR paisa) and displayed in PKR (₨)

### Recent Updates (February 2026)
- PDF Export functionality added (Admin-only) for Orders, Designer Performance, and Marketing Analytics
- Uses jsPDF with autoTable plugin for formatted PDF reports
- Mobile navigation bar with hamburger menu, overlay sidebar, and responsive design
- Sidebar auto-closes on navigation in mobile view via onNavigate callback
- Main content area uses overflow-y-auto for scrollable pages

### Payment Verification System (February 2026)
- Full payment verification workflow implemented with role-based access
- Order creation stores intended designer but doesn't assign until payment approved
- Orders have advancePaymentStatus field: pending, approved, disapproved
- Orders have intendedDesignerId to hold designer selection before payment approval
- Payment types: advance (partial payment), full (complete payment), remaining (for designers)
- Payment approval flow:
  - Advance/Full: Assigns designer from intendedDesignerId, sets order status to "new", updates finances
  - Remaining: Adds to collected amount, reduces remaining balance
  - Designer is notified of assignment on approval
- Payment disapproval flow:
  - Advance/Full: Sets advancePaymentStatus to disapproved, cancels order
  - Remaining: Only marks payment as disapproved (order stays active)
- PaymentsPage at /payments shows all payment requests with:
  - Admin: Full view with filters (status, type, role), approve/disapprove actions
  - Support: View own submitted requests
  - Designer: View own requests, can submit remaining payment requests
- API endpoints:
  - GET /api/payment-verifications (role-filtered list)
  - POST /api/payment-verifications (create with FormData screenshot upload)
  - PATCH /api/payment-verifications/:id/approve (admin only, updates order finances)
  - PATCH /api/payment-verifications/:id/disapprove (admin only)
- Payment approval flow:
  - Advance: adds to advanceAmount, reduces remainingAmount
  - Full: sets advanceAmount to total, remainingAmount to 0, paymentStatus to paid
  - Remaining: moves remaining to advance, sets remainingAmount to 0, paymentStatus to paid
- Role-based data sanitization: non-admins only see orderNumber and clientName in payment details
- Orders table UI updates:
  - Order ID column visible to all roles (including designers)
  - Advance Payment Status ("Adv. Payment") column added (Admin/Support only, hidden from designers)
  - Designers only see orders assigned to them (unassigned orders are filtered out)
  - Payment Status column is display-only (Badge, not editable dropdown) - changes automatically based on payment approval
- Finance logic updates:
  - Order creation sets advanceAmount=0, remainingAmount=totalPrice (no finance collected until payment approved)
  - Dashboard finance calculations only include orders with advancePaymentStatus='approved'
  - Prevents unapproved orders from appearing in collected/outstanding totals
- Admin notification badge on sidebar Payments link showing pending payment request count
- Strict payment request visibility: Designer/Support only see their own submitted requests (enforced server-side)

### UX & Session Improvements (February 2026)
- Order counting logic updated: Only orders with advancePaymentStatus='approved' are included in all dashboard/order counts (daily, monthly, pending, canceled, ready, delivered)
- Date filtering added to PaymentsPage with month/day/year dropdown selectors (admin-only)
- Profile photo upload: All users can upload/update their avatar via Sidebar with endpoint POST /api/users/me/avatar
  - Avatars stored in uploads/avatars directory
  - Served via /api/avatars/:filename endpoint (public access)
- Table scrollbar UX improved with custom CSS class (table-scroll-wrapper) providing better visibility and accessibility
- Session timeout extended from 24 hours to 1 year (365 days) - users stay logged in until manual sign-out
- Admin can now see ALL orders (including non-approved/pending orders) on Orders page
- Admin can manually change Advance Payment Status (pending/approved/disapproved) via dropdown
- Admin can manually change Payment Status (pending/paid) via dropdown
- Non-admin users (Support/Designer) only see approved orders and cannot edit payment statuses
- Database migrated from Supabase to Replit's built-in PostgreSQL (February 2026)
- Today's Orders filter now strictly shows only orders created today (no active orders from previous days)

### Key Database Tables
- **chats**: WhatsApp-ready chat records with tags, assignment, and linking to orders
- **messages**: Chat messages with file attachment support
- **message_shortcuts**: Quick message templates for support staff
- **activity_logs**: Track all changes to orders and chats (schema ready)
- **payment_verifications**: Payment verification records with paymentType (advance/full/remaining), amount, screenshotUrl, status (pending_confirmation/approved/disapproved)