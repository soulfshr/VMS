# RippleVMS Demo Script

**Total Runtime:** ~8-10 minutes
**Recommended:** Record in 1080p, use a clean browser window (incognito mode)

---

## Scene 1: Public Landing & About (45 sec)

**URL:** https://ripple-vms.com

**Show:**
- Landing page hero with RippleVMS branding
- Scroll to feature highlights
- Click "About" page

**Talking Points:**
- "RippleVMS is a volunteer management system built for community rapid response networks"
- "Fully mobile-responsive for volunteers in the field"

---

## Scene 2: Public ICE Sighting Report (1 min)

**URL:** https://ripple-vms.com/report

**Show:**
- Anonymous reporting form
- S.A.L.U.T.E. format fields (Size, Activity, Location, etc.)
- Location picker with map
- Media upload capability

**Talking Points:**
- "Community members can submit reports anonymously - no login required"
- "Uses military S.A.L.U.T.E. format for consistent, actionable intelligence"
- "Reports go directly to dispatchers for rapid response"

---

## Scene 3: Volunteer Login & Dashboard (1 min)

**Login as:** A volunteer account

**Show:**
- Login page
- Dashboard with:
  - Upcoming shifts widget
  - Quick action buttons
- Point out the welcome banner for new users

**Talking Points:**
- "Volunteers see their personalized dashboard immediately after login"
- "At-a-glance view of their upcoming commitments"

> **Note:** ICE Sightings widget is visible to Dispatchers and Coordinators, not basic volunteers

---

## Scene 4: Browsing & Signing Up for Shifts (1.5 min)

**URL:** /shifts

**Show:**
- Shift list view with filters (type, zone)
- Toggle between list and card views
- Click into a shift detail page
- Click "Sign Up" button
- Show confirmation status

**Talking Points:**
- "Volunteers can browse all available shifts filtered by zone or type"
- "One-click signup with automatic confirmation emails"
- "Calendar invites sent automatically"

---

## Scene 5: Interactive Map (45 sec)

**URL:** /map

**Show:**
- Full coverage map with zone boundaries
- POI markers (schools, safe spaces, enforcement locations)
- Click a POI to see details
- Hover over zones to see names

**Talking Points:**
- "Interactive map shows all coverage zones across the Triangle"
- "Points of interest help volunteers navigate their patrol areas"
- "Zone boundaries drawn by coordinators"

---

## Scene 6: Weekly Schedule View (45 sec)

**URL:** /schedule

**Login as:** Dispatcher or Coordinator

**Show:**
- Calendar grid view
- Dispatch Coordinator row (if populated)
- Dispatcher coverage row (varies by scheduling mode)
- Click into a day to see shift details

**Talking Points:**
- "Weekly schedule gives dispatchers and coordinators a bird's-eye view"
- "See coverage gaps at a glance"
- "Dispatcher and Dispatch Coordinator assignments visible here"
- "Dispatchers and Coordinators have identical access to all scheduling features"

---

## Scene 7: Coordinator/Dispatcher Tools (2 min)

**Login as:** Coordinator or Dispatcher account (both have identical access)

**Show:**
1. **Create Shift** (/shifts/create)
   - Fill out form quickly
   - Show zone selection, volunteer limits

2. **Shift Roster** (/shifts/[id]/roster)
   - View signed-up volunteers
   - Confirm pending RSVPs

3. **Multi-select & Bulk Actions on Shifts page**
   - Check "Select All" checkbox in table header
   - Show bulk actions toolbar
   - Demonstrate "Edit Selected" - change shift type or time
   - Demonstrate "Cancel Selected" action

4. **Cancelled Shift Notification** (switch to volunteer view)
   - Show dashboard with cancelled shift
   - Point out red "Cancelled" badge and strikethrough
   - Click X to dismiss from dashboard
   - "Volunteers see cancelled shifts clearly and can dismiss them"

