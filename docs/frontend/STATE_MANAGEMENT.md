# State Management

> **Note**: Documents the actual state management patterns used in the frontend.
> For component structure, see [COMPONENT_MAP.md](COMPONENT_MAP.md).

## Server State: TanStack Query 5

All data fetched from the API uses **TanStack Query** (v5.90.21) for caching, background refetching, and optimistic updates.

### Pattern

```tsx
// Query
const { data, isLoading } = useQuery({
  queryKey: ['listings'],
  queryFn: () => listingsApi.getAll()
});

// Mutation
const mutation = useMutation({
  mutationFn: listingsApi.create,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['listings'] });
  }
});
```

### Configuration

- Provider: `QueryProvider` in `src/lib/queryProvider.tsx`
- Wraps the entire app at the top of the provider hierarchy

## Client State: React Context

### AuthContext

- Located in `src/components/auth/AuthContext.tsx`
- Stores: authenticated user, permissions list, token validity
- Token stored in `localStorage` key `mk_auth_token`
- User data stored in `localStorage` key `mk_auth_user`
- On mount: reads token from localStorage, validates with `GET /api/auth/me`
- On 401: clears localStorage, redirects to `/login`

### BrandingContext

- Located in `src/contexts/BrandingContext.tsx`
- Stores: white-label branding settings (colors, logo, name)
- Fetched from `GET /api/client-settings/branding/public` (@Public endpoint)
- Used by Shell and login page for theming

## Authentication Token Flow

```
Login:
    POST /api/auth/login
    → Store token: localStorage.setItem('mk_auth_token', token)
    → Store user: localStorage.setItem('mk_auth_user', JSON.stringify(user))

Authenticated Requests:
    fetchWithAuth (src/lib/authApi.ts)
    → Adds Authorization: Bearer <token> from localStorage
    → On 401 response: clears localStorage, redirects to /login

Logout:
    POST /api/auth/logout (audit only)
    → localStorage.removeItem('mk_auth_token')
    → localStorage.removeItem('mk_auth_user')
    → Redirect to /login
```

## Permission State

- Permissions returned from `GET /api/auth/me` as string array
- Stored in AuthContext
- Accessed via `usePermissions()` hook: `const { can, permissions } = usePermissions()`
- Route-level: `<ProtectedRoute permissions={[...]}>`
- Component-level: `<Can permission="...">`

---

*Created: 2026-06-06.*
