# Interactive Training Modules

## Overview

Enhance the existing training system to support self-paced, interactive training modules with video content, quizzes, and progress tracking. This builds on the current in-person `TrainingSession` model to add online/asynchronous training capabilities.

## Current State

The VMS currently supports:
- **Training Types** (`TrainingType`) - Categories like Verifier, Zone Lead, Dispatcher
- **Training Sessions** (`TrainingSession`) - Scheduled in-person events with RSVP
- **User Training** (`UserTraining`) - Tracks completion status and expiration
- **Attendance** (`TrainingSessionAttendee`) - Check-in and completion for sessions

**Gap:** No support for self-paced online training with video content or knowledge assessments.

---

## Proposed Features

### 1. Training Module Content
- Video embedding (YouTube, Vimeo, or self-hosted)
- Rich text content sections (markdown or HTML)
- Downloadable resources (PDFs, checklists)
- Estimated completion time

### 2. Quiz/Assessment System
- Multiple choice questions
- True/false questions
- Passing score threshold (e.g., 80%)
- Retake limits or cooldown periods
- Question randomization (optional)

### 3. Progress Tracking
- Module-level progress (started, in-progress, completed)
- Section/video completion tracking
- Quiz attempt history with scores
- Time spent on module
- Certificate generation on completion

### 4. Role-Based Training Paths
- Define required modules per role (Volunteer, Dispatcher, Coordinator)
- Training prerequisites (must complete Module A before Module B)
- Onboarding checklist for new volunteers
- Recertification reminders

---

## Database Schema

### New Models

```prisma
// Online training module (self-paced)
model TrainingModule {
  id                String    @id @default(cuid())
  trainingTypeId    String?   // Optional link to TrainingType for categorization
  trainingType      TrainingType? @relation(fields: [trainingTypeId], references: [id])

  title             String
  slug              String    @unique  // URL-friendly identifier
  description       String?
  thumbnailUrl      String?   // Cover image for module card

  // Content
  estimatedMinutes  Int       @default(30)

  // Requirements
  isRequired        Boolean   @default(false)
  requiredForRoles  Role[]    // Which roles must complete this
  prerequisiteId    String?   // Must complete this module first
  prerequisite      TrainingModule? @relation("ModulePrerequisite", fields: [prerequisiteId], references: [id])
  dependents        TrainingModule[] @relation("ModulePrerequisite")

  // Completion settings
  passingScore      Int       @default(80)  // Quiz passing percentage
  maxAttempts       Int?      // null = unlimited
  retakeCooldownHours Int?    // Hours before retake allowed
  expiresAfterDays  Int?      // Recertification period

  // Status
  isPublished       Boolean   @default(false)
  sortOrder         Int       @default(0)

  // Relationships
  sections          ModuleSection[]
  enrollments       ModuleEnrollment[]

  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt
}

// Content sections within a module
model ModuleSection {
  id              String    @id @default(cuid())
  moduleId        String
  module          TrainingModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  title           String
  sortOrder       Int       @default(0)

  // Content type
  type            SectionType  // VIDEO, TEXT, QUIZ, RESOURCE

  // Video content
  videoUrl        String?      // YouTube/Vimeo embed URL
  videoDuration   Int?         // Duration in seconds

  // Text content
  content         String?      // Markdown or HTML

  // Resource content
  resourceUrl     String?      // Download link
  resourceName    String?      // Display name for download

  // Quiz reference (if type = QUIZ)
  quizId          String?      @unique
  quiz            ModuleQuiz?  @relation(fields: [quizId], references: [id])

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum SectionType {
  VIDEO
  TEXT
  QUIZ
  RESOURCE
}

// Quiz definition
model ModuleQuiz {
  id              String    @id @default(cuid())
  title           String
  description     String?

  // Settings
  timeLimit       Int?      // Minutes, null = no limit
  randomizeOrder  Boolean   @default(false)
  showCorrectAnswers Boolean @default(true)  // Show after submission

  // Relationships
  questions       QuizQuestion[]
  section         ModuleSection?
  attempts        QuizAttempt[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model QuizQuestion {
  id              String    @id @default(cuid())
  quizId          String
  quiz            ModuleQuiz @relation(fields: [quizId], references: [id], onDelete: Cascade)

  text            String    // Question text
  type            QuestionType  // MULTIPLE_CHOICE, TRUE_FALSE
  sortOrder       Int       @default(0)
  points          Int       @default(1)

  // For explanation after answering
  explanation     String?

  // Relationships
  options         QuizOption[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

enum QuestionType {
  MULTIPLE_CHOICE
  TRUE_FALSE
}

model QuizOption {
  id              String    @id @default(cuid())
  questionId      String
  question        QuizQuestion @relation(fields: [questionId], references: [id], onDelete: Cascade)

  text            String
  isCorrect       Boolean   @default(false)
  sortOrder       Int       @default(0)

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

// User enrollment and progress
model ModuleEnrollment {
  id              String    @id @default(cuid())
  userId          String
  moduleId        String

  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  module          TrainingModule @relation(fields: [moduleId], references: [id], onDelete: Cascade)

  status          EnrollmentStatus @default(NOT_STARTED)
  progress        Int       @default(0)  // 0-100 percentage

  startedAt       DateTime?
  completedAt     DateTime?
  expiresAt       DateTime? // When recertification is needed

  // Time tracking
  totalTimeSpent  Int       @default(0)  // Seconds

  // Relationships
  sectionProgress SectionProgress[]
  quizAttempts    QuizAttempt[]

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([userId, moduleId])
}

enum EnrollmentStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  EXPIRED
}

// Track completion of individual sections
model SectionProgress {
  id              String    @id @default(cuid())
  enrollmentId    String
  sectionId       String

  enrollment      ModuleEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)

  completed       Boolean   @default(false)
  completedAt     DateTime?

  // Video progress
  videoProgress   Int?      // Seconds watched

  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([enrollmentId, sectionId])
}

// Quiz attempt history
model QuizAttempt {
  id              String    @id @default(cuid())
  enrollmentId    String
  quizId          String

  enrollment      ModuleEnrollment @relation(fields: [enrollmentId], references: [id], onDelete: Cascade)
  quiz            ModuleQuiz @relation(fields: [quizId], references: [id], onDelete: Cascade)

  score           Int       // Percentage 0-100
  passed          Boolean
  timeSpent       Int?      // Seconds

  // Store answers for review
  answers         Json      // { questionId: selectedOptionId }

  completedAt     DateTime  @default(now())

  createdAt       DateTime  @default(now())
}
```

