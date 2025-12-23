# RippleVMS Knowledge Graph

A comprehensive visualization of the system architecture, component relationships, and data flows within the Volunteer Management System.

---

## Table of Contents

1. [System Overview](#system-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [Database Entity Relationships](#database-entity-relationships)
4. [Module Dependency Graph](#module-dependency-graph)
5. [API Route Map](#api-route-map)
6. [Component Hierarchy](#component-hierarchy)
7. [Data Flow Diagrams](#data-flow-diagrams)
8. [Feature Interdependencies](#feature-interdependencies)

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              RIPPLE VMS                                      │
│                    Volunteer Management System                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  Tech Stack: Next.js 15.5.9 | Prisma ORM | PostgreSQL (Neon) | TypeScript    │
│  Auth: NextAuth.js v5 | Email: AWS SES | Storage: Vercel Blob | Maps: Google │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Statistics
- **142** TypeScript/TSX files
- **~30,500** lines of code
- **25** React components
- **47+** API routes
- **24** database models

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐    │
│  │   Dashboard  │  │    Shifts    │  │  Trainings   │  │  Sightings   │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         │                 │                 │                 │             │
│  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐  ┌──────┴───────┐    │
│  │  Volunteers  │  │   Schedule   │  │     Map      │  │    Admin     │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘    │
│         └──────────────────┴─────────────────┴─────────────────┘            │
│                                    │                                         │
├────────────────────────────────────┼────────────────────────────────────────┤
│                              COMPONENT LAYER                                 │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                    │                                         │
│  ┌─────────────┐  ┌─────────────┐  │  ┌─────────────┐  ┌─────────────┐     │
│  │   Layout    │  │    Maps     │──┼──│  Schedule   │  │ Onboarding  │     │
│  │Components  │  │ Components  │  │  │ Components  │  │ Components  │     │
│  └─────────────┘  └─────────────┘  │  └─────────────┘  └─────────────┘     │
│                                    │                                         │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                API LAYER                                     │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                    │                                         │
│  ┌────────────────────────────────┐│┌────────────────────────────────┐      │
│  │         /api/shifts           │││        /api/trainings          │      │
│  │  ├─ [id]/rsvp                 │││  ├─ [id]/rsvp                   │      │
│  │  ├─ [id]/add-volunteer        │││  ├─ confirm-rsvps               │      │
│  │  └─ confirm-rsvps             │││  └─ cancel                      │      │
│  └────────────────────────────────┘│└────────────────────────────────┘      │
│                                    │                                         │
│  ┌────────────────────────────────┐│┌────────────────────────────────┐      │
│  │        /api/sightings         │││        /api/volunteers          │      │
│  │  └─ [id]                      │││  └─ [id]                        │      │
│  └────────────────────────────────┘│└────────────────────────────────┘      │
│                                    │                                         │
│  ┌────────────────────────────────┐│┌────────────────────────────────┐      │
│  │         /api/admin            │││        /api/profile             │      │
│  │  ├─ settings                  │││  ├─ zones                       │      │
│  │  ├─ zones                     │││  └─ availability                │      │
│  │  ├─ shift-types               │││                                 │      │
│  │  ├─ training-types            │││┌────────────────────────────────┐      │
│  │  ├─ qualified-roles           │││        /api/auth                │      │
│  │  ├─ pois                      │││  ├─ [...nextauth]               │      │
│  │  └─ email-blast               │││  ├─ forgot-password             │      │
│  └────────────────────────────────┘││  └─ reset-password             │      │
│                                    │└────────────────────────────────┘      │
├────────────────────────────────────┼────────────────────────────────────────┤
│                              SERVICE LAYER                                   │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                    │                                         │
│  ┌─────────────┐  ┌─────────────┐  │  ┌─────────────┐  ┌─────────────┐     │
│  │   lib/db    │  │  lib/user   │──┼──│  lib/auth   │  │  lib/email  │     │
│  │   Prisma    │  │  getDbUser  │  │  │  Session    │  │   AWS SES   │     │
│  └──────┬──────┘  └─────────────┘  │  └─────────────┘  └─────────────┘     │
│         │                          │                                         │
│  ┌──────┴──────┐  ┌─────────────┐  │  ┌─────────────┐                       │
│  │   lib/s3    │  │lib/features │──┼──│  lib/tours  │                       │
│  │ File Upload │  │Feature Flags│  │  │  Onboarding │                       │
│  └─────────────┘  └─────────────┘  │  └─────────────┘                       │
│                                    │                                         │
├────────────────────────────────────┼────────────────────────────────────────┤
│                              DATA LAYER                                      │
├────────────────────────────────────┼────────────────────────────────────────┤
│                                    │                                         │
│                     ┌──────────────┴──────────────┐                         │
│                     │     PostgreSQL (Neon)       │                         │
│                     │     24 Prisma Models        │                         │
│                     └─────────────────────────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              EXTERNAL SERVICES
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   AWS SES   │  │ Vercel Blob │  │ Google Maps │  │   NextAuth  │        │
│  │    Email    │  │   Storage   │  │     API     │  │    Auth     │        │
│  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘        │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Entity Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CORE USER & ORGANIZATION                              │
└─────────────────────────────────────────────────────────────────────────────┘

                        ┌────────────────────────┐
                        │  OrganizationSettings  │
                        │  (Singleton Config)    │
                        └────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   ┌────────────┐         ┌───────────┐         ┌────────────────┐           │
│   │    User    │◄────────│  UserZone │────────►│      Zone      │           │
│   │            │   N:M   │(junction) │   N:M   │                │           │
│   │ - email    │         │-isPrimary │         │ - name         │           │
│   │ - name     │         └───────────┘         │ - county       │           │
│   │ - role     │                               │ - boundaries   │           │
│   │ - phone    │                               │ - color        │           │
│   └─────┬──────┘                               └───────┬────────┘           │
│         │                                              │                     │
│         │ 1:N                                          │ 1:N                 │
│         ▼                                              ▼                     │
│   ┌─────────────────┐                          ┌───────────────┐            │
│   │UserQualification│                          │PointOfInterest│            │
│   │                 │                          │               │            │
│   │ - earnedAt      │                          │ - name        │            │
│   │ - expiresAt     │                          │ - lat/lng     │            │
│   └────────┬────────┘                          │ - address     │            │
│            │ N:1                               └───────┬───────┘            │
│            ▼                                           │ N:1                 │
│   ┌─────────────────┐                          ┌───────▼───────┐            │
│   │  QualifiedRole  │                          │  POICategory  │            │
│   │                 │                          │               │            │
│   │ - name          │                          │ - name        │            │
│   │ - description   │                          │ - icon        │            │
│   └─────────────────┘                          └───────────────┘            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           SHIFT MANAGEMENT                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   ┌─────────────────────┐                                                    │
│   │   ShiftTypeConfig   │ ◄─────────────────────────────────────┐           │
│   │                     │                                        │           │
│   │ - name              │   (Shift.typeConfigId → N:1)          │           │
│   │ - slug              │                                        │           │
│   │ - color             │                                        │           │
│   │ - minVolunteers     │                                        │           │
│   │ - maxVolunteers     │                                        │           │
│   └──────────┬──────────┘                                        │           │
│              │ 1:N                                                │           │
│              ▼                                                    │           │
│   ┌──────────────────────────────────┐                           │           │
│   │ ShiftTypeQualifiedRoleRequirement│                           │           │
│   │                                  │                           │           │
│   │ - minCount                       │─────────────►┌─────────────────┐     │
│   │ - maxCount                       │     N:1      │  QualifiedRole  │     │
│   └──────────────────────────────────┘              └─────────────────┘     │
│                                                                              │
│   ┌─────────────────┐       ┌───────────────────┐       ┌─────────────┐     │
│   │      User       │◄──────│   ShiftVolunteer  │──────►│    Shift    │─────┘
│   │                 │  N:1  │    (junction)     │  N:1  │             │
│   └─────────────────┘       │                   │       │ - date      │
│                             │ - status          │       │ - startTime │
│                             │ - isZoneLead      │       │ - endTime   │
│                             │ - checkInAt       │       │ - status    │
│                             │ - checkOutAt      │       │ - type      │
│                             │ - qualifiedRoleId │       │ - typeConfigId
│                             └───────────────────┘       └──────┬──────┘     │
│                                                                │ N:1        │
│                                                                ▼            │
│                                                         ┌─────────────┐     │
│                                                         │    Zone     │     │
│                                                         └─────────────┘     │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           TRAINING SYSTEM                                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   ┌─────────────────┐         ┌────────────────────┐                        │
│   │  TrainingType   │────────►│  TrainingSession   │                        │
│   │                 │   1:N   │                    │                        │
│   │ - name          │         │ - date             │                        │
│   │ - duration      │         │ - startTime        │                        │
│   │ - capacity      │         │ - endTime          │                        │
│   │ - expiresAfter  │         │ - location         │                        │
│   └────────┬────────┘         │ - capacity         │                        │
│            │ N:M              │ - status           │                        │
│            ▼                  └─────────┬──────────┘                        │
│   ┌─────────────────┐                   │ 1:N                               │
│   │  QualifiedRole  │                   ▼                                   │
│   │  (grants upon   │         ┌────────────────────────┐                    │
│   │   completion)   │         │ TrainingSessionAttendee │                    │
│   └─────────────────┘         │                        │                    │
│                               │ - status               │─────►┌──────────┐  │
│                               │ - confirmedAt          │ N:1  │   User   │  │
│                               │ - attendedAt           │      └──────────┘  │
│                               │ - completedAt          │                    │
│                               └────────────────────────┘                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          INCIDENT REPORTING                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   ┌─────────────────────────┐         ┌────────────────────┐                │
│   │      IceSighting        │────────►│   SightingMedia    │                │
│   │      (S.A.L.U.T.E.)     │   1:N   │                    │                │
│   │                         │         │ - url              │                │
│   │ - size                  │         │ - type (IMG/VID)   │                │
│   │ - activity              │         │ - caption          │                │
│   │ - location              │         └────────────────────┘                │
│   │ - uniform               │                                                │
│   │ - time                  │                                                │
│   │ - equipment             │                                                │
│   │ - latitude/longitude    │                                                │
│   │ - status                │                                                │
│   │ - reporterName (opt)    │                                                │
│   │ - reporterPhone (opt)   │                                                │
│   └─────────────────────────┘                                                │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        AVAILABILITY & SCHEDULING                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   ┌─────────────┐         ┌─────────────────────────┐                       │
│   │    User     │────────►│      Availability       │                       │
│   │             │   1:N   │                         │                       │
│   └─────────────┘         │ - dayOfWeek (recurring) │                       │
│                           │ - startTime             │                       │
│                           │ - endTime               │                       │
│                           │ - specificDate (except) │                       │
│                           │ - shiftTypes            │                       │
│                           └─────────────────────────┘                       │
│                                                                              │
│   ┌──────────────────────────────────┐                                       │
│   │      DispatcherAssignment        │                                       │
│   │                                  │─────►┌──────────┐                    │
│   │ - county                         │ N:1  │   User   │                    │
│   │ - date                           │      └──────────┘                    │
│   │ - timeBlock                      │                                       │
│   │ - isPrimary / isBackup           │                                       │
│   └──────────────────────────────────┘                                       │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          COVERAGE SYSTEM                                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   ┌─────────────────────────────────┐                                        │
│   │     CoverageConfig              │                                        │
│   │                                 │─────►┌──────────────────┐              │
│   │ - zoneId                        │ N:1  │       Zone       │              │
│   │ - dayOfWeek                     │      └──────────────────┘              │
│   │ - slots (JSON array)            │                                        │
│   │   - startHour                   │                                        │
│   │   - endHour                     │                                        │
│   │   - needsZoneLead               │                                        │
│   │   - needsDispatcher             │                                        │
│   │   - minVols (verifiers)         │                                        │
│   └─────────────────────────────────┘                                        │
│                                                                               │
│   ┌─────────────────────────────────┐                                        │
│   │      CoverageSignup             │                                        │
│   │                                 │─────►┌──────────────────┐              │
│   │ - date                          │ N:1  │       User       │              │
│   │ - startHour                     │      └──────────────────┘              │
│   │ - roleType (ZONE_LEAD,          │                                        │
│   │   DISPATCHER, VERIFIER,         │─────►┌──────────────────┐              │
│   │   COORDINATOR)                  │ N:1  │       Zone       │              │
│   │ - zoneId (null for regional)    │      │  (optional)      │              │
│   │ - status (CONFIRMED/PENDING)    │      └──────────────────┘              │
│   └─────────────────────────────────┘                                        │
│                                                                               │
│   Coverage Scheduling Modes (OrganizationSettings.schedulingMode):           │
│   - SIMPLE: Leaders only (Zone Leads, Dispatchers, Coordinators)             │
│   - FULL: All roles including Verifiers                                      │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                            EMAIL SYSTEM                                      │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                                                                               │
│   ┌─────────────────────┐         ┌─────────────────────────┐               │
│   │     EmailBlast      │────────►│  EmailBlastRecipient    │               │
│   │                     │   1:N   │                         │               │
│   │ - subject           │         │ - email                 │               │
│   │ - body              │         │ - status                │               │
│   │ - templateType      │         │ - sentAt                │               │
│   │ - status            │         └─────────────────────────┘               │
│   │ - filters           │                                                    │
│   └─────────────────────┘                                                    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LIBRARY DEPENDENCIES                                │
└─────────────────────────────────────────────────────────────────────────────┘

                           ┌─────────────────┐
                           │    lib/db.ts    │
                           │  Prisma Client  │
                           └────────┬────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
              ▼                     ▼                     ▼
     ┌────────────────┐   ┌────────────────┐   ┌────────────────┐
     │  lib/user.ts   │   │  lib/auth.ts   │   │  lib/email.ts  │
     │   getDbUser    │   │   getSession   │   │    AWS SES     │
     └────────┬───────┘   └────────────────┘   └────────┬───────┘
              │                                         │
              │           ┌────────────────┐            │
              └──────────►│ All API Routes │◄───────────┘
                          └────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          COMPONENT DEPENDENCIES                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌────────────────────┐                                                   │
│  │   Providers.tsx    │ ──────► SessionProvider, QueryClientProvider      │
│  └─────────┬──────────┘                                                   │
│            │                                                               │
│            ▼                                                               │
│  ┌────────────────────┐                                                   │
│  │  LayoutClient.tsx  │                                                   │
│  └─────────┬──────────┘                                                   │
│            │                                                               │
│     ┌──────┴──────┐                                                       │
│     │             │                                                        │
│     ▼             ▼                                                        │
│  ┌─────────┐  ┌─────────┐                                                 │
│  │ Header  │  │ Footer  │                                                 │
│  └─────────┘  └─────────┘                                                 │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │                         Page Components                             │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │   /shifts    │  │  /trainings  │  │  /sightings  │              │   │
│  │  │              │  │              │  │              │              │   │
│  │  │ Uses:        │  │ Uses:        │  │ Uses:        │              │   │
│  │  │ -ShiftCalendar│ │ -Calendar    │  │ -SightingMap │              │   │
│  │  │ -AssignModal │  │              │  │ -MediaUpload │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  │                                                                     │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │  /volunteers │  │    /map      │  │    /admin    │              │   │
│  │  │              │  │              │  │              │              │   │
│  │  │ Uses:        │  │ Uses:        │  │ Uses:        │              │   │
│  │  │ -ZoneMapModal│  │ -CoverageMap │  │ -ZoneBoundary│              │   │
│  │  │              │  │ -POIMapLayer │  │  Editor      │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └────────────────────────────────────────────────────────────────────┘   │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                        MAP COMPONENT HIERARCHY                               │
└─────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────┐
│                                                                            │
│  ┌────────────────────────┐                                               │
│  │  GoogleMapsProvider    │                                               │
│  └───────────┬────────────┘                                               │
│              │                                                             │
│   ┌──────────┼──────────┬──────────────────┬───────────────────┐          │
│   │          │          │                  │                   │          │
│   ▼          ▼          ▼                  ▼                   ▼          │
│ ┌──────┐ ┌──────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────────┐ │
│ │Cover │ │Location  │ │SightingMap │ │Sightings   │ │ZoneBoundary     │ │
│ │ageMap│ │Picker    │ │            │ │ListMap     │ │Editor           │ │
│ └──────┘ └──────────┘ └────────────┘ └────────────┘ └──────────────────┘ │
│    │                                                                       │
│    └─────────────────► POIMapLayer                                        │
│                                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## API Route Map

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              /api ROUTES                                     │
└─────────────────────────────────────────────────────────────────────────────┘

/api
├── auth/
│   ├── [...nextauth]          # NextAuth handlers (GET/POST)
│   ├── forgot-password        # Request password reset (POST)
│   └── reset-password         # Confirm password reset (POST)
│
├── shifts/
│   ├── [route]                # List/create shifts (GET/POST)
│   ├── [id]/
│   │   ├── [route]            # Get/update shift (GET/PUT)
│   │   ├── rsvp               # RSVP to shift (POST)
│   │   └── add-volunteer      # Admin add volunteer (POST)
│   ├── bulk-edit              # Bulk edit shifts (POST)
│   ├── confirm-rsvps          # Auto-confirm RSVPs (POST)
│   └── cancel                 # Cancel shift (POST)
│
├── trainings/
│   ├── [route]                # List/create sessions (GET/POST)
│   ├── [id]/
│   │   ├── [route]            # Get/update session (GET/PUT)
│   │   └── rsvp               # RSVP to training (POST)
│   ├── confirm-rsvps          # Auto-confirm RSVPs (POST)
│   └── cancel                 # Cancel training (POST)
│
├── sightings/
│   ├── [route]                # List/create sightings (GET/POST) [PUBLIC]
│   └── [id]/
│       └── [route]            # Get/update sighting (GET/PUT)
│
├── volunteers/
│   ├── [route]                # List volunteers (GET)
│   └── [id]/
│       └── [route]            # Get/update volunteer (GET/PUT)
│
├── users/
│   └── qualified              # Get users by qualification (GET)
│
├── admin/
│   ├── settings               # Org settings CRUD (GET/POST/PUT)
│   ├── zones                  # Zone management (GET/POST/PUT/DELETE)
│   ├── shift-types            # Shift type config (GET/POST/PUT/DELETE)
│   ├── training-types         # Training type config (GET/POST/PUT/DELETE)
│   ├── qualified-roles        # Qualified roles (GET/POST/PUT/DELETE)
│   ├── pois                   # POI management (GET/POST/PUT/DELETE)
│   ├── poi-categories         # POI categories (GET/POST/PUT/DELETE)
│   ├── email-blast            # Bulk email (GET/POST)
│   └── email-blast/preview    # Preview email (POST)
│
├── profile/
│   ├── [route]                # User profile (GET/PUT)
│   ├── zones                  # User zones (GET/POST)
│   └── availability           # User availability (GET/POST)
│
├── dispatcher-assignments     # Dispatcher coverage (GET/POST)
├── schedule                   # Calendar data (GET)
├── dashboard                  # Dashboard stats (GET)
├── dashboard/coverage         # Coverage summary stats (GET)
│
├── coverage/
│   ├── week                   # Weekly coverage grid (GET)
│   ├── signup                 # Sign up for coverage slot (POST)
│   └── cancel                 # Cancel coverage signup (POST)
├── pois                       # Public POI data (GET)
├── public/
│   └── zone-stats             # Zone statistics (GET)
├── features                   # Feature flags (GET)
├── feedback                   # User feedback (POST)
├── unsubscribe                # Email opt-out (POST)
├── upload                     # Media upload (POST)
└── settings/
    └── upload                 # Pre-signed URLs (GET)
```

---

## Component Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPONENT TREE                                        │
└─────────────────────────────────────────────────────────────────────────────┘

src/components/
│
├── Providers.tsx              # Root provider wrapper
│   ├── SessionProvider        # NextAuth session
│   └── QueryClientProvider    # React Query
│
├── layout/
│   ├── LayoutClient.tsx       # Main layout wrapper
│   │   ├── Header.tsx         # Navigation bar
│   │   │   └── Role-based menu items
│   │   └── Footer.tsx         # Site footer
│   │
│   └── ClientOnly.tsx         # Hydration boundary
│
├── maps/
│   ├── GoogleMapsProvider.tsx # API key context
│   │
│   ├── CoverageMap.tsx        # Zone map (SSR wrapper)
│   │   └── CoverageMapClient.tsx
│   │       └── POIMapLayer.tsx
│   │
│   ├── LocationPicker.tsx     # Coordinate selector (SSR wrapper)
│   │   └── LocationPickerClient.tsx
│   │
│   ├── SightingMap.tsx        # Single sighting (SSR wrapper)
│   │   └── SightingMapClient.tsx
│   │
│   ├── SightingsListMap.tsx   # Multiple sightings (SSR wrapper)
│   │   └── SightingsListMapClient.tsx
│   │
│   └── ZoneBoundaryEditor.tsx # Admin zone polygon editor
│
├── schedule/
│   ├── ShiftCalendar.tsx      # react-big-calendar wrapper
│   └── AssignmentModal.tsx    # Volunteer assignment dialog
│
├── onboarding/
│   ├── GuidedTour.tsx         # driver.js tour runner
│   ├── HelpButton.tsx         # Floating help trigger
│   ├── HelpDrawer.tsx         # Slide-out help panel
│   └── WelcomeScreen.tsx      # New user modal
│
├── MediaUploader.tsx          # File upload UI
├── ZoneMapModal.tsx           # Zone detail popup
└── FeedbackWidget.tsx         # Feedback form
```

---

## Data Flow Diagrams

### Authentication Flow

```
┌─────────┐     ┌─────────────┐     ┌─────────────┐     ┌──────────┐
│  User   │────►│ /login page │────►│  NextAuth   │────►│ Database │
│         │     │             │     │  Callback   │     │  (User)  │
└─────────┘     └─────────────┘     └──────┬──────┘     └────┬─────┘
                                           │                  │
                                           │  Verify bcrypt   │
                                           │◄─────────────────┘
                                           │
                                    ┌──────▼──────┐
                                    │  JWT Token  │
                                    │  Created    │
                                    └──────┬──────┘
                                           │
                      ┌────────────────────┼────────────────────┐
                      │                    │                    │
                      ▼                    ▼                    ▼
               ┌────────────┐       ┌────────────┐       ┌────────────┐
               │  Session   │       │ Middleware │       │ API Routes │
               │  Provider  │       │ Protection │       │ getDbUser()│
               └────────────┘       └────────────┘       └────────────┘
```

### Shift Workflow

```
┌────────────────┐
│  Coordinator   │
│  Creates Shift │
└───────┬────────┘
        │
        ▼
┌───────────────────┐     ┌──────────────────┐
│  Shift (DRAFT)    │────►│  Publish Shift   │
│                   │     │  (status change) │
└───────────────────┘     └────────┬─────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
            │ Email Invite│ │ Matching     │ │ Shift shown  │
            │ Sent to     │ │ Volunteers   │ │ on Calendar  │
            │ Volunteers  │ │ Notified     │ │              │
            └─────────────┘ └──────┬───────┘ └──────────────┘
                                   │
                            ┌──────▼──────┐
                            │  Volunteer  │
                            │   RSVPs     │
                            └──────┬──────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
            ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
            │   PENDING   │ │   CONFIRMED  │ │   DECLINED   │
            │  (awaiting) │ │  (auto or    │ │              │
            │             │ │   manual)    │ │              │
            └──────┬──────┘ └──────┬───────┘ └──────────────┘
                   │               │
                   │  Auto-confirm │
                   │  if enabled   │
                   └───────┬───────┘
                           │
                    ┌──────▼──────┐
                    │ Shift Day   │
                    │             │
                    │ Check In    │
                    │ Check Out   │
                    └──────┬──────┘
                           │
                    ┌──────▼──────┐
                    │  COMPLETED  │
                    └─────────────┘
```

### Training & Qualification Flow

```
┌────────────────────┐
│  Admin Creates     │
│  TrainingType      │
│  (grants roles)    │
└─────────┬──────────┘
          │
          ▼
┌────────────────────┐     ┌──────────────────┐
│  Coordinator       │────►│  TrainingSession │
│  Schedules Session │     │  Created         │
└────────────────────┘     └────────┬─────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
            ┌─────────────┐ ┌──────────────┐ ┌──────────────┐
            │ Email Invite│ │ Volunteers   │ │ Session on   │
            │ Sent        │ │ RSVP         │ │ Calendar     │
            └─────────────┘ └──────┬───────┘ └──────────────┘
                                   │
                            ┌──────▼──────┐
                            │  Attendance │
                            │  Tracked    │
                            └──────┬──────┘
                                   │
                            ┌──────▼──────┐
                            │  Completed  │
                            │  Status     │
                            └──────┬──────┘
                                   │
                            ┌──────▼──────────────┐
                            │  UserQualification  │
                            │  Created            │
                            │  (role granted)     │
                            └─────────────────────┘
```

### ICE Sighting Report Flow

```
┌─────────────────┐
│  Public User    │
│  (no auth req)  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────┐
│  /(public)/report Page      │
│                             │
│  S.A.L.U.T.E. Form:         │
│  - Size                     │
│  - Activity                 │
│  - Location (map picker)    │
│  - Uniform                  │
│  - Time                     │
│  - Equipment                │
│                             │
│  + Optional Media Upload    │
│  + Optional Contact Info    │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  POST /api/sightings        │
│  (public endpoint)          │
└────────────┬────────────────┘
             │
      ┌──────┴──────┐
      │             │
      ▼             ▼
┌──────────┐  ┌────────────────┐
│IceSighting│  │ SightingMedia  │
│ Created   │  │ (Vercel Blob)  │
│ (NEW)     │  │                │
└─────┬─────┘  └────────────────┘
      │
      ▼
┌─────────────────────────────┐
│  Email Alert Sent to        │
│  All Dispatchers            │
└────────────┬────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  Dispatcher Dashboard       │
│  (/sightings)               │
└────────────┬────────────────┘
             │
     ┌───────┼───────┐
     │       │       │
     ▼       ▼       ▼
┌────────┐ ┌─────┐ ┌──────────┐
│REVIEWING│ │VERI │ │RESPONDED │
│        │ │FIED │ │          │
└────────┘ └─────┘ └────┬─────┘
                        │
                        ▼
                   ┌─────────┐
                   │ CLOSED  │
                   └─────────┘
```

---

## Feature Interdependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FEATURE DEPENDENCY MATRIX                            │
└─────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────────────────────────┐
                    │                    CORE FEATURES                         │
                    └─────────────────────────────────────────────────────────┘
                                           │
         ┌─────────────────────────────────┼─────────────────────────────────┐
         │                                 │                                 │
         ▼                                 ▼                                 ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│  User & Auth    │              │  Zone System    │              │  Org Settings   │
│                 │              │                 │              │                 │
│ - User model    │◄────────────►│ - Zone model    │◄────────────►│ - Branding      │
│ - Roles         │              │ - Boundaries    │              │ - Email config  │
│ - Qualifications│              │ - UserZone      │              │ - Feature flags │
└────────┬────────┘              └────────┬────────┘              └────────┬────────┘
         │                                │                                 │
         │    ┌───────────────────────────┼───────────────────────────┐     │
         │    │                           │                           │     │
         ▼    ▼                           ▼                           ▼     ▼
┌─────────────────┐              ┌─────────────────┐              ┌─────────────────┐
│  Shift System   │              │ Training System │              │ Sighting System │
│                 │              │  (Feature Flag) │              │  (Feature Flag) │
│ Depends on:     │              │                 │              │                 │
│ - Users         │              │ Depends on:     │              │ Depends on:     │
│ - Zones         │              │ - Users         │              │ - Zones (map)   │
│ - Qualifications│              │ - Qualifications│              │ - Email         │
│ - Email         │              │ - Email         │              │ - File storage  │
└────────┬────────┘              └────────┬────────┘              └─────────────────┘
         │                                │
         │                                │
         ▼                                ▼
┌─────────────────┐              ┌─────────────────┐
│  Availability   │              │   Calendar      │
│                 │              │                 │
│ Depends on:     │              │ Depends on:     │
│ - Users         │              │ - Shifts        │
│                 │              │ - Trainings     │
└─────────────────┘              │ - Availability  │
                                 └─────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           CROSS-CUTTING CONCERNS                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Logging/Audit  │    │  Rate Limiting  │    │  IP Privacy     │
│                 │    │                 │    │                 │
│ - SystemLog     │    │ - Upstash Redis │    │ - IPs hashed    │
│ - AuditLog      │    │ - In-memory     │    │   SHA-256+salt  │
│ - IP hashing    │    │   fallback      │    │ - Pattern detect│
│                 │    │                 │    │   preserved     │
│ Provider:       │    │ Provider:       │    │ Env var:        │
│ - lib/logger.ts │    │ - lib/rate-     │    │ - IP_HASH_SALT  │
│ - lib/audit.ts  │    │   limit.ts      │    │ - lib/logger.ts │
└─────────────────┘    └─────────────────┘    └─────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Email System   │    │  Map System     │    │  File Storage   │
│                 │    │                 │    │                 │
│ Used by:        │    │ Used by:        │    │ Used by:        │
│ - Shifts        │    │ - Coverage map  │    │ - Sightings     │
│ - Trainings     │    │ - Sightings     │    │   (media)       │
│ - Sightings     │    │ - Location pick │    │                 │
│ - Auth (reset)  │    │ - Zone admin    │    │ Provider:       │
│ - Email blasts  │    │ - POI display   │    │ - Vercel Blob   │
│                 │    │                 │    │ - AWS S3        │
│ Provider:       │    │ Provider:       │    │                 │
│ - AWS SES       │    │ - Google Maps   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Role-Based Access Matrix

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROLE PERMISSIONS                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Feature/Action          │ VOLUNTEER │ COORDINATOR │ DISPATCHER │ ADMINISTRATOR
────────────────────────┼───────────┼─────────────┼────────────┼───────────────
View Dashboard          │     ✓     │      ✓      │     ✓      │      ✓
View Shifts             │     ✓     │      ✓      │     ✓      │      ✓
RSVP to Shifts          │     ✓     │      ✓      │     ✓      │      ✓
Create Shifts           │           │      ✓      │     ✓      │      ✓
Edit Shifts             │           │      ✓      │     ✓      │      ✓
Add Volunteers to Shift │           │      ✓      │     ✓      │      ✓
View Trainings          │     ✓     │      ✓      │     ✓      │      ✓
RSVP to Trainings       │     ✓     │      ✓      │     ✓      │      ✓
Create Trainings        │           │      ✓      │     ✓      │      ✓
View Volunteer Roster   │           │      ✓      │     ✓      │      ✓
Edit Volunteers         │           │      ✓      │     ✓      │      ✓
View Sightings          │           │             │     ✓      │      ✓
Manage Sightings        │           │             │     ✓      │      ✓
Dispatcher Assignments  │           │             │     ✓      │      ✓
Admin Settings          │           │             │            │      ✓
Zone Management         │           │             │            │      ✓
Shift/Training Types    │           │             │            │      ✓
Qualified Roles         │           │             │            │      ✓
POI Management          │           │             │            │      ✓
Email Blasts            │           │             │            │      ✓
Feature Flags           │           │             │            │      ✓
────────────────────────┴───────────┴─────────────┴────────────┴───────────────
```

---

## Key File Locations

| Category | Path | Purpose |
|----------|------|---------|
| **Entry Point** | `src/app/layout.tsx` | Root layout |
| **Auth Config** | `auth.ts`, `auth.config.ts` | NextAuth setup |
| **Middleware** | `middleware.ts` | Route protection |
| **Database** | `prisma/schema.prisma` | Data models |
| **Prisma Client** | `src/lib/db.ts` | DB connection |
| **User Helpers** | `src/lib/user.ts` | Auth utilities |
| **Logging** | `src/lib/logger.ts` | System logs with IP hashing |
| **Email Service** | `src/lib/email.ts` | AWS SES templates |
| **File Upload** | `src/lib/s3.ts` | S3/Blob storage |
| **Feature Flags** | `src/lib/features.ts` | Toggle features |
| **Types** | `src/types/auth.ts` | Role/qual types |
| **Components** | `src/components/` | Reusable UI |
| **API Routes** | `src/app/api/` | Backend endpoints |
| **Pages** | `src/app/` | Frontend routes |

---

## External Service Integration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL SERVICE MAP                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────────┐
│                           RippleVMS Application                             │
└───────────────────────────────────┬────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│    Neon       │         │   AWS SES     │         │  Vercel Blob  │
│  PostgreSQL   │         │    Email      │         │   Storage     │
│               │         │               │         │               │
│ DATABASE_URL  │         │ AWS_REGION    │         │ Auto-config   │
│               │         │ AWS_ACCESS_KEY│         │ on Vercel     │
│               │         │ AWS_SECRET_KEY│         │               │
│ Features:     │         │               │         │ Features:     │
│ - Serverless  │         │ Features:     │         │ - CDN         │
│ - Branching   │         │ - Templates   │         │ - Pre-signed  │
│ - Pooling     │         │ - Tracking    │         │   URLs        │
└───────────────┘         └───────────────┘         └───────────────┘

┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│  Google Maps  │         │   NextAuth    │         │    Vercel     │
│     API       │         │    (Auth)     │         │   Hosting     │
│               │         │               │         │               │
│ GOOGLE_MAPS_  │         │ NEXTAUTH_URL  │         │ Deployment    │
│ API_KEY       │         │ NEXTAUTH_     │         │ targets:      │
│               │         │ SECRET        │         │ - Preview     │
│ Features:     │         │               │         │ - Production  │
│ - Zone bounds │         │ Features:     │         │               │
│ - POI markers │         │ - JWT tokens  │         │ Commands:     │
│ - Location    │         │ - Credentials │         │ - vercel      │
│   picker      │         │   provider    │         │ - vercel      │
│               │         │ - Session     │         │   --prod      │
└───────────────┘         └───────────────┘         └───────────────┘
```

---

*Generated: December 2025*
*RippleVMS v1.2 - Coverage System with SIMPLE/FULL Scheduling Modes*
