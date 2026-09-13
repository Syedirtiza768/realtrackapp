import SingleListingPipeline from './components/listings/SingleListingPipeline';
import { BrowserRouter as Router, Routes, Route, Outlet, Link, Navigate, useLocation } from 'react-router-dom';
import Shell from './components/layout/Shell';
import { AuthProvider } from './components/auth/AuthContext';
import { BrandingProvider } from './contexts/BrandingContext';
import { QueryProvider } from './lib/queryProvider';

// Pages
import Dashboard from './components/dashboard/Dashboard';

import ListingEditor from './components/listings/ListingEditor';
import RevisionHistory from './components/listings/RevisionHistory';

import FitmentManager from './components/fitment/FitmentManager';

import CatalogManager from './components/catalog/CatalogManager';
import BulkActionsPage from './components/catalog/BulkActionsPage';
import CatalogImportDashboard from './components/catalog-import/CatalogImportDashboard';
import CatalogMotorsFiltersPage from './components/catalog-import/CatalogMotorsFiltersPage';
import EbayPublishWizardPage from './components/catalog/EbayPublishWizardPage';
import CatalogProductDetail from './components/catalog/CatalogProductDetail';
import IngestionManager from './components/ingestion/IngestionManager';
import OrdersPage from './components/orders/OrdersPage';
import SettingsPage from './components/settings/SettingsPage';
import EbayStoresSettingsPage from './components/settings/EbayStoresSettingsPage';
import EbayPolicyMappingPage from './components/settings/EbayPolicyMappingPage';
import EbayStoreDetailPage from './components/settings/EbayStoreDetailPage';
import NotificationsPage from './components/notifications/NotificationsPage';
import SkuDetailPage from './components/sku/SkuDetailPage';
import AutomationRulesPage from './components/automation/AutomationRulesPage';
import TemplateManagerPage from './components/templates/TemplateManagerPage';
import AuditTrailPage from './components/audit/AuditTrailPage';
import MotorsDashboard from './components/motors/MotorsDashboard';
import MotorsProductDetail from './components/motors/MotorsProductDetail';
import ReviewQueue from './components/motors/ReviewQueue';
import AIUploadWizard from './components/motors/AIUploadWizard';
import PipelinePage from './components/pipeline/PipelinePage';
import EbayPreviewPage from './components/preview/EbayPreviewPage';
import InventoryManager from './components/inventory/InventoryManager';
import InventoryListingEditor from './components/inventory/InventoryListingEditor';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import EbayOAuthCallback from './components/channels/EbayOAuthCallback';
import PrivacyPolicy from './components/legal/PrivacyPolicy';
import VinListingsPage from './components/fitment/VinListingsPage';
import ClientSettingsPage from './components/settings/ClientSettingsPage';
import UsersAdminPage from './components/settings/UsersAdminPage';
import TeamsAdminPage from './components/settings/TeamsAdminPage';
import PermissionsPage from './components/settings/PermissionsPage';
import AiRoutingDashboardPage from './components/settings/AiRoutingDashboardPage';
import PublishedListingsPage from './components/published-listings/PublishedListingsPage';
import PublishedListingDetailPage from './components/published-listings/PublishedListingDetailPage';
import ImageDrivePage from './components/image-drive/ImageDrivePage';
import LandingPage from './components/landing/LandingPage';
import FashionLoginPage from './components/fashion/FashionLoginPage';
import FashionShell from './components/fashion/FashionShell';
import FashionDashboardPage from './components/fashion/FashionDashboardPage';
import FashionCatalogPage from './components/fashion/FashionCatalogPage';
import FashionImportPage from './components/fashion/FashionImportPage';
import FashionReviewPage from './components/fashion/FashionReviewPage';
import FashionStoresPage from './components/fashion/FashionStoresPage';
import FashionUsersPage from './components/fashion/FashionUsersPage';
import FashionListingEditorPage from './components/fashion/FashionListingEditorPage';
import FashionIncidentsPage from './components/fashion/FashionIncidentsPage';
import FashionSettingsPage from './components/fashion/FashionSettingsPage';
import FashionPasswordPage from './components/fashion/FashionPasswordPage';
import BusinessIndustrialLoginPage from './components/business-industrial/BusinessIndustrialLoginPage';
import BusinessIndustrialShell from './components/business-industrial/BusinessIndustrialShell';
import BusinessIndustrialDashboardPage from './components/business-industrial/BusinessIndustrialDashboardPage';
import BusinessIndustrialCatalogWorkspacePage from './components/business-industrial/BusinessIndustrialCatalogWorkspacePage';
import BusinessIndustrialListingsPage from './components/business-industrial/BusinessIndustrialListingsPage';
import BusinessIndustrialImportPage from './components/business-industrial/BusinessIndustrialImportPage';
import BusinessIndustrialImageIntakeWorkspacePage from './components/business-industrial/BusinessIndustrialImageIntakeWorkspacePage';
import BusinessIndustrialReviewPage from './components/business-industrial/BusinessIndustrialReviewPage';
import BusinessIndustrialStoresPage from './components/business-industrial/BusinessIndustrialStoresPage';
import BusinessIndustrialIncidentsPage from './components/business-industrial/BusinessIndustrialIncidentsPage';
import BusinessIndustrialUsersPage from './components/business-industrial/BusinessIndustrialUsersPage';
import type { ReactNode } from 'react';

function AutoPartsRoutes() {
    const protect = (permission: string, element: ReactNode, mode: 'any' | 'all' = 'any') => (
        <ProtectedRoute permissions={[permission]} mode={mode} loginPath="/auto-parts/login">
            {element}
        </ProtectedRoute>
    );

    return <Routes>
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
    </Routes>;
}

