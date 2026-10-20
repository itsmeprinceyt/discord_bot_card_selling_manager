# Discord Bot Card Selling Manager

A full-stack dashboard for managing card selling queues, buyers, and trades within Discord communities. Built to streamline order tracking and provide accurate queue management.

**Live Demo:** [discordbotcardsellingmanager.vercel.app](https://discordbotcardsellingmanager.vercel.app)

---

## Overview

This application serves as a management interface for Discord card selling operations. It supports multiple game accounts (SOFI and KARUTA), allowing users to handle orders, track buyers, manage trade sheets, and review activity logs from a single dashboard.

---

## Features

- **Multi-Account Management** - Create and manage multiple game accounts under a single user profile. Each account maintains its own isolated data set including cards, buyers, and orders.
- **Order Queue System** - Add orders with automatic queue positioning. Track waiting, completed, and cancelled orders with real-time position updates.
- **Bulk Import** - Paste raw Discord messages to extract card codes and import multiple orders simultaneously. Includes a cleaning tool to format messy data.
- **Trade Sheet** - View all active first-position orders grouped by buyer. Copy formatted lists for Discord, filter by currency, and mark trades as complete.
- **Completed History** - Review completed orders with options to undo, toggle deleted status, and search through historical data.
- **Activity Logs** - Comprehensive audit trail tracking all actions performed on an account including creates, updates, deletes, and order status changes.
- **Admin Panel** - Secure invite-code based registration system, user statistics, and system-wide audit logs for administrators.

---

## Tech Stack

| Layer          | Technology                 |
| -------------- | -------------------------- |
| Framework      | Next.js (App Router)       |
| Language       | TypeScript                 |
| Styling        | Tailwind CSS               |
| Database       | MySQL                      |
| Authentication | NextAuth.js (Google OAuth) |
| HTTP Client    | Axios                      |
| Icons          | Lucide React               |
| Notifications  | React Hot Toast            |

---

## Getting Started

### Prerequisites

- Node.js v18 or higher
- MySQL database
- Google OAuth credentials

### Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/discord_bot_card_selling_manager.git
cd discord_bot_card_selling_manager
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

Create a `.env.local` file in the root directory:

```env
umm
```

4. Initialize the database:

Just run the server. It'll run the migration automatically

5. Start the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
src/
├── app/
│   ├── api/                    # Backend API routes
│   │   ├── auth/               # NextAuth configuration
│   │   ├── admin/              # Admin-only endpoints
│   │   └── dashboard/          # Account-specific endpoints
│   ├── dashboard/              # Main application pages
│   │   ├── [accountId]/        # Dynamic account routes
│   │   │   ├── add-order/
│   │   │   ├── bulk-import/
│   │   │   ├── buyers/
│   │   │   ├── cards/
│   │   │   ├── completed/
│   │   │   └── trade-sheet/
│   │   └── page.tsx            # Account selection
│   ├── admin/                  # Admin panel pages
│   └── login/                  # Authentication page
├── components/                 # Shared UI components
├── lib/
│   └── Database/               # MySQL connection pool
├── utils/                      # Utility functions
└── types/                      # TypeScript definitions
```

---

## Key Functionality

### Order Flow

1. Users add orders via manual entry or bulk import
2. System validates card codes and creates buyers if new
3. Orders receive queue positions based on existing waitlist
4. Position #1 orders appear on the trade sheet for processing
5. Marking an order complete cancels remaining waitlisted orders for that card

### Queue Position Logic

- Each card has its own independent queue
- Buyers can only have one active order per card
- Cancelled orders can be reactivated with new queue positions
- Traded cards cannot accept new orders

### Automatic Cleanup

Completed orders older than 6 months are automatically removed from the database to maintain performance.

---

## Security

- All API routes require valid authentication
- Account ownership is verified on every request
- Admin routes enforce role-based access control
- Invite codes are single-use and rotate after registration

---

## License

This project is for personal use. Contact the repository owner for licensing inquiries.

## Live Demo

https://discordbotcardsellingmanager.vercel.app
