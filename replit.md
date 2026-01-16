# Anchor — Client-Centered Scheduling

## Overview

Anchor is a clinic scheduling application for behavioral therapy clinics, designed to simplify daily scheduling for a single administrator. It manages staff and client availability changes, runs a deterministic scheduling engine, and visualizes the generated schedule. The core principle is "Chaos to Calm," focusing on client-centered scheduling where client needs and constraints drive decisions, enforcing hard constraints, managing approval-gated actions, and optimizing soft preferences.

## User Preferences

Preferred communication style: Simple, everyday language.

### UI Conventions
- **Alphabetical Sorting**: All lists displaying names (staff, clients, dropdowns, selection lists) must be sorted alphabetically using `localeCompare()`.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript, using Vite.
- **Routing**: Wouter.
- **State Management**: TanStack Query (React Query).
- **UI Components**: shadcn/ui (built on Radix UI primitives).
- **Styling**: Tailwind CSS v4 with a "coastal chic" color palette.
- **Typography**: DM Sans for UI, Cormorant Garamond for headings.

### Backend Architecture
- **Framework**: Express.js with TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.
- **API Pattern**: RESTful API endpoints under `/api/*`.
- **Build System**: esbuild for server, Vite for client.

### Key Application Pages
1.  **Home**: Dashboard.
2.  **Client Info**: CRUD for client data.
3.  **Staff Info**: CRUD for staff data.
4.  **Template**: Weekly baseline schedule assignments with block availability enforcement.
5.  **Ideal Day**: Complete pre-authored schedule for each weekday - the "perfect puzzle" before any call-outs.
6.  **Daily Run**: Daily operations for exceptions, approvals, and schedule generation.
7.  **Schedule**: Read-only view of the generated schedule.
8.  **Change Log**: View of all schedule modifications.
9.  **Scenario Lab**: Scheduling engine testing environment.

### Ideal Day Template System
The Ideal Day page provides a complete, editable view of what each day's schedule should look like with no exceptions:
-   **Timeline View**: Visual schedule showing all staff with their segments from 7:00 AM to 5:00 PM.
-   **Segment Types**: client, lunch, drive, break, on_call, lead_support, open, out.
-   **Editable Segments**: Click to edit start/end times, segment type, client assignment, and notes.
-   **Lunch Pairings**: Define which clients are grouped together during lunch periods.
-   **Template Tools**: Copy day layout to another weekday, reset from base assignments.
-   **Engine Integration**: The scheduling engine uses the ideal day as its starting point instead of calculating dynamically.

**Database Tables**:
-   `ideal_day_templates`: One record per weekday with status and notes.
-   `ideal_day_segments`: Individual time segments for each staff member.
-   `ideal_day_lunch_pairings`: Lunch period client groupings with covering staff.

**Design Philosophy**: The schedule is like a sliding puzzle. The Ideal Day defines the complete puzzle. When staff call out, the puzzle border shrinks (clients get cancelled), and remaining pieces are rearranged according to the rules. The engine becomes a "difference engine" that knows what perfection looks like and adjusts for reality.

### Template Block Availability
The template page enforces staff availability for AM (7:30-11:30) and PM (12:30-4:30) blocks. Blocks where staff hours do not cover the window are marked "Unavailable" and assignments are automatically filtered out.

### Scheduling Engine Design
Uses a constraint-based approach with three priority levels:
-   **Hard Constraints**: Never violated (e.g., excluded staff, availability, certifications).
-   **Approval-Gated Actions**: Require explicit permission (e.g., sub usage, lead RBT assignments).
-   **Soft Preferences**: Optimized but can be bent (e.g., minimizing template deviation).

### Cancellation Decision System
When staffing options are exhausted, the engine follows a multi-step cancellation process:
-   Builds an eligibility pool of clients with uncovered gaps.
-   Protects new clients/locations for 30 days.
-   Applies skip rules (e.g., 2-sessions/week clients, 5-consecutive-absent clients).
-   Selects clients based on oldest `lastCanceledDate` for fairness, preferring full-day cancellations.
-   Considers billing types (`canBeGrouped`) for timing rules.
-   Links cancellations for siblings (`clientCancelLinks`).
-   Supports all-day-only cancellations (`cancelAllDayOnly`).

### Automatic Cancel/Sub Tracking
The system automatically tracks cancellation and substitute history:
-   **Cancel History**: Persisted to `clientCancelHistory` table (date, timeBlock, reason).
-   **Sub History**: Persisted to `clientSubHistory` table (date, timeBlock, subStaffId, originalStaffId).
-   **History Tab**: Visible in Client Info → History tab for each client.
-   **Daily Finalization**: POST `/api/daily-run/finalize` endpoint persists history and updates metrics.

### Automatic Skip Rules
Skip rules are applied automatically during cancel selection. **Eligibility is calculated from the template schedule**, not manually configured:
-   **2-Day/Week Rule**: Days per week are calculated from unique weekDays in template assignments. Clients attending ≤2 days per week are skipped once before cancellation. Tracked via `cancelSkipUsed` and `lastSkippedDate`. Clears when client is actually canceled.
-   **5-Day Absence Rule**: Clients absent 5+ consecutive days are skipped until they attend 3 consecutive days. 
    -   Only client absences (no-shows) increment `consecutiveAbsentDays`; clinic cancellations do not.
    -   Any non-attendance (absence, cancellation) resets `daysBackSinceAbsence` to 0.
    -   After 3 consecutive attended days, both counters reset and skip protection is removed.
