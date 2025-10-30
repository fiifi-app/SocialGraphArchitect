# Social Graph Connector - Design Guidelines

## Design Approach

**Selected Approach:** Design System (Utility-Focused Application)

**Primary References:** 
- Linear (modern productivity aesthetics, clean data display)
- Granola AI (minimalist meeting interface, recording UX patterns)
- Notion (content-heavy layouts with excellent readability)

**Core Principles:**
1. Information clarity over decoration
2. Scannable, high-density data displays
3. Immediate action availability
4. Professional, trustworthy interface
5. Accessibility and readability paramount

---

## Typography System

**Font Families:**
- Primary: Inter (via Google Fonts) - body text, UI elements, data displays
- Monospace: JetBrains Mono - timestamps, code snippets, technical details

**Type Scale:**
- Headings: text-3xl (page titles), text-2xl (section headers), text-xl (subsection headers)
- Body: text-base (primary content), text-sm (secondary info, metadata)
- Caption: text-xs (timestamps, labels, tertiary information)

**Weights:**
- font-semibold for headings and emphasis
- font-medium for buttons and active states
- font-normal for body text
- font-light sparingly for large display text only

---

## Layout System

**Spacing Primitives:** Use Tailwind units of **2, 4, 6, 8, 12, 16, 24** (e.g., p-4, gap-6, mt-8, mb-16)

**Grid Structure:**
- Main app: Sidebar navigation (64-72 units wide) + Main content area (fluid with max-w-7xl)
- Recording view: Transcript (60-65% width) + Suggestions panel (35-40% width) on desktop
- Contact cards: Grid with grid-cols-1 md:grid-cols-2 lg:grid-cols-3 with gap-6

**Container Strategy:**
- App shell: Full viewport with fixed sidebar
- Content areas: Generous padding (px-8, py-6)
- Cards and panels: Consistent internal padding (p-6)
- Dense lists: Tighter spacing (p-4, gap-2)

---

## Core UI Components

### Navigation
**Sidebar (Granola-inspired):**
- Fixed left sidebar, full height
- Logo/app name at top (h-16)
- Primary nav items with icons (Heroicons) and labels
- Active state: subtle background treatment
- Bottom: User profile, settings access
- Collapsed state option with icon-only view

### Recording Interface
**Live Recording View:**
- Full-width sticky header (h-16) with recording indicator, timer, pause/stop controls
- Two-column layout: Transcript (left, scrollable) + Suggestions (right, sticky)
- Transcript: Monospace timestamps (text-xs), speaker labels (text-sm font-medium), message text (text-base)
- Auto-scroll to bottom with "new content" indicator
- Animated pulsing microphone icon during active recording

**Consent Banner:**
- Full-width alert at top before recording starts
- Editable consent text in textarea
- Clear "Start Recording" CTA and "Cancel" option
- Dismissible after first acceptance with preference saved

### Suggestion Cards
**Real-time Suggestion Panel:**
- Sticky panel with auto-refresh every 5 seconds
- Each suggestion card includes:
  - Contact name (text-lg font-semibold)
  - Score badge (1-3 rating) - prominent, pill-shaped
  - Top 3 "why" factors as bulleted list (text-sm)
  - Clickable transcript span links
  - Quick action buttons: Promise/Maybe/Dismiss
- Stack vertically with gap-4
- Maximum 5 visible at once, scroll for more

### Contact Management
**Contact Cards:**
- Grid layout with consistent card sizing
- Card structure (p-6, rounded-lg borders):
  - Header: Name + role badge
  - Organization and location (text-sm)
  - Relationship strength indicator (visual progress bar)
  - Tags as small pills (text-xs, rounded-full px-3 py-1)
  - Thesis preview (truncated)
  - Last interaction date
  - Edit/view actions (icon buttons)

**Contact Detail View:**
- Side panel or modal approach
- Tabbed interface: Overview / Thesis / History / Notes
- Form fields with clear labels above inputs
- Thesis builder with dynamic field addition
- LinkedIn URL as clickable link with icon

