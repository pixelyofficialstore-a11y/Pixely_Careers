# PixelCRM (Pixely Careers)

## Overview

PixelCRM is an internal agency management platform for Pixely Careers, designed to streamline the management of orders for ATS CV, LinkedIn optimization, and Cover Letter services. It features role-based access control (Admin, Support, Designer), comprehensive order tracking, team management, and client communication via a WhatsApp-integrated module. The platform aims to enhance operational efficiency, improve client communication, and provide insightful analytics for business growth.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture
The application uses a monorepo structure with a React 18 frontend (TypeScript, Wouter, TanStack React Query, shadcn/ui, Tailwind CSS) and an Express 5 backend (Node.js, Passport.js for authentication, scrypt for password hashing). Data is stored in a PostgreSQL database managed by Drizzle ORM.

### Role-Based Access Control
Three distinct roles are implemented:
- **Admin**: Full access including finance, user management, and all orders/chats.
- **Support**: Can create/edit orders, assign designers, and view payment status (excluding amounts).
- **Designer**: Limited to viewing and updating assigned orders' delivery status.

### Frontend
- **UI/UX**: Modern design using shadcn/ui components with a dark theme (slate-based with blue accents). Features a responsive design, mobile navigation, and improved table scrollbar UX.
- **Client Communication**: Integrated WhatsApp module mimics WhatsApp Web UI, offering chat list, messaging interface, message shortcuts, emoji picker, and a catalog feature.

### Backend
- **API**: RESTful endpoints with Zod validation.
- **Authentication**: Session-based authentication with extended session timeout (1 year).
- **WhatsApp Integration**: Full WhatsApp Cloud API integration for sending/receiving messages, media, and templates. Includes webhook handling, phone number formatting, message deduplication, and media file storage.

### Data Management
- **Database**: PostgreSQL, with Drizzle ORM for schema definition and migrations.
- **Key Data Models**: Users, Orders, Order Services, Chats, Messages, Notifications, Payment Verifications, Activity Logs, Message Shortcuts.
- **Financial Data**: All monetary values are stored as integers (PKR paisa) and displayed in PKR (₨), with an `advanceAmount` and `remainingAmount` split.
- **Order Flow**: Supports multi-service orders, role-based order visibility, and a comprehensive payment verification workflow. Orders are only considered active and financially relevant upon payment approval.
- **File Storage**: New uploads use Replit Object Storage (cloud-based) which persists across development and production. Legacy files stored locally in `/uploads/` folder only work in development. Object storage module located at `server/replit_integrations/object_storage/`.

### Features
- **Order Management**: Creation, editing, assignment, status tracking (New, Working, Ready, Delivered, Canceled), and soft deletion.
- **Team Management**: Admin-only user creation and editing.
- **Client Communication**: WhatsApp chat module with tagging, assignment, order linking, voice message recording/sending, chat renaming (admin/support), message deletion (admin/support), and full chat deletion with cascade (admin only). UI features include message truncation in chat list, encryption notice banner, and file/audio message display.
- **Payment Verification**: Dedicated workflow for approving/disapproving advance, full, and remaining payments with screenshot uploads. Admin has full control, while Support/Designer can submit requests.
- **Analytics & Reporting**: Admin-only dashboard with financial metrics (collected, remaining, outstanding), designer performance tracking, and marketing analytics. PDF export functionality is available for reports.

## External Dependencies

- **PostgreSQL**: Replit's built-in database (Neon-backed).
- **Drizzle ORM**: For database schema definition and migrations.
- **Radix UI**: Accessible UI primitives for components.
- **Tailwind CSS**: For styling.
- **TanStack React Query**: For server state management.
- **Wouter**: Lightweight React router.
- **Passport.js**: For authentication.
- **Recharts**: For dashboard analytics charts.
- **Embla Carousel**: For carousel components.
- **date-fns**: For date manipulation.
- **jsPDF with autoTable plugin**: For PDF report generation.
- **Multer**: For handling file uploads.
- **WhatsApp Cloud API**: For real-time WhatsApp messaging integration.