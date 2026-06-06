# UI/UX Guidelines

> **Note**: Lightweight stub. No formal UI/UX guidelines exist for RealTrackApp.
> The design system is implemented via Tailwind CSS utility classes and Lucide React icons.

## Design System

### Styling Framework

- **Tailwind CSS** (v3.4.17) — utility-first CSS
- **Lucide React** (v0.474.0) — icon library
- **Recharts** — charting library (dashboard visualizations)
- Global styles in `src/index.css`; component styles are inline Tailwind classes

### Common Patterns

```tsx
// Card
<div className="bg-white rounded-lg shadow p-6">

// Button
<button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded">

// Form input
<input className="border border-gray-300 rounded px-3 py-2 w-full">

// Table
<table className="min-w-full divide-y divide-gray-200">
```

### Layout

- **Shell** (`src/components/layout/Shell.tsx`) — main app shell with sidebar navigation
- **ProtectedRoute** wraps all authenticated routes
- **Public routes** (login, register, forgot-password, OAuth callback) render without Shell

## Design Conventions

- Dark theme shell with light content cards
- Tab-based navigation for multi-section pages
- Modal dialogs for create/edit flows
- Toast notifications for success/error feedback
- Loading spinners for async operations
- Empty states with contextual messaging

## Responsive Behavior

- Primary desktop-focused layout
- Sidebar collapses on smaller screens
- Tables scroll horizontally on narrow viewports

## Accessibility

- Semantic HTML where possible
- Form labels tied to inputs
- Keyboard navigation for modal dialogs
- **Note**: No formal accessibility audit has been conducted

## Known Issues

- **Branding inconsistency**: Shell shows "RealTrackApp", login screen shows "ListingPro"
- **Theme inconsistency**: SkuDetailPage historically used light theme vs dark everywhere else (verify current state)

---

*Created: 2026-06-06 (stub).*
