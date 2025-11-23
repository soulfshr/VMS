# User Roles & Permissions

**Document Version:** 1.0
**Date:** November 22, 2025
**Purpose:** Define user roles, hierarchies, and permission matrices for VMS

---

## Table of Contents
1. [Role Overview](#1-role-overview)
2. [Detailed Role Definitions](#2-detailed-role-definitions)
3. [Permission Matrix](#3-permission-matrix)
4. [Role Assignment & Management](#4-role-assignment--management)
5. [Multi-Role Users](#5-multi-role-users)
6. [Security Considerations](#6-security-considerations)

---

## 1. Role Overview

### 1.1 Role Hierarchy

```
┌─────────────────────────────────────────┐
│           ADMINISTRATOR                 │
│  System-wide access & configuration     │
└─────────────────────────────────────────┘
              ↓
    ┌─────────────────────┐
    │                     │
┌───────────┐      ┌──────────────┐
│COORDINATOR│      │  DISPATCHER  │
│Shift Mgmt │      │ Incident Mgmt│
└───────────┘      └──────────────┘
              ↓
    ┌──────────────────┐
    │    VOLUNTEER     │
    │  Field Worker    │
    └──────────────────┘
```

### 1.2 Role Summary

| Role | Primary Function | Access Level | Typical User |
|------|-----------------|--------------|--------------|
| **Volunteer** | Participate in shifts, report sightings | Limited - Self service | Community members |
| **Coordinator** | Manage volunteers and shifts | Moderate - Volunteer management | Staff, Team leads |
| **Dispatcher** | Manage incidents and field response | Moderate - Incident management | Operations staff |
| **Administrator** | System configuration and oversight | Full - All modules | Organization leadership |

---

## 2. Detailed Role Definitions

### 2.1 VOLUNTEER

**Purpose:** Community members who participate in monitoring shifts and report sightings.

**Core Responsibilities:**
- Attend scheduled shifts
- Report sightings and incidents
- Update personal profile and availability
- Complete required training
- Respond to field assignments (if qualified)

**Key Activities:**
- View and RSVP to shift invitations
- Browse available shifts
- Submit incident reports
- Update field incident status (when assigned)
- View own shift history
- Manage communication preferences
- Access training materials

**Limitations:**
- Cannot see other volunteers' personal information
- Cannot create or manage shifts
- Cannot assign teams to incidents
- Cannot publish to Ojo
- Cannot access admin functions
- Can only view incidents they reported or are assigned to

---

### 2.2 COORDINATOR

**Purpose:** Manage volunteer roster, scheduling, and shift operations.

**Core Responsibilities:**
- Recruit and onboard volunteers
- Create and manage shifts
- Track volunteer training and qualifications
- Ensure adequate shift coverage
- Communicate with volunteer base
- Monitor volunteer engagement

**Key Activities:**
- Create, edit, and cancel shifts
- View and manage volunteer directory
- Assign volunteers to shifts manually
- Send shift invitations and reminders
- Track volunteer hours and activity
- Update volunteer training status
- Generate volunteer reports
- Manage volunteer availability
- Send announcements to volunteers
- Export volunteer data

**Access to:**
- Full volunteer management module
- Full shift coordination module
- Read-only access to incident data (to understand team assignments)
- Basic reporting and analytics

**Limitations:**
- Cannot manage incidents or dispatch teams
- Cannot publish to Ojo
- Cannot modify system settings
- Cannot assign or modify user roles
- Cannot delete users (can deactivate)

---

### 2.3 DISPATCHER

**Purpose:** Manage incident intake, triage, team assignment, and community alerts.

**Core Responsibilities:**
- Monitor incoming incident reports
- Triage and prioritize incidents
- Assign response teams
- Track incident status
- Verify and publish alerts to Ojo
- Coordinate field response

**Key Activities:**
- View all incident reports
- Assign teams to incidents
- Update incident status and disposition
- Communicate with field teams
- Review field verification reports
- Prepare and publish Ojo alerts
- Manage incident archive
- Generate incident reports
- Monitor active incidents in real-time
- Mark incidents as false alarms

**Access to:**
- Full incident management module
- Read-only access to volunteer directory (to assign teams)
- Read-only access to shift data (to know who's available)
- Ojo publication interface
- Incident reporting and analytics

**Limitations:**
- Cannot create or manage shifts
- Cannot modify volunteer profiles or training status
- Cannot manage system settings
- Cannot assign or modify user roles
- Limited volunteer management (can only view for team assignment)

---

### 2.4 ADMINISTRATOR

**Purpose:** Overall system management, configuration, and organizational oversight.

**Core Responsibilities:**
- Manage all user accounts and roles
- Configure system settings
- Oversee all operations
- Manage integrations
- Ensure data integrity
- Handle security and compliance
- Generate executive reports

**Key Activities:**
- Create, modify, and delete user accounts
- Assign and revoke roles
- Configure system-wide settings
- Manage zones and locations
- Set up and maintain integrations (Ojo, email/SMS, etc.)
- Access audit logs
- Manage data retention and archival
- Export all system data
- Configure notification templates
- Manage training curriculum
- View all reports and analytics
- Perform system backups
- Handle emergency situations
- Override restrictions when necessary

**Access to:**
- All modules (full access)
- System settings and configuration
- User management
- Audit logs
- All data across all modules
- Integration settings
- Advanced reporting

**Special Capabilities:**
- Can perform actions on behalf of other users
- Can access deleted/archived data
- Can modify historical records (with audit trail)
- Can override system constraints
- Can manage API keys and external integrations

**Limitations:**
- Actions are fully logged and auditable
- Cannot delete audit logs
- Some destructive actions may require multi-admin approval (organizational policy)

---

## 3. Permission Matrix

### 3.1 Volunteer Management Permissions

| Action | Volunteer | Coordinator | Dispatcher | Admin |
|--------|-----------|-------------|------------|-------|
| View own profile | ✓ | ✓ | ✓ | ✓ |
| Edit own profile | ✓ | ✓ | ✓ | ✓ |
| Update own availability | ✓ | ✓ | ✓ | ✓ |
| View volunteer directory | ✗ | ✓ | ✓ (read-only) | ✓ |
| View volunteer details | Own only | ✓ | ✓ (limited) | ✓ |
| Create volunteer account | ✗ | ✓ | ✗ | ✓ |
| Edit volunteer profile | Own only | ✓ | ✗ | ✓ |
| Update training status | ✗ | ✓ | ✗ | ✓ |
| Deactivate volunteer | ✗ | ✓ | ✗ | ✓ |
| Delete volunteer | ✗ | ✗ | ✗ | ✓ |
| Export volunteer data | ✗ | ✓ | ✗ | ✓ |
| View volunteer hours | Own only | ✓ | ✗ | ✓ |
| Send messages to volunteers | ✗ | ✓ | ✗ | ✓ |

### 3.2 Shift Coordination Permissions

| Action | Volunteer | Coordinator | Dispatcher | Admin |
|--------|-----------|-------------|------------|-------|
| View available shifts | ✓ | ✓ | ✓ (read-only) | ✓ |
| View own shifts | ✓ | ✓ | ✓ | ✓ |
| RSVP to shifts | ✓ | ✓ | ✗ | ✓ |
| Browse shift calendar | ✓ | ✓ | ✓ (read-only) | ✓ |
| Create shifts | ✗ | ✓ | ✗ | ✓ |
| Edit shifts | ✗ | ✓ | ✗ | ✓ |
| Cancel shifts | ✗ | ✓ | ✗ | ✓ |
| Send shift invitations | ✗ | ✓ | ✗ | ✓ |
| Manually assign volunteers | ✗ | ✓ | ✗ | ✓ |
| Remove volunteers from shifts | ✗ | ✓ | ✗ | ✓ |
| View shift roster | Own shifts | ✓ | ✓ (read-only) | ✓ |
| Export shift data | ✗ | ✓ | ✗ | ✓ |
| Send shift reminders | ✗ | ✓ | ✗ | ✓ |

### 3.3 Incident Management Permissions

| Action | Volunteer | Coordinator | Dispatcher | Admin |
|--------|-----------|-------------|------------|-------|
| Submit incident report | ✓ | ✓ | ✓ | ✓ |
| View own reports | ✓ | ✓ | ✓ | ✓ |
| View all incidents | ✗ | ✗ | ✓ | ✓ |
| View assigned incidents | ✓ | ✗ | ✓ | ✓ |
| Edit incident details | Own only | ✗ | ✓ | ✓ |
| Assign teams | ✗ | ✗ | ✓ | ✓ |
| Update field status | Assigned only | ✗ | ✓ | ✓ |
| Mark as false alarm | ✗ | ✗ | ✓ | ✓ |
| Verify incidents | Assigned only | ✗ | ✓ | ✓ |
| Publish to Ojo | ✗ | ✗ | ✓ | ✓ |
| Edit published alerts | ✗ | ✗ | ✓ | ✓ |
| End active alerts | ✗ | ✗ | ✓ | ✓ |
| View incident archive | Own only | ✗ | ✓ | ✓ |
| Export incident data | ✗ | ✗ | ✓ | ✓ |
| Add internal notes | Assigned only | ✗ | ✓ | ✓ |

### 3.4 System Administration Permissions

| Action | Volunteer | Coordinator | Dispatcher | Admin |
|--------|-----------|-------------|------------|-------|
| View system settings | ✗ | ✗ | ✗ | ✓ |
| Modify system settings | ✗ | ✗ | ✗ | ✓ |
| Manage user roles | ✗ | ✗ | ✗ | ✓ |
| Create admin accounts | ✗ | ✗ | ✗ | ✓ |
| View audit logs | ✗ | ✗ | ✗ | ✓ |
| Manage integrations | ✗ | ✗ | ✗ | ✓ |
| Configure notifications | ✗ | ✗ | ✗ | ✓ |
| Manage zones/locations | ✗ | ✗ | ✗ | ✓ |
| Manage training curriculum | ✗ | ✗ | ✗ | ✓ |
| Access all data | ✗ | ✗ | ✗ | ✓ |
| Perform system backup | ✗ | ✗ | ✗ | ✓ |
| Restore from backup | ✗ | ✗ | ✗ | ✓ |
| Delete historical data | ✗ | ✗ | ✗ | ✓ |

### 3.5 Reporting & Analytics Permissions

| Report Type | Volunteer | Coordinator | Dispatcher | Admin |
|-------------|-----------|-------------|------------|-------|
| Own activity summary | ✓ | ✓ | ✓ | ✓ |
| Volunteer statistics | ✗ | ✓ | ✗ | ✓ |
| Shift coverage reports | ✗ | ✓ | ✗ | ✓ |
| Volunteer hours | Own only | ✓ | ✗ | ✓ |
| Training completion | Own only | ✓ | ✗ | ✓ |
| Incident statistics | ✗ | ✗ | ✓ | ✓ |
| Response time metrics | ✗ | ✗ | ✓ | ✓ |
| Ojo publication history | ✗ | ✗ | ✓ | ✓ |
| System usage analytics | ✗ | ✗ | ✗ | ✓ |
| Executive dashboard | ✗ | ✗ | ✗ | ✓ |
| Custom reports | ✗ | Limited | Limited | ✓ |
| Data exports (all) | ✗ | ✗ | ✗ | ✓ |

---

## 4. Role Assignment & Management

### 4.1 Initial Role Assignment

**New User Default:** Volunteer (pending verification)

**Role Assignment Process:**
1. User registers → Account created as "Volunteer - Pending"
2. Admin or Coordinator reviews application
3. Background check/vetting completed (if required)
4. Initial training scheduled
5. Upon training completion → Account activated as "Volunteer - Active"
6. For elevated roles (Coordinator/Dispatcher/Admin):
   - Nominated by existing Admin
   - Admin assigns role
   - User receives notification and training
   - Role becomes active

### 4.2 Role Modification

**Who Can Modify Roles:**
- Only Administrators can assign or revoke roles
- Coordinators can change volunteer status (pending → active, active → inactive)
- No self-service role elevation

**Audit Requirements:**
- All role changes logged with:
  - Who made the change
  - When it was made
  - Old role → New role
  - Reason (optional but recommended)

### 4.3 Role Deactivation

**Temporary Deactivation:**
- Coordinator can mark volunteer as "Inactive" (leave of absence, etc.)
- Admin can suspend any user
- Suspended users cannot log in but data is retained

**Permanent Deactivation:**
- Only Admin can permanently delete users
- Deletion should be rare (data retention for historical records)
- Anonymization option for GDPR/privacy compliance

---

## 5. Multi-Role Users

### 5.1 Concept

Users can hold multiple roles simultaneously. This is common for:
- **Coordinator + Volunteer:** Staff who also participate in shifts
- **Dispatcher + Volunteer:** Operations staff who do field work
- **Admin + Coordinator:** Leadership who manages volunteers
- **Admin + Dispatcher:** Leadership who oversees incidents

### 5.2 How Multi-Role Works

**Permission Model:**
- User has the UNION of all permissions from assigned roles
- Highest permission level takes precedence
- User can switch "active role" in UI for clearer context

**Example:**
```
User: Sarah Johnson
Roles: Coordinator + Volunteer

Permissions:
✓ Create shifts (from Coordinator role)
✓ Manage volunteer directory (from Coordinator role)
✓ RSVP to shifts (from Volunteer role)
✓ Submit incident reports (from Volunteer role)
✗ Publish to Ojo (neither role has this)
```

### 5.3 UI Considerations for Multi-Role Users

**Role Switcher:**
```
┌─────────────────────────┐
│ You are viewing as:     │
│ [Coordinator ▼]         │
│                         │
│ Your roles:             │
│ • Coordinator           │
│ • Volunteer             │
└─────────────────────────┘
```

**Benefits:**
- Simplified navigation (only show relevant menus)
- Clearer context for actions
- Easier to understand current capabilities

**Dashboard Adaptation:**
- When in "Coordinator" mode → Show coordinator dashboard
- When in "Volunteer" mode → Show volunteer dashboard
- Quick toggle between views

---

## 6. Security Considerations

### 6.1 Role-Based Access Control (RBAC)

**Implementation:**
- Every API endpoint checks user's role(s) before allowing access
- Database queries filter data based on role permissions
- UI elements hide/show based on role
- Frontend AND backend validation (never trust frontend alone)

### 6.2 Data Isolation

**Volunteer:**
- Can only see own data + publicly available information
- Cannot query other volunteers' personal details

**Coordinator:**
- Can access volunteer data within their purview
- May be scoped to specific zones (optional enhancement)

**Dispatcher:**
- Can access all incident data
- Limited access to volunteer personal data (only what's needed for assignments)

**Admin:**
- Full access with full audit trail

### 6.3 Sensitive Data Protection

**Personally Identifiable Information (PII):**
- Phone numbers, email addresses, home addresses
- Only visible to roles that need them
- Masked in logs and non-essential displays

**Incident Details:**
- Exact addresses may be hidden in public-facing Ojo alerts
- Full details available to dispatchers and assigned field teams
- Reporter anonymity option respected

### 6.4 Audit Logging

**All role-based actions should be logged:**
- User login/logout
- Role changes
- Data access (especially PII)
- Administrative actions
- Incident assignments and status changes
- Ojo publications

**Log Retention:**
- Minimum 1 year for compliance
- Admin-only access to audit logs
- Logs cannot be modified or deleted

---

## 7. Role-Specific Dashboards

### 7.1 Dashboard Summary

| Role | Primary Dashboard Focus |
|------|------------------------|
| **Volunteer** | My shifts, available opportunities, training status |
| **Coordinator** | Shift coverage, volunteer availability, upcoming needs |
| **Dispatcher** | Active incidents, available teams, pending publications |
| **Admin** | System health, user activity, org-wide metrics |

### 7.2 Volunteer Dashboard

**Key Widgets:**
- Upcoming shifts
- Available shift opportunities
- Training progress
- Hours volunteered
- Recent activity

### 7.3 Coordinator Dashboard

**Key Widgets:**
- Shift coverage status
- Volunteers needing attention
- Training completions
- RSVP summary
- Upcoming shifts requiring staffing

### 7.4 Dispatcher Dashboard

**Key Widgets:**
- Active incidents by priority
- Available response teams
- Pending verifications
- Ready for Ojo publication
- Response time metrics

### 7.5 Admin Dashboard

**Key Widgets:**
- System usage statistics
- User growth metrics
- Incident trends
- Volunteer engagement rates
- System health indicators
- Recent admin actions

---

## 8. Recommended Enhancements (Future)

### 8.1 Zone-Based Permissions

**Concept:** Coordinators/Dispatchers scoped to specific geographic zones

**Benefits:**
- Large organizations can have regional coordinators
- Reduces cognitive load (only see relevant data)
- Better local knowledge

**Implementation:**
- Assign users to zones
- Filter shifts and incidents by zone
- Admin has access to all zones

### 8.2 Team Lead Role

**Concept:** Hybrid between Volunteer and Coordinator

**Responsibilities:**
- Lead shifts in the field
- Basic team management
- Cannot create shifts but can manage assigned team

**Potential Value:**
- Distributed leadership
- Career path for volunteers
- Reduced coordinator burden

### 8.3 Read-Only Observer Role

**Concept:** External stakeholders (board members, partners)

**Capabilities:**
- View dashboards and reports
- No ability to create or modify data
- Limited access to PII

**Use Cases:**
- Organizational transparency
- Partner organizations
- Oversight committees

### 8.4 Emergency Override

**Concept:** Temporary elevation of permissions in crisis

**Implementation:**
- Admin can grant temporary elevated access
- Auto-expires after set duration (e.g., 24 hours)
- Full audit trail of override usage
- Notification to other admins

---

## 9. Implementation Checklist

### Phase 1: Core Roles
- [ ] Implement Volunteer role
- [ ] Implement Coordinator role
- [ ] Implement Dispatcher role
- [ ] Implement Admin role
- [ ] Build role assignment interface (admin)
- [ ] Create permission checking middleware

### Phase 2: Multi-Role Support
- [ ] Allow users to have multiple roles
- [ ] Build role switcher UI
- [ ] Implement union of permissions
- [ ] Test multi-role scenarios

### Phase 3: Security & Audit
- [ ] Implement audit logging
- [ ] Add PII protection
- [ ] Role-based data filtering
- [ ] Security testing

### Phase 4: Enhancements
- [ ] Zone-based permissions (optional)
- [ ] Team Lead role (optional)
- [ ] Observer role (optional)
- [ ] Emergency override (optional)

---

## 10. Questions for Siembra NC

Before finalizing the role structure, we should clarify:

1. **How many people typically fill each role?**
   - How many coordinators?
   - How many dispatchers?
   - Expected volunteer count?

2. **Is there role overlap?**
   - Do coordinators also do field work?
   - Do dispatchers also coordinate volunteers?

3. **How centralized is decision-making?**
   - How many admins are needed?
   - Should there be approval workflows?

4. **Are there geographic divisions?**
   - Would zone-based permissions be valuable?
   - Regional coordinators?

5. **What's the training/vetting process?**
   - Who approves new volunteers?
   - Who certifies training completion?

6. **External access needed?**
   - Do partners need read-only access?
   - Any integration with other organizations?

---

**Document Version:** 1.0
**Last Updated:** November 22, 2025
**Status:** Draft for Review
