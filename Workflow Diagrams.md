# VMS Workflow Diagrams
**Siembra NC Volunteer Management System**

## Overview

This document provides comprehensive workflow diagrams for all major processes in the VMS. These diagrams show the complete lifecycle of volunteers, shifts, and incidents from initiation through completion.

**Interactive Version:** View the [Interactive HTML Workflow Diagrams](workflows/index.html) for a more detailed, clickable visualization.

---

## Table of Contents

1. [Volunteer Journey Workflow](#1-volunteer-journey-workflow)
2. [Shift Coordination Workflow](#2-shift-coordination-workflow)
3. [Incident Management Workflow](#3-incident-management-workflow)
4. [Training & Certification Workflow](#4-training--certification-workflow)

---

## 1. Volunteer Journey Workflow

Complete lifecycle from registration to active field participation.

```mermaid
flowchart TD
    Start([New Volunteer]) --> Register[Submit Registration Form]
    Register --> EmailVerif{Email Verified?}
    EmailVerif -->|No| WaitEmail[Wait for verification email]
    WaitEmail --> EmailVerif
    EmailVerif -->|Yes| CompleteProfile[Complete Profile & Availability]
    CompleteProfile --> CoordReview{Coordinator<br/>Approves?}
    CoordReview -->|No - Request Info| RequestMore[Request Additional Info]
    RequestMore --> CompleteProfile
    CoordReview -->|Yes| CheckTraining{Training<br/>Complete?}
    CheckTraining -->|No| AttendTraining[Attend Required Training]
    AttendTraining --> CertUpdate[Coordinator Updates Certification]
    CertUpdate --> Activate[Status: Active]
    CheckTraining -->|Yes| Activate
    Activate --> BrowseShifts[Browse Available Shifts]
    BrowseShifts --> SelectShift[Select Shift to RSVP]
    SelectShift --> CheckCapacity{Shift<br/>Full?}
    CheckCapacity -->|Yes| Waitlist[Added to Waitlist]
    CheckCapacity -->|No| Confirmed[RSVP Confirmed]
    Confirmed --> SignalLink[Receive Signal Channel Link]
    SignalLink --> AttendShift[Attend Shift]
    AttendShift --> FieldWork[Complete Field Work]
    FieldWork --> LogActivity[Activity Automatically Logged]
    LogActivity --> BrowseShifts

    style Start fill:#667eea,color:#fff
    style Activate fill:#10b981,color:#fff
    style Confirmed fill:#10b981,color:#fff
    style Waitlist fill:#ef4444,color:#fff
    style SignalLink fill:#2563eb,color:#fff
```

### Key Decision Points

| Decision | Outcomes | Notes |
|----------|----------|-------|
| **Email Verified?** | Yes → Profile Setup<br>No → Wait for verification | Automated verification link sent via Resend |
| **Coordinator Approves?** | Yes → Check Training<br>No → Request More Info | Manual review for safety/compliance |
| **Training Complete?** | Yes → Activate<br>No → Schedule Training | Requires orientation + safety protocols |
| **Shift Full?** | Yes → Waitlist<br>No → Confirmed | Based on max capacity setting |

### System Notifications

- **Registration**: Welcome email + verification link
- **Approval**: Account activated + VMS access instructions
- **Shift RSVP**: Confirmation + calendar invite + Signal group link
- **Reminders**: 24h and 2h before shift

---

## 2. Shift Coordination Workflow

Complete process for creating, staffing, and executing volunteer shifts.

```mermaid
flowchart TD
    Start([Coordinator]) --> CreateShift[Create New Shift]
    CreateShift --> SetDetails[Set Date, Time, Zone,<br/>Min/Max Volunteers]
    SetDetails --> FilterVols[Filter Qualified Volunteers]
    FilterVols --> Decision{Send<br/>Invites?}
    Decision -->|Save Draft| SaveDraft[Shift Saved as Draft]
    Decision -->|Publish| SendInvites[Send Invitations]
    SendInvites --> Notify[Email + In-App Notifications]
    Notify --> VolReceive[Volunteers Receive Invites]
    VolReceive --> VolDecide{Volunteer<br/>Available?}
    VolDecide -->|No| Decline[RSVP: Decline]
    VolDecide -->|Yes| Accept[RSVP: Accept]
    Accept --> CoordMonitor[Coordinator Monitors RSVPs]
    CoordMonitor --> CheckMin{Min<br/>Volunteers<br/>Met?}
    CheckMin -->|No| SendReminder[Send Reminder or Cancel]
    CheckMin -->|Yes| ConfirmShift[Confirm Shift & Lock Roster]
    ConfirmShift --> ShareSignal[Share Signal Channel Link]
    ShareSignal --> Reminders[Auto Reminders Sent]
    Reminders --> ShiftExec[Shift Executed]
    ShiftExec --> PostShift[Post-Shift Review]
    PostShift --> LogComplete[Log Attendance & Notes]

    style Start fill:#8b5cf6,color:#fff
    style SendInvites fill:#10b981,color:#fff
    style ShareSignal fill:#2563eb,color:#fff
    style ConfirmShift fill:#10b981,color:#fff
    style Decline fill:#ef4444,color:#fff
```

### Shift States

| State | Description | Actions Available |
|-------|-------------|-------------------|
| **Draft** | Created but not published | Edit, Delete, Publish |
| **Published** | Invitations sent, accepting RSVPs | Monitor, Remind, Cancel |
| **Confirmed** | Roster locked 24h before | View roster, Share Signal link |
| **Active** | Shift in progress | Real-time updates via Signal |
| **Completed** | Post-shift review | Log attendance, Add notes |

### Notifications

- **Invitation**: Shift details + RSVP link
- **Confirmation**: Calendar invite + Signal channel link
- **Reminders**: 24h and 2h before shift starts
- **Updates**: Shift changes or cancellations

---

## 3. Incident Management Workflow

End-to-end process from sighting report through field verification to Ojo publication.

```mermaid
flowchart TD
    Start([Reporter]) --> SubmitReport[Submit Sighting Report]
    SubmitReport --> IncidentCreated[Incident ID Assigned]
    IncidentCreated --> DispatchAlert[Dispatcher Receives Alert]
    DispatchAlert --> Triage[Dispatcher Reviews & Triages]
    Triage --> Actionable{Actionable<br/>Report?}
    Actionable -->|No| FalseAlarm[Mark as False Alarm]
    FalseAlarm --> NotifyReporter[Notify Reporter]
    Actionable -->|Yes| AssignTeam[Assign Response Team]
    AssignTeam --> CreateSignal[Create Signal Channel]
    CreateSignal --> NotifyTeam[Notify Team: VMS + Signal]
    NotifyTeam --> TeamRespond[Team Receives Assignment]
    TeamRespond --> EnRoute[Update Status: En Route]
    EnRoute --> OnScene[Arrive on Scene]
    OnScene --> Document[Document Findings]
    Document --> Verify{Verified?}
    Verify -->|No - False Alarm| MarkUnverified[Mark as Unverified]
    Verify -->|Inconclusive| MarkInconc[Mark as Inconclusive]
    Verify -->|Yes - Confirmed| MarkVerified[Mark as Verified]
    MarkVerified --> SubmitEvidence[Submit Photos & Notes]
    SubmitEvidence --> OjoReview{Publish<br/>to Ojo?}
    OjoReview -->|Hold| RequestMoreInfo[Request Additional Info]
    RequestMoreInfo --> Document
    OjoReview -->|Approve| DraftAlert[Draft Community Alert]
    DraftAlert --> Publish[Publish to Ojo Platform]
    Publish --> CommunityAlert[Community Receives Alert]
    MarkVerified --> Archive[Archive Incident]
    MarkUnverified --> Archive
    MarkInconc --> Archive
    NotifyReporter --> Archive

    style Start fill:#3b82f6,color:#fff
    style CreateSignal fill:#2563eb,color:#fff
    style MarkVerified fill:#10b981,color:#fff
    style Publish fill:#10b981,color:#fff
    style FalseAlarm fill:#ef4444,color:#fff
```

### Incident Lifecycle

| Status | Description | Next Steps |
|--------|-------------|------------|
| **New** | Just submitted, awaiting triage | Dispatcher reviews within 15 min |
| **Pending Dispatch** | Triaged, awaiting team assignment | Assign available team in zone |
| **Dispatched** | Team assigned and notified | Team updates status via VMS |
| **En Route** | Team traveling to location | Real-time coordination via Signal |
| **On Scene** | Team arrived, investigating | Document findings in VMS mobile |
| **Verified** | Confirmed by field team | Prepare for Ojo publication |
| **Unverified** | False alarm or inconclusive | Archive with notes |
| **Published** | Alert sent to community | Monitor community response |
| **Archived** | Incident closed | Available for analytics |

### Signal + VMS Integration

- **VMS**: Official record, structured data, notifications, Ojo publication
- **Signal**: Real-time encrypted team coordination during active response
- **Handoff**: Dispatcher creates Signal channel when assigning team
- **Documentation**: All findings logged in VMS, Signal used for live updates

---

## 4. Training & Certification Workflow

Volunteer qualification and ongoing professional development.

```mermaid
flowchart TD
    Start([New Volunteer]) --> Register[Complete VMS Registration]
    Register --> Pending[Status: Pending]
    Pending --> Orientation[Attend Orientation]
    Orientation --> SafetyTraining[Complete Safety Protocols]
    SafetyTraining --> InitialCert[Coordinator Marks Complete]
    InitialCert --> Active[Status: Active - Monitor]
    Active --> CanAcceptShifts[Can Now Accept Shifts]

    CanAcceptShifts --> AdvancedDecision{Pursue<br/>Advanced<br/>Training?}
    AdvancedDecision -->|No| StayMonitor[Continue as Monitor]
    AdvancedDecision -->|Yes - Team Lead| TeamLeadTraining[Team Lead Training]
    AdvancedDecision -->|Yes - Dispatcher| DispatcherTraining[Dispatcher Training]

    TeamLeadTraining --> TeamLeadCert[Team Lead Certified]
    DispatcherTraining --> DispatcherCert[Dispatcher Certified]

    TeamLeadCert --> LeadTeams[Can Lead Field Teams]
    DispatcherCert --> HandleIncidents[Can Handle Incident Intake]

    Active --> RenewalCheck{Annual<br/>Recert<br/>Due?}
    RenewalCheck -->|No| Active
    RenewalCheck -->|Yes| RefreshTraining[Attend Refresh Training]
    RefreshTraining --> RenewCert[Certification Renewed]
    RenewCert --> Active

    style Start fill:#3b82f6,color:#fff
    style Active fill:#10b981,color:#fff
    style TeamLeadCert fill:#8b5cf6,color:#fff
    style DispatcherCert fill:#ec4899,color:#fff
    style Pending fill:#f59e0b,color:#fff
```

### Certification Levels

| Level | Requirements | Capabilities | Renewal |
|-------|--------------|--------------|---------|
| **Pending** | Registration submitted | View-only access | N/A |
| **Monitor** | Orientation + Safety Protocols | Accept shifts, report sightings | Annual |
| **Team Lead** | Monitor cert + Team Lead training | Lead field teams, mentor volunteers | Annual |
| **Dispatcher** | Monitor cert + Dispatcher training | Handle incident intake, assign teams | Annual |
| **Coordinator** | Staff role with admin access | Manage volunteers, create shifts | N/A |

### Training Sessions

- **Orientation** (2 hours): VMS overview, mission, values, expectations
- **Safety Protocols** (2 hours): Personal safety, de-escalation, legal rights
- **Team Lead Training** (4 hours): Leadership, coordination, decision-making
- **Dispatcher Training** (4 hours): Incident management, triage, communication
- **Annual Refresh** (1 hour): Policy updates, best practices review

---

## Workflow Characteristics

### Role-Based Access

- **Volunteer**: Submit reports, RSVP to shifts, update profile
- **Coordinator**: Manage volunteers, create shifts, review activity
- **Dispatcher**: Handle incidents, assign teams, coordinate response
- **Administrator**: System configuration, user management, analytics

### Automation Points

1. **Email Verification**: Automated on registration
2. **Shift Reminders**: 24h and 2h before shift
3. **Capacity Tracking**: Auto-update based on RSVPs
4. **Incident Alerts**: Real-time notifications to dispatchers
5. **Activity Logging**: Automatic upon shift completion
6. **Recertification Reminders**: 30 days before expiration

### Integration Touchpoints

- **Signal**: Team coordination channels (incident response, shift coordination)
- **Ojo**: Community alert publication (verified incidents only)
- **Calendar**: Shift confirmations (Google Calendar, iCal)
- **Email**: All notifications (Resend for delivery)

---

## Related Documentation

- **[Interactive Workflow Diagrams](workflows/index.html)** - Detailed HTML visualization with swimlanes
- **[Wireframes](wireframes/index.html)** - Screen mockups for each workflow step
- **[User Roles & Permissions](User%20Roles%20%26%20Permissions.md)** - Complete RBAC specification
- **[Signal Integration Strategy](Signal%20Integration%20Strategy.md)** - VMS + Signal coordination approach
- **[Technical Architecture](Technical%20Architecture.md)** - Implementation details and database schema

---

**Status:** Planning Phase | November 2025

Generated with [Claude Code](https://claude.com/claude-code)
