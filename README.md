<div align="center">
  <img src="public/ripple-logo-perspective-animated.svg" alt="RippleVMS Logo" width="300">
</div>

# RippleVMS - Volunteer Management System

A comprehensive digital platform designed to streamline volunteer coordination, shift management, and incident reporting for community organizations.

## 🌐 Live Demo

View the application: [dev.ripple-vms.com](https://dev.ripple-vms.com)

## 📋 Project Overview

RippleVMS is a volunteer management platform that helps community organizations:

- **Coordinate volunteers** across multiple zones
- **Manage shifts** with automated invitations and RSVP tracking
- **Handle incidents** with real-time dispatch and field response workflows
- **Track training** and volunteer qualifications

## 🎯 Key Features

### 👥 Volunteer Management
- Centralized volunteer roster
- Training and qualification tracking
- Availability scheduling
- Comprehensive activity history

### 📅 Shift Coordination
- Automated shift creation and invitations
- RSVP tracking and confirmation
- Smart volunteer matching
- Real-time coverage monitoring

### 🚨 Incident Management
- Standardized sighting intake (S.A.L.U.T.E. model)
- Real-time dispatch coordination
- Field verification workflow
- Community alert publication

### 🔐 Role-Based Access Control
- **Volunteer** - Attend shifts, report sightings
- **Coordinator** - Manage volunteers and shifts
- **Dispatcher** - Handle incidents and team assignments
- **Administrator** - System configuration and oversight

## 🛠️ Technology Stack

- **Frontend:** Next.js 16 (App Router) with React & TypeScript
- **Backend:** Next.js API Routes (Serverless)
- **Database:** Neon DB (Serverless Postgres)
- **ORM:** Prisma
- **Hosting:** Vercel
- **Email:** Nodemailer with SMTP

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Local Development

1. Clone the repository:
   ```bash
   git clone https://github.com/soulfshr/VMS.git
   cd VMS
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your database and email credentials
   ```

4. Push database schema:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

5. Seed the database (optional):
   ```bash
   npm run db:seed
   ```

6. Start the development server:
   ```bash
   npm run dev
   ```

7. Open [http://localhost:3000](http://localhost:3000)

## 📁 Repository Structure

```
VMS/
├── src/
│   ├── app/           # Next.js App Router pages
│   ├── components/    # React components
│   ├── lib/           # Utility libraries
│   └── types/         # TypeScript types
├── prisma/
│   ├── schema.prisma  # Database schema
│   └── seed.ts        # Seed data
├── public/            # Static assets
└── docs/              # Documentation
```

## 📖 Documentation

- **[User Guide](docs/USER_GUIDE.md)** - How to use the system
- **[Technical Architecture](Technical%20Architecture.md)** - System design and implementation

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

## 📄 License

[To be determined]

## 🙏 Built By

Developed by Honey Badger Apps for community organizations.

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