---

## UI Components

### User-Facing Pages

#### `/trainings` (Enhanced)
- Tab or toggle: "Sessions" vs "Online Modules"
- Module cards showing:
  - Thumbnail, title, estimated time
  - Progress bar (if enrolled)
  - "Required" badge if applicable
  - Status: Not Started / In Progress / Completed

#### `/trainings/modules/[slug]`
- Module overview page
- Start/Continue button
- Prerequisites warning if not met
- Section list with completion checkmarks

#### `/trainings/modules/[slug]/learn`
- Full-screen learning interface
- Left sidebar: section navigation with progress
- Main content: video player / text / quiz
- Progress auto-saves on section completion

#### `/trainings/modules/[slug]/quiz/[quizId]`
- Quiz interface
- Question navigation
- Timer (if time limit set)
- Submit and show results
- Pass/fail with score breakdown

### Admin Pages

#### `/admin/training-modules`
- List all modules with status (draft/published)
- Create new module
- Edit module content
- View enrollment stats

#### `/admin/training-modules/[id]/edit`
- Module settings (title, requirements, passing score)
- Section editor (drag-drop reorder)
- Add video/text/quiz sections
- Quiz builder with question/option editor
- Preview module

---

## API Endpoints

### Public/User APIs

```
GET    /api/training-modules                    # List available modules
GET    /api/training-modules/[slug]             # Module details
POST   /api/training-modules/[slug]/enroll      # Start module
GET    /api/training-modules/[slug]/progress    # Get user progress
PUT    /api/training-modules/[slug]/progress    # Update section progress
POST   /api/training-modules/[slug]/quiz/[id]/submit  # Submit quiz
GET    /api/training-modules/[slug]/certificate # Download certificate PDF
```

### Admin APIs

```
POST   /api/admin/training-modules              # Create module
PUT    /api/admin/training-modules/[id]         # Update module
DELETE /api/admin/training-modules/[id]         # Delete module
POST   /api/admin/training-modules/[id]/sections      # Add section
PUT    /api/admin/training-modules/[id]/sections/[sectionId]  # Update section
DELETE /api/admin/training-modules/[id]/sections/[sectionId]  # Delete section
POST   /api/admin/training-modules/[id]/publish       # Publish module
GET    /api/admin/training-modules/[id]/enrollments   # View all enrollments
```