### Forms & Inputs
**Standard Form Pattern:**
- Labels above inputs (text-sm font-medium, mb-2)
- Input fields with border, rounded corners (rounded-md), adequate height (h-10 for text inputs)
- Textarea for longer content (min-h-32)
- Select dropdowns with chevron icon
- Multi-select with tag visualization
- Helper text below fields (text-xs)
- Error states with inline validation messages

### Data Tables
**Conversation History:**
- Responsive table with hover states on rows
- Columns: Date/Time, Participants, Duration, Suggestions Count, Actions
- Sortable headers with visual indicators
- Row actions appear on hover
- Sticky header when scrolling
- Pagination at bottom (show 20 per page)

### Action Buttons
**Button Hierarchy:**
- Primary CTA: Solid background, font-medium, px-6 py-2.5, rounded-md
- Secondary: Bordered outline, transparent background
- Tertiary: Text only with underline on hover
- Icon buttons: Square (h-10 w-10), centered icon, rounded-md
- Recording controls: Larger touch targets (h-12), icon + label

### Summary Sections
**Meeting Wrap-up:**
- Three distinct sections with clear headers:
  - Highlights (bulleted list, text-base)
  - Decisions (numbered list with emphasis)
  - Action Items (checkbox list with assignee)
- Intro List below with ranking (1-3 scores visible)
- Export button prominently placed

---

## Interaction Patterns

**Micro-interactions:**
- Subtle scale on card hover (scale-105 transition)
- Smooth opacity transitions for state changes
- Loading states with skeleton screens for data tables
- Toast notifications for actions (top-right corner)
- Confirmation modals for destructive actions

**Transcript Linking:**
- Clickable evidence spans highlight corresponding text
- Scroll-to-highlight with temporary emphasis animation
- Breadcrumb back to suggestion from transcript view

---

## Visual Density & Spacing

**High-Density Areas:**
- Transcript view: Minimal spacing between messages (gap-1)
- Contact grid: Tight but scannable (gap-6)
- Suggestions panel: Condensed but readable (gap-4)

**Breathing Room:**
- Page headers: Large top margin (mt-12, mb-8)
- Section breaks: Dividers with generous vertical spacing (my-8)
- Modal/panel padding: Generous (p-8)

---

## Accessibility Standards

- Minimum touch target: 44x44px for all interactive elements
- Form inputs with associated labels (for attribute)
- ARIA labels on icon-only buttons
- Keyboard navigation support throughout
- Focus indicators visible and distinct (ring-2 ring-offset-2)
- Sufficient contrast ratios for all text
- VoiceOver-friendly component structure

---

## Responsive Breakpoints

**Mobile (base to md):**
- Stack sidebar as bottom nav or hamburger menu
- Single-column layouts for all grids
- Recording: Transcript full-width, suggestions as bottom sheet
- Simplified tables with card-based mobile view

**Tablet (md to lg):**
- Two-column contact grids
- Sidebar remains visible
- Transcript + suggestions side-by-side at 50/50 split

**Desktop (lg+):**
- Full three-column contact grids
- Optimal transcript/suggestions ratio (60/40)
- Multi-column data tables
- Side panels for details instead of modals

---

## Special Features

**Recording Indicator:**
- Fixed position (top-right or top-center)
- Pulsing red dot + elapsed time
- Always visible during active recording
- Pause state shows orange indicator

**Search Interface:**
- Prominent search bar in header or dedicated page
- Real-time filtering with debounce
- Search across: transcripts, contacts, entities, suggestions
- Result previews with matched text highlighting
- Filters: date range, entity type, score range

**CSV Import Flow:**
- Drag-and-drop zone with file upload
- Column mapping interface
- Preview of parsed data before import
- Error handling with line-by-line feedback

---

## Animation Budget

**Minimal, Purposeful Animations:**
- Recording pulse (continuous, subtle)
- Page transitions (smooth fade)
- Loading states (skeleton screens, spinners)
- Toast notifications (slide-in from top-right)
- Modal/panel entry (fade + slight scale)
- NO decorative scroll animations or parallax effects