function LegacyAutoPartsRedirect() {
    const { pathname, search, hash } = useLocation();
    const roots = ['/listings', '/ingestion', '/fitment', '/catalog', '/inventory', '/published-listings', '/bulk-actions', '/orders', '/settings', '/automation', '/templates', '/audit', '/notifications', '/sku', '/motors', '/pipeline', '/image-drive', '/preview'];
    const legacyAutoRoute = roots.some((root) => pathname === root || pathname.startsWith(`${root}/`));
    if (legacyAutoRoute) {
        return <Navigate to={`/auto-parts${pathname}${search}${hash}`} replace />;
    }
    return <div className="min-h-screen bg-slate-950 p-10 text-center text-slate-300"><h1 className="text-2xl font-semibold">Page not found</h1><Link to="/" className="mt-4 inline-block text-blue-400">Return to Omni Core</Link></div>;
}


function App() {
    return (
        <QueryProvider>
        <AuthProvider>
        <BrandingProvider>
        <Router>
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
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/channels/ebay/callback" element={<EbayOAuthCallback />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />

                {/* Auto Parts owns its complete route tree under one vertical prefix. */}
                <Route path="/auto-parts/*" element={
                    <ProtectedRoute permissions={['dashboard.view']} loginPath="/auto-parts/login">
                        <Shell><AutoPartsRoutes /></Shell>
                    </ProtectedRoute>
                } />


                {/* Fashion routes use a separate shell and permission boundary. */}
                <Route path="/fashion" element={
                    <ProtectedRoute permissions={['fashion.access']} loginPath="/fashion/login">
                        <FashionShell><Outlet /></FashionShell>
                    </ProtectedRoute>
                }>
                   <Route index element={<ProtectedRoute permissions={['fashion.dashboard.view']} loginPath="/fashion/login"><FashionDashboardPage /></ProtectedRoute>} />
                   <Route path="listings/new" element={<ProtectedRoute permissions={['fashion.listings.create']} loginPath="/fashion/login"><FashionListingEditorPage /></ProtectedRoute>} />
                    <Route path="catalog" element={<ProtectedRoute permissions={['fashion.listings.view']} loginPath="/fashion/login"><FashionCatalogPage /></ProtectedRoute>} />
                    <Route path="listings" element={<ProtectedRoute permissions={['fashion.listings.view']} loginPath="/fashion/login"><FashionCatalogPage /></ProtectedRoute>} />
                   <Route path="listings/:id" element={<ProtectedRoute permissions={['fashion.listings.view']} loginPath="/fashion/login"><FashionListingEditorPage /></ProtectedRoute>} />
                    <Route path="listings/:id/edit" element={<ProtectedRoute permissions={['fashion.listings.update']} loginPath="/fashion/login"><FashionListingEditorPage /></ProtectedRoute>} />
                    <Route path="import" element={<ProtectedRoute permissions={['fashion.import']} loginPath="/fashion/login"><FashionImportPage /></ProtectedRoute>} />
                    <Route path="review" element={<ProtectedRoute permissions={['fashion.review']} loginPath="/fashion/login"><FashionReviewPage /></ProtectedRoute>} />
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
                        <BusinessIndustrialShell><Outlet /></BusinessIndustrialShell>
                    </ProtectedRoute>
                }>
                   <Route index element={<ProtectedRoute permissions={['business_industrial.dashboard.view']} loginPath="/business-industrial/login"><BusinessIndustrialDashboardPage /></ProtectedRoute>} />
                    <Route path="catalog" element={<ProtectedRoute permissions={['business_industrial.listings.view']} loginPath="/business-industrial/login"><BusinessIndustrialCatalogWorkspacePage /></ProtectedRoute>} />
                    <Route path="listings" element={<ProtectedRoute permissions={['business_industrial.listings.view']} loginPath="/business-industrial/login"><BusinessIndustrialCatalogWorkspacePage /></ProtectedRoute>} />
                   <Route path="listings/editor" element={<ProtectedRoute permissions={['business_industrial.listings.view']} loginPath="/business-industrial/login"><BusinessIndustrialListingsPage /></ProtectedRoute>} />
                    <Route path="image-intake" element={<ProtectedRoute permissions={['business_industrial.import']} loginPath="/business-industrial/login"><BusinessIndustrialImageIntakeWorkspacePage /></ProtectedRoute>} />
                    <Route path="import" element={<ProtectedRoute permissions={['business_industrial.import']} loginPath="/business-industrial/login"><BusinessIndustrialImportPage /></ProtectedRoute>} />
                    <Route path="review" element={<ProtectedRoute permissions={['business_industrial.review']} loginPath="/business-industrial/login"><BusinessIndustrialReviewPage /></ProtectedRoute>} />
                    <Route path="stores" element={<ProtectedRoute permissions={['business_industrial.stores.view']} loginPath="/business-industrial/login"><BusinessIndustrialStoresPage /></ProtectedRoute>} />
                    <Route path="incidents" element={<ProtectedRoute permissions={['business_industrial.incidents.view']} loginPath="/business-industrial/login"><BusinessIndustrialIncidentsPage /></ProtectedRoute>} />
                    <Route path="users" element={<ProtectedRoute permissions={['business_industrial.users.manage']} loginPath="/business-industrial/login"><BusinessIndustrialUsersPage /></ProtectedRoute>} />
                    <Route path="*" element={<div><h1 className="text-2xl font-semibold">Business &amp; Industrial page not found</h1><Link to="/business-industrial" className="mt-4 inline-block" style={{ color: 'var(--brand-primary)' }}>Return to overview</Link></div>} />
                </Route>
                <Route path="*" element={<LegacyAutoPartsRedirect />} />
            </Routes>
        </Router>
        </BrandingProvider>
        </AuthProvider>
        </QueryProvider>
    )
}

export default App
