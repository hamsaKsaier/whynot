> **Single source of truth**: Before proposing any change, read [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) (adjust relative path to the file's depth). When this document conflicts with `ARCHITECTURE.md`, `ARCHITECTURE.md` wins.

# URL-Based Tab State - Strict Rule

## MANDATORY REQUIREMENT

**ALL tabbed interfaces MUST persist active tab state in URL query parameters.**

This ensures users stay on the same tab when refreshing the page or sharing links.

## Why This Rule Exists

1. **User experience** - Refreshing doesn't lose context
2. **Shareability** - Deep links to specific tabs work
3. **Browser history** - Back/forward navigation works correctly
4. **Consistency** - Unified pattern across the codebase

## Technical Implementation

### TanStack Router Pattern (REQUIRED)

```typescript
// 1. Define tab type
type TabState = "general" | "settings" | "logs";

// 2. Add validateSearch to route definition
export const Route = createFileRoute("/dashboard/resource/$resourceId")({
  component: ResourcePage,
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as TabState) || "general",
  }),
});

// 3. Use search params in component
function ResourcePage() {
  const { tab: initialTab } = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabState>(initialTab);

  // 4. Sync URL when tab changes
  const handleTabChange = useCallback(
    (newTab: string) => {
      const tabValue = newTab as TabState;
      setTab(tabValue);
      navigate({
        to: "/dashboard/resource/$resourceId",
        params: { resourceId },
        search: { tab: tabValue },
        replace: true,  // Don't create new history entry
      });
    },
    [navigate, resourceId]
  );

  // 5. Connect to Tabs component
  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="settings">Settings</TabsTrigger>
        <TabsTrigger value="logs">Logs</TabsTrigger>
      </TabsList>
      {/* TabsContent components */}
    </Tabs>
  );
}
```

## Reference Implementation

See: `frontend/src/routes/_app/_auth/dashboard/_layout.project.$projectId.environment.$environmentId.services.$serviceType.$serviceId.tsx`

This file demonstrates the complete pattern with:
- Type-safe tab state
- URL synchronization
- Keyboard navigation support
- Service-specific tab orders

## Agent Responsibilities

### All Agents MUST

1. **Always** add `validateSearch` to routes with tabs
2. **Always** use `navigate()` with `replace: true` on tab change
3. **Always** sync local state with URL search params
4. **Never** use uncontrolled `defaultValue` without URL sync
5. **Verify** tab persists on page refresh before completing

## Validation Checklist

Before any commit with tabs:

- [ ] Route has `validateSearch` defined
- [ ] Component uses `Route.useSearch()` for initial tab
- [ ] `handleTabChange` calls `navigate()` with `replace: true`
- [ ] `<Tabs>` uses `value` prop (controlled)
- [ ] Tab persists on browser refresh
- [ ] Direct URL with `?tab=X` opens correct tab

## Edge Cases

### Dynamic Tabs (Generated from Data)

When tabs are generated from API data (e.g., database list):

```typescript
type TabState = string; // Dynamic, not predefined

export const Route = createFileRoute('/path')({
  validateSearch: (search) => ({
    tab: (search.tab as string) || '', // Empty default, set after data loads
  }),
});

function DynamicTabsPage() {
  const { data: databases } = useDatabases();
  const { tab: urlTab } = Route.useSearch();
  const navigate = useNavigate();

  // Set default tab after data loads
  const defaultTab = databases?.[0]?.id || '';
  const [tab, setTab] = useState(urlTab || defaultTab);

  // Update tab when default changes
  useEffect(() => {
    if (!urlTab && defaultTab) {
      setTab(defaultTab);
      navigate({ search: { tab: defaultTab }, replace: true });
    }
  }, [defaultTab, urlTab]);

  // ...
}
```

### Nested Routes with Tabs

When parent route has tabs AND child route has tabs:

```typescript
// Parent route: /project/:id
// Child route: /project/:id/service/:serviceId

// Parent validateSearch
validateSearch: (search) => ({
  parentTab: (search.parentTab as ParentTabState) || 'overview',
});

// Child validateSearch
validateSearch: (search) => ({
  parentTab: (search.parentTab as ParentTabState) || 'services',
  childTab: (search.childTab as ChildTabState) || 'general',
});

// URL: /project/123/service/456?parentTab=services&childTab=logs
```

### Tab with Unsaved Form State

When tab contains a form with unsaved changes:

```typescript
function TabWithForm() {
  const form = useForm<FormData>();
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  const handleTabChange = (newTab: string) => {
    if (form.formState.isDirty) {
      // Store pending tab and show confirmation
      setPendingTab(newTab);
      setShowConfirmDialog(true);
    } else {
      // Safe to switch
      setTab(newTab);
      navigate({ search: { tab: newTab }, replace: true });
    }
  };

  const handleConfirmSwitch = () => {
    if (pendingTab) {
      form.reset(); // Discard changes
      setTab(pendingTab);
      navigate({ search: { tab: pendingTab }, replace: true });
      setPendingTab(null);
    }
  };

  // ...
}
```

### Tab with Loading State

Preserve tab while loading data:

```typescript
function TabsWithLoading() {
  const { data, isLoading } = useServiceData(id);
  const { tab } = Route.useSearch();

  // Don't reset tab during loading
  if (isLoading) {
    return <TabsSkeleton activeTab={tab} />;
  }

  return (
    <Tabs value={tab} onValueChange={handleTabChange}>
      {/* ... */}
    </Tabs>
  );
}
```

### Default Tab Based on Permissions

When default tab depends on user permissions:

```typescript
function PermissionBasedTabs() {
  const { user } = useAuth();
  const { tab: urlTab } = Route.useSearch();

  // Determine allowed tabs
  const allowedTabs = user?.isAdmin
    ? ['general', 'settings', 'admin']
    : ['general', 'settings'];

  // Validate URL tab is allowed
  const validTab = allowedTabs.includes(urlTab)
    ? urlTab
    : allowedTabs[0];

  // Redirect if invalid tab
  useEffect(() => {
    if (urlTab && !allowedTabs.includes(urlTab)) {
      navigate({ search: { tab: allowedTabs[0] }, replace: true });
    }
  }, [urlTab, allowedTabs]);

  return (
    <Tabs value={validTab} onValueChange={handleTabChange}>
      {allowedTabs.map((t) => (
        <TabsTrigger key={t} value={t}>
          {t}
        </TabsTrigger>
      ))}
    </Tabs>
  );
}
```

### Tab State with Filters

When tabs also have filters that should persist:

```typescript
type SearchParams = {
  tab: TabState;
  filter?: string;
  sort?: 'asc' | 'desc';
};

export const Route = createFileRoute('/path')({
  validateSearch: (search): SearchParams => ({
    tab: (search.tab as TabState) || 'general',
    filter: search.filter as string | undefined,
    sort: ['asc', 'desc'].includes(search.sort as string)
      ? (search.sort as 'asc' | 'desc')
      : undefined,
  }),
});

function TabsWithFilters() {
  const { tab, filter, sort } = Route.useSearch();

  const handleTabChange = (newTab: string) => {
    // Preserve filters when switching tabs
    navigate({
      search: { tab: newTab, filter, sort },
      replace: true,
    });
  };

  const handleFilterChange = (newFilter: string) => {
    // Preserve tab when changing filter
    navigate({
      search: { tab, filter: newFilter, sort },
      replace: true,
    });
  };
}
```

## Summary

**One rule to remember**:

> **Tabs MUST sync to URL. Use `validateSearch` + `navigate({ replace: true })`.**

If you find tabs without URL sync: **ADD IT IMMEDIATELY.**
