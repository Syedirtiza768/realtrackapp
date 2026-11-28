import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter as Router, Routes, Route, Outlet, Link, Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import Shell from './components/layout/Shell';
import { AuthProvider } from './components/auth/AuthContext';
import { BrandingProvider } from './contexts/BrandingContext';
import { QueryProvider } from './lib/queryProvider';
import ProtectedRoute from './components/auth/ProtectedRoute';
import LandingPage from './components/landing/LandingPage';

// Every route screen is a separate chunk so a visit downloads only the code it renders.
// The shell, providers, auth guard and landing page stay in the entry bundle.
const Dashboard = lazy(() => import('./components/dashboard/Dashboard'));

const ListingEditor = lazy(() => import('./components/listings/ListingEditor'));
const RevisionHistory = lazy(() => import('./components/listings/RevisionHistory'));
const SingleListingPipeline = lazy(() => import('./components/listings/SingleListingPipeline'));

const FitmentManager = lazy(() => import('./components/fitment/FitmentManager'));

const CatalogManager = lazy(() => import('./components/catalog/CatalogManager'));
const BulkActionsPage = lazy(() => import('./components/catalog/BulkActionsPage'));
const CatalogImportDashboard = lazy(() => import('./components/catalog-import/CatalogImportDashboard'));
const CatalogMotorsFiltersPage = lazy(() => import('./components/catalog-import/CatalogMotorsFiltersPage'));
const EbayPublishWizardPage = lazy(() => import('./components/catalog/EbayPublishWizardPage'));
const CatalogProductDetail = lazy(() => import('./components/catalog/CatalogProductDetail'));
const IngestionManager = lazy(() => import('./components/ingestion/IngestionManager'));
const OrdersPage = lazy(() => import('./components/orders/OrdersPage'));
const SettingsPage = lazy(() => import('./components/settings/SettingsPage'));
const EbayStoresSettingsPage = lazy(() => import('./components/settings/EbayStoresSettingsPage'));
const EbayPolicyMappingPage = lazy(() => import('./components/settings/EbayPolicyMappingPage'));
const EbayStoreDetailPage = lazy(() => import('./components/settings/EbayStoreDetailPage'));
const NotificationsPage = lazy(() => import('./components/notifications/NotificationsPage'));
const SkuDetailPage = lazy(() => import('./components/sku/SkuDetailPage'));
const AutomationRulesPage = lazy(() => import('./components/automation/AutomationRulesPage'));
const TemplateManagerPage = lazy(() => import('./components/templates/TemplateManagerPage'));
const AuditTrailPage = lazy(() => import('./components/audit/AuditTrailPage'));
const MotorsDashboard = lazy(() => import('./components/motors/MotorsDashboard'));
const MotorsProductDetail = lazy(() => import('./components/motors/MotorsProductDetail'));
const ReviewQueue = lazy(() => import('./components/motors/ReviewQueue'));
const AIUploadWizard = lazy(() => import('./components/motors/AIUploadWizard'));
const PipelinePage = lazy(() => import('./components/pipeline/PipelinePage'));
const EbayPreviewPage = lazy(() => import('./components/preview/EbayPreviewPage'));
const InventoryManager = lazy(() => import('./components/inventory/InventoryManager'));
const StockWorkspace = lazy(() => import('./components/stock/StockWorkspace'));
const InventoryListingEditor = lazy(() => import('./components/inventory/InventoryListingEditor'));
const LoginPage = lazy(() => import('./components/auth/LoginPage'));
const RegisterPage = lazy(() => import('./components/auth/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./components/auth/ForgotPasswordPage'));
const EbayOAuthCallback = lazy(() => import('./components/channels/EbayOAuthCallback'));
const PrivacyPolicy = lazy(() => import('./components/legal/PrivacyPolicy'));
const VinListingsPage = lazy(() => import('./components/fitment/VinListingsPage'));
const ClientSettingsPage = lazy(() => import('./components/settings/ClientSettingsPage'));
const UsersAdminPage = lazy(() => import('./components/settings/UsersAdminPage'));
const TeamsAdminPage = lazy(() => import('./components/settings/TeamsAdminPage'));
const PermissionsPage = lazy(() => import('./components/settings/PermissionsPage'));
const AiRoutingDashboardPage = lazy(() => import('./components/settings/AiRoutingDashboardPage'));
const PublishedListingsPage = lazy(() => import('./components/published-listings/PublishedListingsPage'));
const PublishedListingDetailPage = lazy(() => import('./components/published-listings/PublishedListingDetailPage'));
const ImageDrivePage = lazy(() => import('./components/image-drive/ImageDrivePage'));
const FashionLoginPage = lazy(() => import('./components/fashion/FashionLoginPage'));
const FashionShell = lazy(() => import('./components/fashion/FashionShell'));
const FashionDashboardPage = lazy(() => import('./components/fashion/FashionDashboardPage'));
const FashionCatalogPage = lazy(() => import('./components/fashion/FashionCatalogPage'));
const FashionImportPage = lazy(() => import('./components/fashion/FashionImportPage'));
const FashionReviewPage = lazy(() => import('./components/fashion/FashionReviewPage'));
const FashionStoresPage = lazy(() => import('./components/fashion/FashionStoresPage'));
const FashionUsersPage = lazy(() => import('./components/fashion/FashionUsersPage'));
const FashionListingEditorPage = lazy(() => import('./components/fashion/FashionListingEditorPage'));
const FashionIncidentsPage = lazy(() => import('./components/fashion/FashionIncidentsPage'));
const FashionSettingsPage = lazy(() => import('./components/fashion/FashionSettingsPage'));
const FashionPasswordPage = lazy(() => import('./components/fashion/FashionPasswordPage'));
const FashionCapturePage = lazy(() => import('./components/fashion/FashionCapturePage'));
const FashionIntakePage = lazy(() => import('./components/fashion/FashionIntakePage'));
const FashionActivityReportPage = lazy(() => import('./components/fashion/FashionActivityReportPage'));
// Fashion "Publish next N" pipeline: batch progress + compliance review queue.
const FashionBatchesPage = lazy(() => import('./components/fashion/batch/FashionBatchesPage'));
const FashionComplianceReviewPage = lazy(() => import('./components/fashion/batch/FashionComplianceReviewPage'));
const BusinessIndustrialLoginPage = lazy(() => import('./components/business-industrial/BusinessIndustrialLoginPage'));
const BusinessIndustrialShell = lazy(() => import('./components/business-industrial/BusinessIndustrialShell'));
const BusinessIndustrialDashboardPage = lazy(() => import('./components/business-industrial/BusinessIndustrialDashboardPage'));
const BusinessIndustrialCatalogWorkspacePage = lazy(() => import('./components/business-industrial/BusinessIndustrialCatalogWorkspacePage'));
const BusinessIndustrialListingsPage = lazy(() => import('./components/business-industrial/BusinessIndustrialListingsPage'));
const BusinessIndustrialImportPage = lazy(() => import('./components/business-industrial/BusinessIndustrialImportPage'));
const BusinessIndustrialImageIntakeWorkspacePage = lazy(() => import('./components/business-industrial/BusinessIndustrialImageIntakeWorkspacePage'));
const BusinessIndustrialReviewPage = lazy(() => import('./components/business-industrial/BusinessIndustrialReviewPage'));
const BusinessIndustrialStoresPage = lazy(() => import('./components/business-industrial/BusinessIndustrialStoresPage'));
const BusinessIndustrialIncidentsPage = lazy(() => import('./components/business-industrial/BusinessIndustrialIncidentsPage'));
const BusinessIndustrialUsersPage = lazy(() => import('./components/business-industrial/BusinessIndustrialUsersPage'));
const PartsSearchShell = lazy(() => import('./components/parts-search/PartsSearchShell'));
const PartsSearchHomePage = lazy(() => import('./components/parts-search/PartsSearchHomePage'));
const PartsSearchResultsPage = lazy(() => import('./components/parts-search/PartsSearchResultsPage'));
const PartsSearchPartPage = lazy(() => import('./components/parts-search/PartsSearchPartPage'));
const PartsSearchDemandPage = lazy(() => import('./components/parts-search/PartsSearchDemandPage'));

