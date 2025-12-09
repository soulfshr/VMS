# Siembra NC VMS User Guide

A comprehensive guide to using the Siembra NC Volunteer Management System.

---

## Table of Contents

1. [Overview](#overview)
2. [User Roles](#user-roles)
3. [Getting Started](#getting-started)
4. [Dashboard](#dashboard)
5. [Shifts](#shifts)
6. [Trainings](#trainings)
7. [Schedule](#schedule)
8. [Volunteers](#volunteers)
9. [Profile](#profile)
10. [Admin Panel](#admin-panel)
    - [Qualified Roles](#qualified-roles)
11. [Email Blasts](#email-blasts)
12. [Common Workflows](#common-workflows)

---

## Overview

The Siembra NC Volunteer Management System (VMS) coordinates community volunteers who monitor, document, and respond to immigration enforcement activities in North Carolina's Triangle region. The system manages:

- **Shift scheduling** across 13 zones in Durham, Orange, and Wake counties
- **Training coordination** for volunteer preparedness
- **Volunteer management** with role-based access
- **Schedule coordination** for dispatchers and zone leads

---

## User Roles

The VMS has four user roles, each with different capabilities:

### Volunteer
The base role for all community members participating in monitoring activities.

**Capabilities:**
- View and RSVP to available shifts
- View and sign up for training sessions
- Update personal profile and availability
- View their own schedule and upcoming shifts

### Coordinator
Zone and shift coordinators who manage volunteer activities.

**Capabilities:**
- Everything Volunteers can do, plus:
- Create and manage shifts
- View and manage shift rosters
- Confirm or reject volunteer RSVPs
- Access volunteer directory
- Assign zone leads to shifts
- Send email blasts to volunteers

### Dispatcher
Handles real-time coordination during active monitoring.

**Capabilities:**
- Everything Volunteers can do, plus:
- View schedule dashboard with dispatcher assignments
- See all active shifts across zones
- Coordinate field responses

### Administrator
Full system access for organizational leadership.

**Capabilities:**
- Everything all other roles can do, plus:
- Manage all users and their roles
- Configure zones, shift types, training types, and qualified roles
- Bulk import volunteers
- Access system settings

---

## Getting Started

### First Login

1. Navigate to the login page
2. Select your user account from the available options
3. You'll be redirected to your dashboard

### Welcome Tour

On your first visit to each major page, you may see a guided tour highlighting key features. You can:
- Follow along by clicking "Next"
- Skip the tour by clicking "Close"
- Restart tours anytime via the **?** help button in the header

### Navigation

The main navigation bar includes:
- **Dashboard** - Your home base with personalized overview
- **Shifts** - Browse and manage shifts
- **Trainings** - View training sessions
- **Schedule** - Weekly schedule view (shows dispatcher/zone lead assignments)
- **Volunteers** - Volunteer directory (Coordinators/Admins only)
- **Profile** - Your personal settings
- **Admin** - System administration (Admins only)
  - Mapping (zones, POIs, categories)
  - Shift/Training types, Qualified roles, Settings

---

## Dashboard

Your dashboard provides a personalized overview based on your role.

### All Users See:
- **Upcoming Shifts** - Your next confirmed shifts
- **Available Shifts** - Shifts you can RSVP to
- **Required Trainings** - Any outstanding training requirements

### Coordinators Also See:
- **Pending RSVPs** - Volunteer RSVPs awaiting confirmation
- **Zone Statistics** - Volunteer counts and coverage

### Dispatchers Also See:
- **Active Shifts** - Currently running shifts across all zones
- **On-Call Volunteers** - Available responders

### Administrators Also See:
- **System Statistics** - Overall volunteer and shift metrics
- **Quick Admin Actions** - Links to common admin tasks

---

## Shifts

### Viewing Shifts

The **Shifts** page shows all available and upcoming shifts. You can:

- **Filter by zone** - Focus on specific geographic areas
- **Filter by shift type** - Zone Patrol, On-Call, Intel Collection, etc.
- **Filter by date range** - Find shifts for specific days
- **Search** - Find shifts by title or description

### Shift Types

| Type | Description |
|------|-------------|
| **Zone Patrol** | Active monitoring of assigned zones |
| **On-Call** | Available for rapid dispatch to verify sightings |
| **Intel Collection** | Monitor social media and community networks |
| **Training** | Attend training sessions |

### RSVPing to a Shift

1. Browse available shifts on the Shifts page
2. Click on a shift to view details
3. Click **"RSVP to this Shift"**
4. Your RSVP status will show as "Pending" until a coordinator confirms

### RSVP Statuses

| Status | Meaning |
|--------|---------|
| **Pending** | Your RSVP is awaiting coordinator approval |
| **Confirmed** | You're confirmed for this shift |
| **Declined** | Your RSVP was not accepted (capacity/requirements) |
| **Cancelled** | You or a coordinator cancelled your participation |

### Shift Calendar View

Access the calendar view via **Shifts → Calendar** to see shifts in a monthly/weekly format. Click any shift to view details or RSVP.

### Creating Shifts (Coordinators/Admins)

1. Navigate to **Shifts**
2. Click **"Create Shift"**
3. Fill in the details:
   - **Title** - Descriptive name for the shift
   - **Shift Type** - Select from available types
   - **Zone** - Geographic area
   - **Date & Time** - When the shift occurs
   - **Capacity** - Maximum volunteers needed
   - **Description** - Additional details or instructions
4. Click **"Create Shift"**

### Editing Shifts (Coordinators/Admins)

1. Navigate to **Shifts**
2. Find the shift you want to edit
3. Click **"Edit"** in the shift row (list view) or the Edit button (card view)
4. Update any details:
   - Title, description
   - Date and times
   - Zone
   - Volunteer capacity (min, ideal, max)
   - Status (Draft/Published)
5. Click **"Save Changes"**

**Note:** Cancelled shifts cannot be edited. To modify a cancelled shift, you'll need to create a new one.

### Managing Shift Rosters (Coordinators/Admins)

1. Click on any shift to view details
2. Click **"View Roster"** or the roster icon
3. From the roster page you can:
   - **Confirm RSVPs** - Approve pending volunteers
   - **Decline RSVPs** - Reject volunteers (with reason)
   - **Assign Zone Lead** - Designate shift leadership
   - **Remove volunteers** - Cancel confirmed participants

#### Bulk RSVP Confirmation

To confirm multiple RSVPs at once:
1. Check the boxes next to pending volunteers
2. Click **"Confirm Selected"**
3. All selected volunteers will be confirmed and notified

### Bulk Shift Operations (Coordinators/Admins)

The Shifts page supports multi-select for efficient bulk operations:

#### Selecting Multiple Shifts
1. Navigate to **Shifts**
2. Check the boxes next to shifts you want to modify
3. Use **Shift+Click** to select a range of shifts
4. Use the **Select All** checkbox in the header to select all visible shifts

#### Bulk Edit

Edit multiple shifts at once:
1. Select the shifts you want to modify
2. Click **"Edit Selected"** in the toolbar
3. Check the fields you want to change:
   - **Shift Type** - Change to a different configured type
   - **Volunteer Limits** - Update min/max volunteers
   - **Time Slot** - Change start/end times
4. Click **"Update"** to apply changes

Only the fields you check will be modified - unchecked fields remain unchanged.

#### Bulk Cancel

Cancel multiple shifts at once:
1. Select the shifts you want to cancel
2. Click **"Cancel Selected"** in the toolbar
3. Confirm the action
4. All signed-up volunteers will be notified automatically

---

## Trainings

### Viewing Training Sessions

The **Trainings** page lists all available training sessions. Filter by:
- **Training type** - Basic Training, Field Protocol, Legal Rights, etc.
- **Date range** - Upcoming sessions
- **Status** - Sessions you've completed vs. available

### Training Types

| Type | Description |
|------|-------------|
| **Basic Training** | Required orientation for all new volunteers |
| **Field Protocol** | Procedures for monitoring activities |
| **Legal Rights** | Know Your Rights training |
| **De-escalation** | Conflict resolution techniques |

### Signing Up for Training

1. Browse available sessions on the Trainings page
2. Click on a session to view details
3. Click **"RSVP"** to register
4. Attend the session at the scheduled time

### Training Completion

After attending a training:
1. A coordinator marks your attendance as confirmed
2. The training appears in your profile under "Completed Trainings"
3. If the training grants a Qualified Role (e.g., Verifier, Zone Lead), you automatically receive that qualification
4. You may now be eligible for shifts requiring that training or qualified role

### Creating Training Sessions (Coordinators/Admins)

1. Navigate to **Trainings**
2. Click **"Create Training Session"**
3. Fill in:
   - **Training Type** - Select from configured types
   - **Date & Time** - When the session occurs
   - **Location** - Where volunteers should go
   - **Capacity** - Maximum attendees
   - **Instructor** - Who's leading the training
4. Click **"Create"**

---

## Schedule

The **Schedule** page provides a weekly calendar view showing:

### For All Users:
- Your confirmed shifts for the week
- Training sessions you're registered for

### For Coordinators/Dispatchers/Admins:
- **Regional Lead Assignments** - Who's the regional lead each day
- **Dispatcher Assignments** - Who's on dispatch duty (display varies by mode)
- **Zone Lead Assignments** - Zone leads assigned to each shift
- Filter by zone to see specific area coverage

### Dispatcher Display by Mode

The Schedule page displays dispatchers differently based on the admin-configured Dispatcher Scheduling Mode:

| Mode | Display |
|------|---------|
| **Regional** | A dedicated "🎧 Dispatcher (Regional)" section appears between the Regional Lead row and county sections, showing one dispatcher per time block for all counties |
| **County** | A "🎧 Dispatcher" row appears under each county header, showing that county's dispatcher for each day |
| **Zone** | Dispatchers appear inside each shift cell alongside zone assignments (original behavior) |

### Navigating the Schedule

- Use **← Previous** and **Next →** to change weeks
- Click **Today** to return to the current week
- Click any shift to view details
- Click dispatcher cells/rows to assign or change dispatchers (Coordinators/Admins only)

---

## Volunteers

*Available to Coordinators and Administrators only.*

The **Volunteers** page is your directory of all registered volunteers.

### Viewing Volunteers

- **Search** by name, email, or phone
- **Filter by zone** - See volunteers in specific areas
- **Filter by role** - View by permission level
- **Filter by status** - Active vs. inactive volunteers

### Volunteer Details

Click on any volunteer to see:
- Contact information
- Assigned zones
- Completed trainings
- Upcoming shifts
- Shift history

### Bulk Import (Admins)

To import multiple volunteers at once:

1. Click **"Import Volunteers"**
2. Download the CSV template
3. Fill in volunteer data following the template format
4. Upload the completed CSV
5. Review the import preview
6. Confirm the import

**CSV Format:**
```
name,email,phone,role,zones,primaryLanguage
John Doe,john@example.com,(919) 555-0100,VOLUNTEER,"Durham 1;Durham 2",English
```

### Managing Volunteer Roles (Admins)

1. Click on a volunteer
2. Click **"Edit"** or the edit icon
3. Change their role (Volunteer, Coordinator, Dispatcher, Administrator)
4. Save changes

---

## Profile

Your **Profile** page contains your personal information and settings.

### Viewing Your Profile

- Personal information (name, email, phone)
- Assigned zones
- Completed trainings
- Upcoming shifts
- Language preferences

### Updating Your Profile

1. Navigate to **Profile**
2. Click **"Edit Profile"**
3. Update your information:
   - Phone number
   - Primary language
   - Additional languages
   - Zone preferences
4. Click **"Save"**

---

## Admin Panel

*Available to Administrators only.*

The **Admin** section provides system configuration options.

### Mapping

The **Mapping** page consolidates all geographic and location management into a single tabbed interface with three sections: Zones, Points of Interest, and POI Categories.

#### Zones Tab

Manage operational zones where volunteers conduct monitoring:

- **Add zones** - Create new monitoring areas with name, county, and description
- **Edit zones** - Update zone names, counties, and descriptions
- **Map color** - Assign colors for display on coverage maps
- **Signal Group links** - Add direct links to each zone's Signal group for real-time coordination
- **Draw boundaries** - Click "Draw Map" to define zone boundaries on an interactive map
- **Activate/Archive** - Toggle zones between active and archived status

Zones are grouped by county (Durham, Orange, Wake) for easy organization.

#### Points of Interest Tab

Manage important locations displayed on volunteer maps:

- **Add POIs** - Create points of interest with name, address, and description
- **Assign category** - Select a POI category (e.g., ICE/Enforcement, School, Safe Space)
- **Set location** - Use the map picker to place POIs at exact coordinates
- **Filter and search** - Find POIs by name, category, or zone
- **Activate/Archive** - Toggle POI visibility on maps

POIs help volunteers identify important locations during patrols, including:
- Known enforcement locations
- Schools and sensitive areas
- Safe spaces and resources
- Community partner locations

#### POI Categories Tab

Configure categories that organize Points of Interest:

- **Add categories** - Create new POI types with name and unique slug
- **Set colors** - Assign map marker colors for each category
- **Choose icons** - Select icons (shield, school, heart, building, etc.)
- **Add descriptions** - Document what each category represents
- **Activate/Archive** - Toggle category availability

Categories help volunteers quickly identify POI types on the map through consistent color-coding and iconography.

### Shift Types

Configure available shift categories:
- **Add types** - Create new shift categories
- **Edit types** - Update names, descriptions, colors
- **Set defaults** - Configure default duration, capacity

### Training Types

Manage training categories:
- **Add types** - Create new training categories
- **Edit types** - Update names, requirements
- **Set prerequisites** - Define training dependencies
- **Grant Qualified Roles** - Configure which trainings grant specific qualified roles upon completion

### Qualified Roles

Manage customizable positions that volunteers can fill during shifts:
- **Add roles** - Create new qualified roles (e.g., Verifier, Zone Lead, Dispatcher)
- **Edit roles** - Update names, descriptions, and colors
- **Archive roles** - Soft delete roles no longer in use
- **View usage** - See how many volunteers hold each qualified role

Qualified Roles can be:
- Automatically granted when volunteers complete specific training types
- Manually assigned by administrators through the Volunteers page
- Required by certain shift types for participation

#### Shadow Roles (Counts Toward Minimum)

Some roles like "Shadower" are for volunteers who attend shifts but shouldn't count toward the minimum required volunteers. When creating or editing a qualified role:

- **Counts toward shift minimum** (checked by default) - Volunteers with this role count toward the shift's minimum and maximum volunteer requirements
- **Unchecked** - Volunteers with this role can attend shifts but don't count toward the minimum (useful for shadowers, observers, or trainees)

Roles that don't count toward the minimum are marked with a "Shadow" badge in the Qualified Roles list.

### System Settings

Configure system-wide options:
- Organization name and branding
- Email notification settings
- Default values for shifts and trainings
- Dispatcher scheduling mode

#### Dispatcher Scheduling Mode

The VMS supports three dispatcher scheduling modes to match varying activity levels:

| Mode | Activity Level | Description |
|------|----------------|-------------|
| **Regional** | Low | One dispatcher covers all counties per time block. Shows a dedicated "Dispatcher" row between Regional Lead and county sections. |
| **County** | Medium | One dispatcher per county per time block. Shows a dispatcher row under each county header. |
| **Zone** | High (default) | Dispatcher shown per cell alongside zone assignments. This is the original behavior. |

To change the mode:
1. Navigate to **Admin → Settings**
2. Find the "Dispatcher Scheduling Mode" section
3. Select the appropriate mode for current activity level
4. Changes take effect immediately on the Schedule page

**Note:** When switching modes, existing dispatcher assignments are hidden (not deleted). Switching back to a previous mode will restore those assignments.

---

## Email Blasts

*Available to Coordinators and Administrators.*

The Email Blast feature allows you to send bulk communications to volunteers. Access it from **Dashboard → Send Email Blast** or through the admin section.

### Email Templates

| Template | Description | Features |
|----------|-------------|----------|
| **General Newsletter** | Updates and announcements | Custom message with standard wrapper |
| **Schedule Announcement** | New shifts available | Auto-includes zone-specific shift listings with open spots |
| **Training Announcement** | Upcoming training sessions | Auto-includes training sessions table with availability |
| **Freeform** | Custom subject and body | Full control over message content |

### Sending an Email Blast

1. Navigate to **Email Blast** from your dashboard
2. Select a template type
3. Compose your message (templates provide default content you can customize)
4. **Filter recipients** by:
   - User Type (Volunteer, Coordinator, Dispatcher, Administrator)
   - Zone assignments
   - Qualified Roles (e.g., Verifier, Zone Lead, Dispatcher)
   - Language preferences
   - Has any qualified roles vs. none
5. Preview the recipient count
6. Review and send

### Smart Template Features

**Schedule Announcement:**
- Automatically queries upcoming shifts in the selected date range
- Shows zone-specific shifts if recipient has zone assignments
- Displays spots remaining for each shift
- Includes direct link to view all shifts

**Training Announcement:**
- Automatically includes upcoming training sessions
- Shows date, time, type, title, location, and available spots
- Links to training RSVP page

### Recipient Filtering

- Only **active** users with **email notifications enabled** receive blasts
- Users can manage their email preferences in their profile
- Each email includes an unsubscribe link for compliance

### Viewing Email History

Coordinators and Admins can view recent email blast history showing:
- Subject and template used
- Recipient count
- Sent/failed counts
- When sent and by whom

---

## Common Workflows

### Workflow: Volunteer Signs Up for a Shift

1. **Volunteer** browses Shifts page
2. **Volunteer** clicks shift and RSVPs
3. **If auto-confirm is enabled:** Volunteer is automatically confirmed
   - **If auto-confirm is disabled:**
     - a. Coordinator sees pending RSVP on dashboard
     - b. Coordinator opens shift roster and confirms the RSVP
4. **Volunteer** sees shift on their dashboard

> **Note:** Auto-confirm can be enabled in Admin → Settings

### Workflow: Coordinator Creates a Patrol Shift

1. **Coordinator** clicks "Create Shift"
2. **Coordinator** selects "Zone Patrol" type
3. **Coordinator** chooses zone, date, time, capacity
4. **Coordinator** adds description with special instructions
5. **Coordinator** saves the shift
6. Shift appears for all volunteers to RSVP

### Workflow: Coordinator Edits an Existing Shift

1. **Coordinator** navigates to Shifts page
2. **Coordinator** finds the shift in the list
3. **Coordinator** clicks "Edit" link
4. **Coordinator** updates needed fields (time, capacity, description, etc.)
5. **Coordinator** clicks "Save Changes"
6. Updates are immediately visible to volunteers

### Workflow: Assigning a Zone Lead

1. **Coordinator** opens shift roster
2. **Coordinator** finds confirmed volunteer
3. **Coordinator** clicks "Assign as Zone Lead"
4. Zone Lead designation appears on schedule view
5. **Zone Lead** can see their assignment on dashboard

### Workflow: New Volunteer Onboarding

1. **Admin** creates volunteer account (or imports via CSV)
2. **Volunteer** logs in for first time
3. **Volunteer** sees welcome screen with overview
4. **Volunteer** completes required Basic Training
5. **Volunteer** can now RSVP to shifts requiring that training

### Workflow: Confirming Multiple RSVPs

1. **Coordinator** opens shift roster
2. **Coordinator** reviews pending RSVPs
3. **Coordinator** checks boxes for volunteers to confirm
4. **Coordinator** clicks "Confirm Selected"
5. All selected volunteers are confirmed at once

### Workflow: Creating and Assigning Qualified Roles

1. **Admin** navigates to Admin → Qualified Roles
2. **Admin** clicks "Add Qualified Role"
3. **Admin** enters name (e.g., "Field Medic"), description, and color
4. **Admin** saves the new role
5. **Admin** optionally links it to a Training Type (in Training Types admin) to auto-grant
6. **Admin** can manually assign to volunteers via the Volunteers page
7. Volunteers with the qualified role can now sign up for shifts requiring it

### Workflow: Configuring a Shadow Role

1. **Admin** navigates to Admin → Qualified Roles
2. **Admin** clicks "Add Qualified Role" or edits existing role
3. **Admin** enters name (e.g., "Shadower" or "Observer")
4. **Admin** unchecks "Counts toward shift minimum"
5. **Admin** saves the role
6. Volunteers with this role can attend shifts but won't count toward the minimum required volunteers
7. The role appears with a "Shadow" badge in the admin list

### Workflow: Sending a Schedule Announcement

1. **Coordinator** clicks "Send Email Blast" on dashboard
2. **Coordinator** selects "Schedule Announcement" template
3. **Coordinator** reviews/edits the default message
4. **Coordinator** optionally filters by zone or role
5. **Coordinator** sets date range for shifts to include (defaults to next 14 days)
6. **Coordinator** previews recipient count
7. **Coordinator** clicks "Send"
8. Each volunteer receives personalized email with their zone's shifts

### Workflow: Announcing New Training Sessions

1. **Coordinator** clicks "Send Email Blast" on dashboard
2. **Coordinator** selects "Training Announcement" template
3. **Coordinator** customizes the message about the trainings
4. **Coordinator** filters to volunteers who need the training (optional)
5. **Coordinator** sets date range for sessions to include
6. **Coordinator** sends the blast
7. Volunteers receive email with upcoming training table and RSVP link

### Workflow: Setting Up a New Zone with Boundaries

1. **Admin** navigates to Admin → Mapping
2. **Admin** stays on the Zones tab (default)
3. **Admin** clicks "Add Zone"
4. **Admin** enters zone name, selects county, adds description
5. **Admin** optionally adds Signal Group link for coordination
6. **Admin** selects a color for the zone on maps
7. **Admin** clicks "Create Zone"
8. **Admin** clicks "Draw Map" next to the new zone
9. **Admin** draws polygon boundaries on the interactive map
10. **Admin** saves boundaries
11. Zone appears on coverage maps with correct boundaries and color

### Workflow: Adding Points of Interest

1. **Admin** navigates to Admin → Mapping
2. **Admin** clicks "Points of Interest" tab
3. **Admin** clicks "Add POI"
4. **Admin** enters name and description
5. **Admin** selects appropriate category (e.g., ICE/Enforcement, School)
6. **Admin** uses map picker to set exact location
7. **Admin** optionally assigns to a specific zone
8. **Admin** saves the POI
9. POI appears on volunteer maps with category color/icon

---

## Tips & Best Practices

### For Volunteers

- Keep your profile updated with current contact info
- RSVP early - popular shifts fill up quickly
- Complete all required trainings to unlock more shift types
- Check your dashboard regularly for schedule changes

### For Coordinators

- Review pending RSVPs daily to keep volunteers informed
- Use bulk confirmation to save time with multiple RSVPs
- Assign zone leads early so they can prepare
- Add clear descriptions to shifts with special requirements
- Use Schedule Announcement emails to notify volunteers of new shifts
- Training Announcement automatically includes upcoming sessions

### For Dispatchers

- Check the schedule view at the start of each day
- Know which zone leads are on duty
- Keep contact info handy for active volunteers

### For Administrators

- Regularly review volunteer status and engagement
- Keep zone and training configurations up to date
- Use bulk import for onboarding multiple volunteers
- Monitor system usage to identify needs

---

## Getting Help

- Click the **?** button in the header for page-specific help
- Select "Restart Page Tour" to see the guided tour again
- Contact your coordinator for shift or scheduling questions
- Contact an administrator for account or access issues

---

*Last updated: December 2025*
