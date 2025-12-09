# Schedule View Redesign Demos

This folder contains interactive HTML mockups exploring redesign options for the RippleVMS weekly schedule and day views.

## Background

The current weekly schedule view displays comprehensive information but is visually busy. Each cell contains multiple lines of text (dispatcher, zone leads, volunteer counts, gap warnings), making it difficult to quickly scan for issues or get an at-a-glance understanding of coverage.

The goal of these mockups is to explore ways to present the same information in a tighter, more dynamic, and more scannable format.

---

## Files

### 1. `schedule-redesign-options.html`

Explores **4 options** for redesigning the weekly schedule grid:

| Option | Name | Description | Best For |
|--------|------|-------------|----------|
| **A** | Heat Map | Condensed cells with color-coded status and volunteer counts. Hover for details. | Quick status scanning |
| **B** | Card View | Daily focus with detailed cards. Click day pills to navigate. | Daily operations, mobile |
| **C** | Progressive Grid | Simplified cells that expand inline on click. | Balance of overview + detail |
| **D** | Timeline | Horizontal swimlanes showing shift duration as bars. | Visualizing time overlaps |

**Key interactions:**
- **Option A:** Hover over cells to see tooltip with zone breakdown
- **Option B:** Click day pills to simulate navigation
- **Option C:** Click cells to expand/collapse details inline
- **Option D:** Hover over timeline bars for tooltips (dispatcher row shows below)

---

### 2. `day-view-options.html`

Explores **5 concepts** for a dedicated single-day view:

| Concept | Name | Description | Best For |
|---------|------|-------------|----------|
| **A** | Timeline with Live Tracker | Horizontal timeline with "NOW" indicator | Dispatchers monitoring live ops |
| **B** | Shift Cards | Side-by-side cards per time block | Morning briefings |
| **C** | Agenda List | Sequential list with full volunteer names | Printable documentation |
| **D** | Operations Dashboard | Multi-panel view with gaps, active shifts, stats | Day-of operations management |
| **E** | Mobile-First | Phone-optimized with swipeable time blocks | Volunteers, field coordinators |

**Use cases identified:**
1. **Day-of Operations (Dispatcher)** - Real-time monitoring, contact info, attendance tracking
2. **Daily Briefing (Coordinator)** - Morning review, gap identification, send reminders
3. **Volunteer Self-Service** - Personal schedule, shift details, zone lead contact
4. **Fill-the-Gaps Mode** - Urgent staffing, track outreach, quick assignment

---

## Design Principles Applied

1. **Progressive Disclosure** - Show summary first, details on demand
2. **Color Coding** - Consistent status colors (green=full, amber=partial, red=critical)
3. **Scannability** - Reduce text, use visual indicators
4. **Actionability** - Prominent buttons for common actions (assign, call, text)
5. **Context Awareness** - "NOW" indicators, countdown timers, weather

---

## Recommendations

### For Weekly View
**Option C (Progressive Grid)** is recommended as the primary approach because it:
- Maintains familiar week overview
- Dramatically reduces visual clutter
- Can be implemented incrementally
- Works on desktop and tablet

### For Day View
Consider implementing multiple views for different contexts:
- **Concept D (Dashboard)** for coordinators doing day-of operations
- **Concept C (Agenda)** for printable briefings
- **Concept E (Mobile)** for volunteers and field use

---

## How to View

Simply open either HTML file in a web browser. They are self-contained with Tailwind CSS loaded via CDN.

```bash
open schedule-redesign-options.html
open day-view-options.html
```

---

## Next Steps

1. Gather feedback on preferred approaches
2. Identify which elements to combine from different options
3. Create high-fidelity designs
4. Plan incremental implementation