**Talking Points:**
- "Dispatchers and Coordinators have full access to all shift management tools"
- "Create shifts in under a minute"
- "Manage RSVPs and confirm volunteers directly"
- "Bulk actions for efficiency - edit, confirm, or cancel multiple shifts at once"
- "Bulk edit lets you change shift types, times, or volunteer limits across many shifts"
- "When shifts are cancelled, volunteers see it immediately with clear visual indicators"
- "Cancellation emails are sent automatically to all signed-up volunteers"

---

## Scene 8: Coordinator Console (1 min)

**URL:** /coordinator

**Login as:** Coordinator or Dispatcher (both have access)

**Show:**
1. **Email Blast** (/coordinator/email-blast)
   - Select template type
   - Choose recipients by zone/role
   - Preview email

2. **Mapping** (/coordinator/mapping)
   - Zones tab with boundary status
   - POIs tab - add/edit locations

3. **ICE Sightings** (navigate to /sightings from header)
   - Show sighting list with status filters
   - Click into a sighting detail
   - Update status (Reviewing → Verified → Responded)

**Talking Points:**
- "Both Dispatchers and Coordinators have full access to the Coordinator Console"
- "Send targeted email blasts to volunteers by zone or shift"
- "Manage map data - add new points of interest as you discover them"
- "View and manage ICE sighting reports - update status as response progresses"

---

## Scene 9: Admin Settings (1 min)

**Login as:** Administrator

**URL:** /admin

**Show:**
- Admin dashboard overview
- **Settings** - Organization branding
- **Zones** - Zone management
- **Qualified Roles** - Show roles like Verifier, Zone Lead
- **Shift Types** - Custom shift configurations

**Talking Points:**
- "Administrators have full control over system configuration"
- "Custom qualified roles that volunteers can earn through training"
- "Flexible shift types to match your organization's needs"

---

## Scene 10: Volunteer Directory (45 sec)

**URL:** /volunteers

**Login as:** Dispatcher, Coordinator, or Administrator (all have access)

**Show:**
- Searchable volunteer list
- Filter by zone, role, qualifications
- Multi-select with sticky toolbar
- Click into a volunteer profile

**Talking Points:**
- "Complete volunteer directory with search and filters"
- "Accessible to Dispatchers, Coordinators, and Administrators"
- "See qualifications, contact info, and activity history"
- "Bulk actions for volunteer management"

---

## Scene 11: Mobile Experience (30 sec)

**Show:**
- Resize browser to mobile width OR use phone
- Show responsive navigation (hamburger menu)
- Dashboard adapts to mobile
- Shift cards stack vertically

**Talking Points:**
- "Fully responsive - volunteers use this in the field on their phones"
- "All features accessible on mobile"

---

## Optional: Developer Console (30 sec)

**URL:** /developer (if relevant to audience)

**Show:**
- System health monitoring
- Knowledge graph visualization

**Talking Points:**
- "Built-in monitoring for system health"
- "Complete documentation of system architecture"

---

## Closing (15 sec)

**Return to:** Dashboard or landing page

**Talking Points:**
- "RippleVMS - purpose-built for rapid response volunteer coordination"
- "Questions?"

---

## Recording Tips

1. **Prep accounts ahead of time:**
   - One volunteer account with some shift signups
   - One coordinator OR dispatcher account (they have identical permissions)
   - One admin account

   > **Note on roles:** Dispatchers and Coordinators now have harmonized access. You only need to demo one of these roles - they can do everything the other can do, plus Dispatchers have the specialized real-time coordination focus.

2. **Pre-populate data:**
   - Have shifts scheduled for the current/next week
   - Have a few volunteers signed up
   - Have POIs on the map

3. **Browser setup:**
   - Clear browser history/cache
   - Disable browser extensions
   - Use incognito mode
   - Zoom to 100% or 110%

4. **Recording software:**
   - OBS Studio (free)
   - Loom (easy sharing)
   - QuickTime (Mac built-in)

5. **Audio:**
   - Use a decent microphone
   - Record in a quiet room
   - Speak slowly and clearly