---

## Implementation Phases

### Phase 1: Core Infrastructure
- [ ] Add Prisma models and run migration
- [ ] Create basic module CRUD APIs
- [ ] Build module listing page with cards
- [ ] Implement enrollment system

### Phase 2: Content Delivery
- [ ] Video upload to S3 with presigned URLs
- [ ] Video player component (video.js or plyr)
- [ ] Presigned URL generation for secure playback
- [ ] Text/markdown section renderer
- [ ] Resource download sections
- [ ] Section completion tracking
- [ ] Progress persistence (video position, completion %)

### Phase 3: Quiz System
- [ ] Quiz builder UI for admins
- [ ] Multiple choice + true/false questions
- [ ] Quiz taking interface
- [ ] Scoring and pass/fail logic
- [ ] Attempt history and retake limits

### Phase 4: Progress & Certificates
- [ ] Overall module progress calculation
- [ ] Certificate PDF generation (using react-pdf or similar)
- [ ] Expiration and recertification tracking
- [ ] Dashboard widget showing training status

### Phase 5: Role Integration
- [ ] Required modules by role enforcement
- [ ] Onboarding checklist for new volunteers
- [ ] Prerequisite validation
- [ ] Training completion affecting shift eligibility

---

## Technical Considerations

### Video Hosting

**Decision:** Use existing AWS S3 bucket for self-hosted video storage.

**Benefits:**
- Full control over content (no third-party restrictions)
- Videos are private/not discoverable
- No external dependencies or API limits
- Already have infrastructure in place
- Cost-effective for our scale

**Implementation:**

1. **Storage Structure:**
   ```
   s3://[bucket-name]/training-videos/
   ├── [module-slug]/
   │   ├── intro.mp4
   │   ├── section-1.mp4
   │   └── thumbnails/
   │       ├── intro.jpg
   │       └── section-1.jpg
   ```

2. **Upload Flow:**
   - Admin uploads video via presigned URL (same pattern as incident photos)
   - Transcode to web-friendly format (H.264/MP4) if needed
   - Generate thumbnail automatically or allow manual upload
   - Store S3 key in `ModuleSection.videoUrl`

3. **Playback:**
   - Use HTML5 `<video>` element with presigned URL
   - Or use a lightweight player like `video.js` or `plyr`
   - Generate short-lived presigned URLs for playback (e.g., 1 hour expiry)
   - Track playback progress via JavaScript events

4. **API Endpoint:**
   ```typescript
   // GET /api/training-modules/[slug]/video/[sectionId]
   // Returns presigned URL for video playback
   const url = await s3.getSignedUrl('getObject', {
     Bucket: process.env.AWS_S3_BUCKET,
     Key: `training-videos/${moduleSlug}/${sectionId}.mp4`,
     Expires: 3600, // 1 hour
   });
   ```

5. **Considerations:**
   - Max file size: ~500MB per video (adjust S3 upload limits)
   - Supported formats: MP4 (H.264) only - universal browser/mobile support
   - Bandwidth costs: ~$0.09/GB (monitor usage)
   - CloudFront CDN **not required** for our scale (~100 volunteers, regional audience)

### Video Format Requirements

**Current approach: Validation only** (zero transcoding costs). Admins must upload web-ready MP4 files.

**Required format:**
- Container: MP4
- Video codec: H.264/AVC
- Audio codec: AAC
- Resolution: 720p (1280x720) recommended
- Max file size: 500MB

**Recommended export settings (for HandBrake/VLC/Premiere):**
```
Format: MP4
Video Encoder: H.264 (x264)
Quality: RF 23 (or ~1500 kbps for 720p)
Audio: AAC, 128 kbps, Stereo
```

**Upload validation:**
- Check MIME type: `video/mp4`
- Validate file header (first bytes = `ftyp`)
- Display clear error if wrong format: "Please convert to MP4 (H.264) using HandBrake"

**Result:** ~10-15 MB per minute, universal playback, zero transcoding costs

### Future: Auto-Transcoding Options

If manual conversion becomes burdensome, consider these alternatives:

| Option | Cost per 10-min video | Setup | Notes |
|--------|----------------------|-------|-------|
| **Manual (current)** | $0.00 | None | Admin uses HandBrake |
| **Lambda + FFmpeg** | ~$0.003 | Medium | Serverless, S3 trigger, FFmpeg layer |
| **AWS MediaConvert** | ~$0.15 | Easy | Managed service, no infra |