-   **Skip History**: Persisted to `clientSkipHistory` table (date, skipReason). Visible in Client Info → History tab.
-   **UI Display**: Cancels tab shows read-only eligibility notices (days attended, skip protection status). Skip eligibility is not editable—it's derived from the schedule.

### Lead RBT Staffing System
Lead RBTs are utilized as a last resort to prevent cancellations, with specific rules:
-   Staffing order: Focus → Trained → Float → Sub → Lead → Cancel.
-   Requires `isLeadEligibleForClient()` check.
-   Triggers `lead_reserve` approval if fewer than 5 leads remain available.
-   Selection prioritizes same BCBA, then level ordering (3 → 2 → 1 → Nonbillable).
-   Generates `lead_staffing` or `lead_reserve` approvals.

### All-Day Staffing Approval
When the same staff is assigned to the same client for both AM and PM blocks in the template, an `all_day_staffing` approval is generated. These approvals are persistent and preserved even if exceptions change.

### Lunch Coverage System
Manages client groups and staff assignments during lunch:
-   `Coverage maps` track `clientIds`, `clientNames`, `clientOriginalStaff` for self-coverage detection and group eligibility.
-   **Minute-Level Session Times**: Client schedules store `amStart`, `amEnd`, `pmStart`, `pmEnd` as time strings (e.g., "11:00"). The engine uses `getClientSessionTimes()` to convert these to minutes from midnight for precise timing checks.
-   **Lunch Coverage Eligibility**: Clients only need lunch coverage if their AM session ends at or after 11:30. The `clientNeedsLunchCoverage()` function checks this automatically, preventing false coverage errors for clients who leave before lunch.
-   **Lunch Slot Pairing Restrictions**: Clients can have `noFirstLunchPeerIds` and `noSecondLunchPeerIds` to prevent specific peer groupings. These are bidirectional.
-   **Lunch Group Sizing**: Clients can be configured for `allowGroupsOf3` or `allowGroupsOf4`.
-   **Group Leader Feature**: Staff assigned to specific clients can be designated as "group leaders" with separate group names for each lunch period (`groupLeaderNameFirstLunch` for 11:30-12:00, `groupLeaderNameSecondLunch` for 12:00-12:30). These names are displayed as tags in the schedule.

### Split-Location Client Handling
Clients who transition between locations (e.g., school in AM → clinic in PM) are automatically detected and handled:
-   **Detection**: The `isSplitLocationClient()` function checks if AM and PM template assignments have different `locationId` values.
-   **Location Display**: The `getAssignmentLocation()` helper prioritizes template-assigned `locationId` over `client.defaultLocation` for accurate session location display.
-   **Lunch Coverage Skip**: Split-location clients are excluded from lunch coverage since they're traveling during the lunch period.
-   **AM Staff Handling**: AM staff working with split-location clients don't continue showing the client during lunch slots (11:30-12:00 and 12:00-12:30). Instead, they show "OPEN" with reason "Client traveling".
-   **PM Staff Handoff**: PM staff assignment starts at the client's PM session time at the new location.

### Schedule View
A timeline-based view (7:00 AM to 6:00 PM) where block widths are proportional to duration. Displays client initials, time range, location, and indicators. Utilizes `startMinute` and `endMinute` for precise positioning.

### Staff Hierarchy and Supervision
Supports a hierarchical staff structure with roles (Clinical Manager, Lead BCBA, Admin, BCBA, Lead RBT, RBT, BT, Float) and supervision relationships:
-   `programSupervisorId`, `clinicalSupervisorId`, `assignedLeadId`, `assignedBcbaId` fields define relationships.
-   Many-to-many assignments for Lead RBTs to BCBAs (`lead_rbt_bcba_links`) and Clinical Managers to Lead BCBAs/Admins.
-   Clinical Manager, Admin, and Lead BCBA roles are not displayed in the schedule unless they are trainers.
-   An organization chart is available at `/org-chart`.

### Data Model
Includes Staff, Clients, Client Locations, Schools, Template Assignments, Exceptions, and Schedule Changes.

### School Lunches Feature
Schools can have custom lunch windows (`hasAlternativeLunch`, `lunchWindowStartMinute`, `lunchWindowEndMinute`) that override clinic defaults, influencing PM session start times.

### Path Aliases
-   `@/*` → `./client/src/*`
-   `@shared/*` → `./shared/*`
-   `@assets` → `./attached_assets`

## External Dependencies

### Database
-   **PostgreSQL**: Primary data store.
-   **Drizzle ORM**: Type-safe queries and schema management.
-   **connect-pg-simple**: PostgreSQL session store.

### UI Libraries
-   **Radix UI**: Accessible component primitives.
-   **Lucide React**: Icon library.
-   **class-variance-authority**: Component variant management.
-   **cmdk**: Command palette.
-   **embla-carousel-react**: Carousel component.
-   **date-fns**: Date manipulation.

### Build & Development
-   **Vite**: Frontend build and dev server.
-   **esbuild**: Server bundling.
-   **TypeScript**: Type safety.
-   **Tailwind CSS v4**: Utility-first CSS.

### Testing
-   **Vitest**: Unit testing for the scheduling engine (e.g., cancellation, approvals, training disruptions).
-   **Test Location**: `client/src/lib/__tests__/schedule-engine.test.ts`.

### Performance Optimizations
-   **Schedule Caching**: Hash-based memoization with 5-minute TTL and LRU eviction.
-   **Performance Metrics**: Operation timing and slow operation detection.
-   **Decision Logging**: Structured logging.
-   **Progressive Loading**: Paginated data loading.
-   **Skeleton Loading**: Loading state components.
-   **Export Progress**: Staged feedback for image exports.
-   **Database Indexes**: Optimized indexes on key tables.