function RouteFallback() {
    return (
        <div className="flex min-h-[40vh] items-center justify-center text-slate-500 dark:text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin" />
        </div>
    );
}

function AutoPartsRoutes() {
    const { pathname, search, hash } = useLocation();
    const duplicatedPrefix = '/auto-parts/auto-parts';
    if (pathname === duplicatedPrefix || pathname.startsWith(`${duplicatedPrefix}/`)) {
        const canonicalPath = pathname.replace(/^\/auto-parts\/auto-parts(?=\/|$)/, '/auto-parts');
        return <Navigate to={`${canonicalPath}${search}${hash}`} replace />;
    }

    const protect = (permission: string, element: ReactNode, mode: 'any' | 'all' = 'any') => (
        <ProtectedRoute permissions={[permission]} mode={mode} loginPath="/auto-parts/login">
            {element}
        </ProtectedRoute>
    );

    return <Suspense fallback={<RouteFallback />}><Routes>
        <Route index element={protect('dashboard.view', <Dashboard />)} />
        <Route path="listings/new" element={protect('listings.create', <SingleListingPipeline />)} />
        <Route path="listings/:id/edit" element={protect('listings.update', <ListingEditor />)} />
        <Route path="listings/:id/history" element={protect('listings.view', <RevisionHistory />)} />
        <Route path="ingestion" element={protect('ingestion.view', <IngestionManager />)} />
        <Route path="fitment" element={protect('fitment.view', <FitmentManager />)} />
        <Route path="fitment/vin" element={protect('fitment.view', <VinListingsPage />)} />
        <Route path="catalog" element={protect('catalog.view', <CatalogManager />)} />
        <Route path="catalog/import" element={protect('catalog.import', <CatalogImportDashboard />)} />
        <Route path="catalog/motors-filters" element={protect('catalog.view', <CatalogMotorsFiltersPage />)} />
        <Route path="catalog/products/:id" element={protect('catalog.view', <CatalogProductDetail />)} />
        <Route path="catalog/products/:productId/publish/ebay" element={protect('ebay.publish', <EbayPublishWizardPage />)} />
        <Route path="inventory" element={protect('inventory.view', <InventoryManager />)} />
        <Route path="inventory/:id/edit" element={<ProtectedRoute permissions={['inventory.view', 'listings.update']} mode="all" loginPath="/auto-parts/login"><InventoryListingEditor /></ProtectedRoute>} />
        {/* Warehouse stock (/api/stock) — shared StockWorkspace, also mounted under /fashion and /business-industrial */}
        <Route path="stock" element={protect('stock.view', <StockWorkspace vertical="automotive" />)} />
        <Route path="published-listings" element={protect('published_listings.view', <PublishedListingsPage />)} />
        <Route path="published-listings/:id" element={protect('published_listings.view', <PublishedListingDetailPage />)} />
        <Route path="bulk-actions" element={protect('listings.update', <BulkActionsPage />)} />
        <Route path="orders" element={protect('orders.view', <OrdersPage />)} />
        <Route path="settings" element={protect('settings.view', <SettingsPage />)} />
        <Route path="settings/client" element={protect('client_settings.view', <ClientSettingsPage />)} />
        <Route path="settings/users" element={protect('users.view', <UsersAdminPage />)} />
        <Route path="settings/teams" element={protect('teams.manage', <TeamsAdminPage />)} />
        <Route path="settings/permissions" element={protect('roles.view', <PermissionsPage />)} />
        <Route path="settings/ai-routing" element={protect('ai.routing.view', <AiRoutingDashboardPage />)} />
        <Route path="settings/integrations/ebay" element={protect('ebay.view', <EbayStoresSettingsPage />)} />
        <Route path="settings/integrations/ebay/:accountId" element={protect('ebay.view', <EbayStoreDetailPage />)} />
        <Route path="settings/integrations/ebay/:accountId/policies" element={protect('ebay.manage', <EbayPolicyMappingPage />)} />
        <Route path="automation" element={protect('automation.view', <AutomationRulesPage />)} />
        <Route path="templates" element={protect('templates.view', <TemplateManagerPage />)} />
        <Route path="audit" element={protect('audit.view', <AuditTrailPage />)} />
        <Route path="notifications" element={protect('notifications.view', <NotificationsPage />)} />
        <Route path="sku/:id" element={protect('catalog.view', <SkuDetailPage />)} />
        <Route path="motors" element={protect('motors.view', <MotorsDashboard />)} />
        <Route path="motors/upload" element={protect('motors.manage', <AIUploadWizard />)} />
        <Route path="motors/review" element={protect('motors.review', <ReviewQueue />)} />
        <Route path="motors/:id" element={protect('motors.view', <MotorsProductDetail />)} />
        <Route path="pipeline" element={protect('pipeline.view', <PipelinePage />)} />
        <Route path="image-drive" element={protect('image_drive.view', <ImageDrivePage />)} />
        <Route path="preview" element={protect('listings.view', <EbayPreviewPage />)} />
        <Route path="*" element={<div className="p-10 text-center text-slate-500 dark:text-slate-400">Auto Parts page not found</div>} />
    </Routes></Suspense>;
}