**Lambda + FFmpeg implementation (if needed later):**
1. Create Lambda function with FFmpeg layer
2. Trigger on S3 upload to `training-videos/raw/`
3. Transcode to H.264/720p
4. Output to `training-videos/processed/`
5. Update database record with processed URL

**MediaConvert implementation (if needed later):**
1. Create MediaConvert job template (H.264, 720p, AAC)
2. Trigger via Lambda on S3 upload
3. Output to same bucket with `-processed` suffix

### Quiz Security
- Don't send correct answers to client until after submission
- Rate limit quiz submissions to prevent brute forcing
- Store answers server-side, calculate score on backend
- Optional: randomize question order per attempt

### Progress Tracking
- Auto-save every 30 seconds during video playback
- Mark section complete when video reaches 90%+ watched
- Store progress in `SectionProgress` table
- Calculate overall progress as: `(completed sections / total sections) * 100`

### Certificate Generation
- Use `@react-pdf/renderer` or `pdfkit`
- Include: volunteer name, module title, completion date, unique ID
- Store certificate URL in `ModuleEnrollment.certificateUrl`
- Generate on-demand or cache after completion

---

## UI/UX Mockups

### Module Card
```
┌─────────────────────────────────────┐
│  [Thumbnail Image]                  │
│                                     │
│  Volunteer Orientation              │
│  ━━━━━━━━━━━━━━━━━━━━━━━ 75%       │
│                                     │
│  ⏱ 45 min  │  📚 Required          │
│                                     │
│  [Continue Learning →]              │
└─────────────────────────────────────┘
```

### Learning Interface
```
┌─────────────────────────────────────────────────────┐
│  ← Back to Modules    Volunteer Orientation    75%  │
├───────────┬─────────────────────────────────────────┤
│           │                                         │
│ ✓ Intro   │   ┌─────────────────────────────────┐   │
│ ✓ Safety  │   │                                 │   │
│ ● Comms   │   │      [Video Player]             │   │
│ ○ Quiz    │   │                                 │   │
│           │   └─────────────────────────────────┘   │
│           │                                         │
│           │   Communication Protocols               │
│           │   Learn how to use the radio system... │
│           │                                         │
│           │            [Mark as Complete →]         │
└───────────┴─────────────────────────────────────────┘
```

### Quiz Interface
```
┌─────────────────────────────────────────────────────┐
│  Safety Quiz                           ⏱ 8:42      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Question 3 of 10                                   │
│                                                     │
│  What should you do if you observe suspicious       │
│  activity near a polling location?                  │
│                                                     │
│  ○ Confront the person directly                     │
│  ● Report to your dispatcher immediately            │
│  ○ Ignore it and continue observing                 │
│  ○ Call 911 without reporting to dispatch           │
│                                                     │
│  ┌───┬───┬───┬───┬───┬───┬───┬───┬───┬───┐        │
│  │ 1 │ 2 │ 3 │ 4 │ 5 │ 6 │ 7 │ 8 │ 9 │10 │        │
│  └───┴───┴───┴───┴───┴───┴───┴───┴───┴───┘        │
│                                                     │
│       [← Previous]              [Next →]            │
│                                                     │
│                    [Submit Quiz]                    │
└─────────────────────────────────────────────────────┘
```

---

## Success Metrics

- **Adoption:** % of volunteers who complete required training modules
- **Completion Rate:** % who start a module and finish it
- **Quiz Performance:** Average scores, pass rates
- **Time to Completion:** Average time to complete onboarding modules
- **Recertification:** % who recertify before expiration

---

## Open Questions

1. ~~**Video hosting preference?**~~ ✅ **Decided:** Use existing AWS S3 bucket
2. **Certificate branding?** Organization logo, official signatures?
3. **Gamification?** Badges, points, leaderboards for training completion?
4. ~~**SCORM compliance?**~~ ✅ **Not needed** - Custom system, internal audience only
5. **Mobile app?** Offline viewing support for videos?
6. ~~**CloudFront CDN?**~~ ✅ **Not needed** - Scale doesn't require it (~100 users)
7. ~~**Video transcoding?**~~ ✅ **Decided:** No auto-transcoding (cost savings). Validate uploads are MP4/H.264. Admins pre-convert using free tools (HandBrake, VLC)

---

## Related Features

- Daily zone-level documents (could be a "resource" section type)
- Onboarding flow integration
- Shift eligibility based on training completion
