# Siembra NC Volunteer Management System (VMS)

A comprehensive digital platform designed to streamline volunteer coordination, shift management, and incident reporting for Siembra NC's community safety initiatives.

## 🌐 Live Wireframes

View the interactive wireframes: [Deployed on Vercel]

## 📋 Project Overview

This repository contains the planning and design documentation for the Siembra NC VMS, including:

- **Project Proposal & Requirements** - Detailed functional requirements and system specifications
- **User Roles & Permissions** - Complete role-based access control (RBAC) documentation
- **Interactive Wireframes** - HTML mockups for all major workflows

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
- Standardized sighting intake
- Real-time dispatch coordination
- Field verification workflow
- Community alert publication (Ojo integration)

### 🔐 Role-Based Access Control
- **Volunteer** - Attend shifts, report sightings
- **Coordinator** - Manage volunteers and shifts
- **Dispatcher** - Handle incidents and team assignments
- **Administrator** - System configuration and oversight

## 📁 Repository Structure

```
VMS/
├── index.html                          # Landing page
├── Project Notes                       # Project proposal & requirements
├── User Roles & Permissions.md         # RBAC documentation
├── Wireframes.md                       # Wireframe specifications
├── wireframes/
│   ├── index.html                      # Wireframe navigation hub
│   ├── css/
│   │   └── wireframe.css              # Shared styling
│   ├── dashboards/
│   │   ├── volunteer-dashboard.html
│   │   ├── coordinator-dashboard.html
│   │   └── dispatcher-dashboard.html
│   ├── volunteer/
│   │   ├── registration.html
│   │   ├── profile.html
│   │   └── directory.html
│   ├── shifts/
│   │   ├── create-shift.html
│   │   ├── browse-rsvp.html
│   │   └── roster.html
│   └── incidents/
│       ├── intake-form.html
│       ├── dispatcher-view.html
│       ├── field-response.html
│       └── ojo-publication.html
└── vercel.json                         # Vercel deployment configuration
```

## 🚀 Local Development

To view the wireframes locally:

1. Clone the repository:
   ```bash
   git clone https://github.com/soulfshr/VMS.git
   cd VMS
   ```

2. Open in your browser:
   ```bash
   open index.html
   # or
   python -m http.server 8000
   # then navigate to http://localhost:8000
   ```

## 📱 Wireframe Categories

### Dashboard Views (3)
- Volunteer Dashboard - Personal shift view and training status
- Coordinator Dashboard - Shift management and volunteer statistics
- Dispatcher Dashboard - Active incidents and team assignments

### Volunteer Management (3)
- Registration Form - Multi-step volunteer signup
- Profile View - Qualifications, availability, and activity
- Directory - Searchable volunteer roster

### Shift Coordination (3)
- Create Shift - Complete shift setup with invitation settings
- Browse & RSVP - Volunteer shift browsing and signup
- Roster Management - Track confirmed/pending/declined volunteers

### Incident Management (4)
- Sighting Intake - Report submission form
- Dispatcher View - Incident detail and team assignment
- Field Response - Mobile-optimized field interface
- Ojo Publication - Community alert publishing

## 🎨 Design Features

- ✅ Professional UI/UX with modern styling
- ✅ Color-coded priorities and status indicators
- ✅ Responsive design (mobile-optimized where appropriate)
- ✅ Consistent navigation across all wireframes
- ✅ Form validation indicators
- ✅ Interactive elements (buttons, forms, tables)

## 📖 Documentation

- **[Project Notes](Project%20Notes)** - Comprehensive project proposal including background, requirements, and implementation phases
- **[User Roles & Permissions](User%20Roles%20%26%20Permissions.md)** - Detailed RBAC specification with permission matrices
- **[Wireframes](Wireframes.md)** - Text-based wireframe specifications

## 🤝 Contributing

This is currently in the design and planning phase. Feedback and suggestions are welcome!

## 📄 License

[To be determined]

## 🙏 Acknowledgments

Built for Siembra NC's mission to support and protect immigrant communities.

---

**Status:** Planning Phase | November 2025

🤖 Generated with [Claude Code](https://claude.com/claude-code)