function LegacyAutoPartsRedirect() {
    const { pathname, search, hash } = useLocation();
    const roots = ['/listings', '/ingestion', '/fitment', '/catalog', '/inventory', '/published-listings', '/bulk-actions', '/orders', '/settings', '/automation', '/templates', '/audit', '/notifications', '/sku', '/motors', '/pipeline', '/image-drive', '/preview'];
    const legacyAutoRoute = roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
    if (legacyAutoRoute) {
        return <Navigate to={`/auto-parts${pathname}${search}${hash}`} replace />;
    }
    return <div className="min-h-screen bg-slate-50 p-10 text-center text-slate-600 dark:bg-slate-950 dark:text-slate-300"><h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Page not found</h1><Link to="/" className="mt-4 inline-block text-blue-600 dark:text-blue-400">Return to Omni Core</Link></div>;
}


function App() {
    return (
        <QueryProvider>
        <AuthProvider>
        <BrandingProvider>
        <Router>
            <Suspense fallback={<RouteFallback />}>
            <Routes>
                {/* Omni Core's root is public; protected workspaces remain vertical-specific. */}
                <Route path="/" element={<LandingPage />} />

                {/* Auth routes (no Shell) */}
                <Route path="/login" element={<LoginPage redirectTo="/auto-parts" />} />
                <Route path="/auto-parts/login" element={<LoginPage redirectTo="/auto-parts" />} />
                <Route path="/fashion/login" element={<FashionLoginPage />} />
                <Route path="/fashion/change-password" element={<ProtectedRoute loginPath="/fashion/login"><FashionPasswordPage /></ProtectedRoute>} />
                <Route path="/auto-parts/change-password" element={<ProtectedRoute loginPath="/auto-parts/login"><FashionPasswordPage /></ProtectedRoute>} />
                <Route path="/business-industrial/change-password" element={<ProtectedRoute loginPath="/business-industrial/login"><FashionPasswordPage /></ProtectedRoute>} />
                <Route path="/business-industrial/login" element={<BusinessIndustrialLoginPage />} />
                {/* Parts Search signs in with the Auto Parts check (dashboard.view). */}
                <Route path="/parts-search/login" element={<LoginPage redirectTo="/parts-search" heading="Sign in to Parts Search" />} />
                <Route path="/parts-search/change-password" element={<ProtectedRoute loginPath="/parts-search/login"><FashionPasswordPage /></ProtectedRoute>} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/channels/ebay/callback" element={<EbayOAuthCallback />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />

                {/* Auto Parts owns its complete route tree under one vertical prefix;
                    AutoPartsRoutes also repairs links with a duplicated prefix. */}
                <Route path="/auto-parts/*" element={
                    <ProtectedRoute permissions={['dashboard.view']} loginPath="/auto-parts/login">
                        <Shell><AutoPartsRoutes /></Shell>
                    </ProtectedRoute>
                } />


                {/* Parts Search portal: PartsBazar360 universal search. A sibling of the
                    workspaces, not part of /auto-parts, but gated on the same permission
                    (dashboard.view) so exactly the Auto Parts users can open it. */}
                <Route path="/parts-search" element={
                    <ProtectedRoute permissions={['dashboard.view']} loginPath="/parts-search/login">
                        <PartsSearchShell><Suspense fallback={<RouteFallback />}><Outlet /></Suspense></PartsSearchShell>
                    </ProtectedRoute>
                }>
                    <Route index element={<PartsSearchHomePage />} />
                    <Route path="results" element={<PartsSearchResultsPage />} />
                    <Route path="parts/:id" element={<PartsSearchPartPage />} />
                    <Route path="demand" element={<PartsSearchDemandPage />} />
                    <Route path="*" element={<div className="p-10 text-center text-slate-500 dark:text-slate-400"><h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Parts Search page not found</h1><Link to="/parts-search" className="mt-4 inline-block text-sky-600 dark:text-sky-400">Return to search</Link></div>} />
                </Route>

                {/* Fashion routes use a separate shell and permission boundary. */}
                <Route path="/fashion" element={
                    <ProtectedRoute permissions={['fashion.access']} loginPath="/fashion/login">
                        <FashionShell><Suspense fallback={<RouteFallback />}><Outlet /></Suspense></FashionShell>
                    </ProtectedRoute>
                }>
                   <Route index element={<ProtectedRoute permissions={['fashion.dashboard.view']} loginPath="/fashion/login"><FashionDashboardPage /></ProtectedRoute>} />
                   <Route path="listings/new" element={<ProtectedRoute permissions={['fashion.listings.create']} loginPath="/fashion/login"><FashionListingEditorPage /></ProtectedRoute>} />
                    {/* Quick capture: phone-first photo slots, batch SKU, measurement chart, background identification */}
                    <Route path="capture" element={<ProtectedRoute permissions={['fashion.listings.create']} loginPath="/fashion/login"><FashionCapturePage /></ProtectedRoute>} />
                    {/* Intake history: paginated capture log with batch/status filters */}
                    <Route path="intake" element={<ProtectedRoute permissions={['fashion.listings.view']} loginPath="/fashion/login"><FashionIntakePage /></ProtectedRoute>} />
                    {/* Activity report: item provenance, processing/review filters, and publication targets */}
                    <Route path="reports" element={<ProtectedRoute permissions={['fashion.listings.view']} loginPath="/fashion/login"><FashionActivityReportPage /></ProtectedRoute>} />
                    <Route path="stock" element={<ProtectedRoute permissions={['stock.view']} loginPath="/fashion/login"><StockWorkspace vertical="fashion" /></ProtectedRoute>} />
                    <Route path="catalog" element={<ProtectedRoute permissions={['fashion.listings.view']} loginPath="/fashion/login"><FashionCatalogPage /></ProtectedRoute>} />
                    <Route path="listings" element={<ProtectedRoute permissions={['fashion.listings.view']} loginPath="/fashion/login"><FashionCatalogPage /></ProtectedRoute>} />
                   <Route path="listings/:id" element={<ProtectedRoute permissions={['fashion.listings.view']} loginPath="/fashion/login"><FashionListingEditorPage /></ProtectedRoute>} />
                    <Route path="listings/:id/edit" element={<ProtectedRoute permissions={['fashion.listings.update']} loginPath="/fashion/login"><FashionListingEditorPage /></ProtectedRoute>} />
                    <Route path="import" element={<ProtectedRoute permissions={['fashion.import']} loginPath="/fashion/login"><FashionImportPage /></ProtectedRoute>} />
                    <Route path="review" element={<ProtectedRoute permissions={['fashion.review']} loginPath="/fashion/login"><FashionReviewPage /></ProtectedRoute>} />
                    <Route path="batches" element={<ProtectedRoute permissions={['fashion.listings.view']} loginPath="/fashion/login"><FashionBatchesPage /></ProtectedRoute>} />
                    <Route path="batches/:id" element={<ProtectedRoute permissions={['fashion.listings.view']} loginPath="/fashion/login"><FashionBatchesPage /></ProtectedRoute>} />
                    <Route path="compliance-review" element={<ProtectedRoute permissions={['fashion.authenticity.review']} loginPath="/fashion/login"><FashionComplianceReviewPage /></ProtectedRoute>} />
                    <Route path="stores" element={<ProtectedRoute permissions={['fashion.stores.view']} loginPath="/fashion/login"><FashionStoresPage /></ProtectedRoute>} />
                    <Route path="users" element={<ProtectedRoute permissions={['fashion.users.manage']} loginPath="/fashion/login"><FashionUsersPage /></ProtectedRoute>} />
                    <Route path="incidents" element={<ProtectedRoute permissions={['fashion.incidents.manage']} loginPath="/fashion/login"><FashionIncidentsPage /></ProtectedRoute>} />
                    <Route path="settings" element={<ProtectedRoute permissions={['fashion.settings.manage']} loginPath="/fashion/login"><FashionSettingsPage /></ProtectedRoute>} />
                    <Route path="*" element={<div><h1 className="text-2xl font-semibold">Fashion page not found</h1><Link to="/fashion" className="mt-4 inline-block text-pink-600">Return to overview</Link></div>} />
                </Route>

                {/* Business & Industrial uses a dedicated Outlet-based route tree so every
                    child screen renders inside its shell at the vertical URL. */}
                <Route path="/business-industrial" element={
                    <ProtectedRoute permissions={['business_industrial.access']} loginPath="/business-industrial/login">
                        <BusinessIndustrialShell><Suspense fallback={<RouteFallback />}><Outlet /></Suspense></BusinessIndustrialShell>
                    </ProtectedRoute>
                }>
                   <Route index element={<ProtectedRoute permissions={['business_industrial.dashboard.view']} loginPath="/business-industrial/login"><BusinessIndustrialDashboardPage /></ProtectedRoute>} />
                    <Route path="catalog" element={<ProtectedRoute permissions={['business_industrial.listings.view']} loginPath="/business-industrial/login"><BusinessIndustrialCatalogWorkspacePage /></ProtectedRoute>} />
                    <Route path="listings" element={<ProtectedRoute permissions={['business_industrial.listings.view']} loginPath="/business-industrial/login"><BusinessIndustrialCatalogWorkspacePage /></ProtectedRoute>} />
                   <Route path="listings/editor" element={<ProtectedRoute permissions={['business_industrial.listings.view']} loginPath="/business-industrial/login"><BusinessIndustrialListingsPage /></ProtectedRoute>} />
                    <Route path="image-intake" element={<ProtectedRoute permissions={['business_industrial.import']} loginPath="/business-industrial/login"><BusinessIndustrialImageIntakeWorkspacePage /></ProtectedRoute>} />
                    <Route path="import" element={<ProtectedRoute permissions={['business_industrial.import']} loginPath="/business-industrial/login"><BusinessIndustrialImportPage /></ProtectedRoute>} />
                    <Route path="review" element={<ProtectedRoute permissions={['business_industrial.review']} loginPath="/business-industrial/login"><BusinessIndustrialReviewPage /></ProtectedRoute>} />
                    <Route path="stock" element={<ProtectedRoute permissions={['stock.view']} loginPath="/business-industrial/login"><StockWorkspace vertical="business_industrial" /></ProtectedRoute>} />
                    <Route path="stores" element={<ProtectedRoute permissions={['business_industrial.stores.view']} loginPath="/business-industrial/login"><BusinessIndustrialStoresPage /></ProtectedRoute>} />
                    <Route path="incidents" element={<ProtectedRoute permissions={['business_industrial.incidents.view']} loginPath="/business-industrial/login"><BusinessIndustrialIncidentsPage /></ProtectedRoute>} />
                    <Route path="users" element={<ProtectedRoute permissions={['business_industrial.users.manage']} loginPath="/business-industrial/login"><BusinessIndustrialUsersPage /></ProtectedRoute>} />
                    <Route path="*" element={<div><h1 className="text-2xl font-semibold">Business &amp; Industrial page not found</h1><Link to="/business-industrial" className="mt-4 inline-block" style={{ color: 'var(--brand-primary)' }}>Return to overview</Link></div>} />
                </Route>
                <Route path="*" element={<LegacyAutoPartsRedirect />} />
            </Routes>
            </Suspense>
        </Router>
        </BrandingProvider>
        </AuthProvider>
        </QueryProvider>
    )
}

export default App
