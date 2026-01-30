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
- **PostgreSQL**: Primary database, connection via `DATABASE_URL` environment variable
- **connect-pg-simple**: Session storage in PostgreSQL

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

### Chats Module (January 30, 2026)
- Full chat UI implemented with chat list sidebar and messaging interface
- Tab navigation: All Chats, New (with unread count), By Designer grouping
- Search functionality to filter by client name or phone number
- Message shortcuts system with 6 default templates (type "/" to access)
- Tags support for chats: New, Changes, Satisfied, Issues
- Role-based visibility: Admin/Support see all chats, Designer sees only assigned
- WhatsApp integration ready (awaiting API credentials)
- Send messages via /api/chats/:id/messages endpoint
- File upload support via multer (10MB limit, images/PDFs/docs)
- Files stored in /uploads directory, served with authentication
- ShortcutsPage for admin to manage message templates (CRUD)
- Real-time sync via polling (5s for chats, 3s for messages)

### Finance Updates (January 30, 2026)
- Replaced single amountPaid field with advanceAmount and remainingAmount split
- Dashboard now shows: Total Collected, Monthly Collection, Monthly Remaining, Total Outstanding
- Finance fields hidden from non-admin users via API sanitization
- All monetary values stored as integers (PKR paisa) and displayed in PKR (₨)

### Key Database Tables
- **chats**: WhatsApp-ready chat records with tags, assignment, and linking to orders
- **messages**: Chat messages with file attachment support
- **message_shortcuts**: Quick message templates for support staff
- **activity_logs**: Track all changes to orders and chats (schema ready)
- **payment_verifications**: Screenshot upload and admin approval workflow (schema ready)