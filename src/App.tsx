import SingleListingPipeline from './components/listings/SingleListingPipeline';
import { BrowserRouter as Router, Routes, Route, Outlet, Link } from 'react-router-dom';
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
import FashionLoginPage from './components/fashion/FashionLoginPage';
import FashionShell from './components/fashion/FashionShell';
import FashionDashboardPage from './components/fashion/FashionDashboardPage';
import FashionListingsPage from './components/fashion/FashionListingsPage';
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
import BusinessIndustrialListingsPage from './components/business-industrial/BusinessIndustrialListingsPage';
import BusinessIndustrialImportPage from './components/business-industrial/BusinessIndustrialImportPage';
import BusinessIndustrialReviewPage from './components/business-industrial/BusinessIndustrialReviewPage';
import BusinessIndustrialStoresPage from './components/business-industrial/BusinessIndustrialStoresPage';
import BusinessIndustrialIncidentsPage from './components/business-industrial/BusinessIndustrialIncidentsPage';
import BusinessIndustrialUsersPage from './components/business-industrial/BusinessIndustrialUsersPage';


function App() {
    return (
        <QueryProvider>
        <AuthProvider>
        <BrandingProvider>
        <Router>
            <Routes>
                {/* Auth routes (no Shell) */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/fashion/login" element={<FashionLoginPage />} />
                <Route path="/fashion/change-password" element={<ProtectedRoute loginPath="/fashion/login"><FashionPasswordPage /></ProtectedRoute>} />
                <Route path="/business-industrial/login" element={<BusinessIndustrialLoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/channels/ebay/callback" element={<EbayOAuthCallback />} />
                <Route path="/privacy" element={<PrivacyPolicy />} />

                {/* Fashion routes use a separate shell and permission boundary. */}
                <Route path="/fashion" element={
                    <ProtectedRoute permissions={['fashion.access']} loginPath="/fashion/login">
                        <FashionShell><Outlet /></FashionShell>
                    </ProtectedRoute>
                }>
                    <Route index element={<ProtectedRoute permissions={['fashion.dashboard.view']} loginPath="/fashion/login"><FashionDashboardPage /></ProtectedRoute>} />
                    <Route path="listings" element={<ProtectedRoute permissions={['fashion.listings.view']} loginPath="/fashion/login"><FashionListingsPage /></ProtectedRoute>} />
                    <Route path="listings/new" element={<ProtectedRoute permissions={['fashion.listings.create']} loginPath="/fashion/login"><FashionListingEditorPage /></ProtectedRoute>} />
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

                {/* App routes (with Shell) */}
                <Route path="*" element={
                    <ProtectedRoute>
                    <Shell>
                        <Routes>
                            <Route path="/" element={<ProtectedRoute permissions={['dashboard.view']}><Dashboard /></ProtectedRoute>} />
                            <Route path="/listings/new" element={<ProtectedRoute permissions={['listings.create']}><SingleListingPipeline /></ProtectedRoute>} />
                            <Route path="/listings/:id/edit" element={<ProtectedRoute permissions={['listings.update']}><ListingEditor /></ProtectedRoute>} />
                            <Route path="/listings/:id/history" element={<ProtectedRoute permissions={['listings.view']}><RevisionHistory /></ProtectedRoute>} />
                            <Route path="/ingestion" element={<ProtectedRoute permissions={['ingestion.view']}><IngestionManager /></ProtectedRoute>} />
                            <Route path="/fitment" element={<ProtectedRoute permissions={['fitment.view']}><FitmentManager /></ProtectedRoute>} />
                            <Route path="/fitment/vin" element={<ProtectedRoute permissions={['fitment.view']}><VinListingsPage /></ProtectedRoute>} />
                            <Route path="/catalog" element={<ProtectedRoute permissions={['catalog.view']}><CatalogManager /></ProtectedRoute>} />
                            <Route path="/catalog/import" element={<ProtectedRoute permissions={['catalog.import']}><CatalogImportDashboard /></ProtectedRoute>} />
                            <Route path="/catalog/motors-filters" element={<ProtectedRoute permissions={['catalog.view']}><CatalogMotorsFiltersPage /></ProtectedRoute>} />
                            <Route path="/inventory" element={<ProtectedRoute permissions={['inventory.view']}><InventoryManager /></ProtectedRoute>} />
                            <Route path="/published-listings" element={<ProtectedRoute permissions={['published_listings.view']}><PublishedListingsPage /></ProtectedRoute>} />
                            <Route path="/published-listings/:id" element={<ProtectedRoute permissions={['published_listings.view']}><PublishedListingDetailPage /></ProtectedRoute>} />
          <Route path="/inventory/:id/edit" element={<ProtectedRoute permissions={['inventory.view', 'listings.update']}><InventoryListingEditor /></ProtectedRoute>} />
                            <Route path="/bulk-actions" element={<ProtectedRoute permissions={['listings.update']}><BulkActionsPage /></ProtectedRoute>} />
                            <Route path="/orders" element={<ProtectedRoute permissions={['orders.view']}><OrdersPage /></ProtectedRoute>} />
                            <Route path="/settings" element={<ProtectedRoute permissions={['settings.view']}><SettingsPage /></ProtectedRoute>} />
                            <Route path="/settings/client" element={<ClientSettingsPage />} />
                            <Route path="/settings/users" element={<UsersAdminPage />} />
                            <Route path="/settings/teams" element={<TeamsAdminPage />} />
                            <Route path="/settings/permissions" element={<PermissionsPage />} />
                            <Route path="/settings/ai-routing" element={<AiRoutingDashboardPage />} />
                            <Route path="/settings/integrations/ebay" element={<ProtectedRoute permissions={['ebay.view']}><EbayStoresSettingsPage /></ProtectedRoute>} />
                            <Route path="/settings/integrations/ebay/:accountId" element={<ProtectedRoute permissions={['ebay.view']}><EbayStoreDetailPage /></ProtectedRoute>} />
                            <Route path="/settings/integrations/ebay/:accountId/policies" element={<ProtectedRoute permissions={['ebay.manage']}><EbayPolicyMappingPage /></ProtectedRoute>} />
                            <Route path="/catalog/products/:id" element={<ProtectedRoute permissions={["catalog.view"]}><CatalogProductDetail /></ProtectedRoute>} />
                            <Route path="/catalog/products/:productId/publish/ebay" element={<ProtectedRoute permissions={['ebay.publish']}><EbayPublishWizardPage /></ProtectedRoute>} />
                            <Route path="/automation" element={<ProtectedRoute permissions={['automation.view']}><AutomationRulesPage /></ProtectedRoute>} />
                            <Route path="/templates" element={<ProtectedRoute permissions={['templates.view']}><TemplateManagerPage /></ProtectedRoute>} />
                            <Route path="/audit" element={<ProtectedRoute permissions={['audit.view']}><AuditTrailPage /></ProtectedRoute>} />
                            <Route path="/notifications" element={<ProtectedRoute permissions={['notifications.view']}><NotificationsPage /></ProtectedRoute>} />
                            <Route path="/sku/:id" element={<ProtectedRoute permissions={['catalog.view']}><SkuDetailPage /></ProtectedRoute>} />
                            <Route path="/motors" element={<ProtectedRoute permissions={['motors.view']}><MotorsDashboard /></ProtectedRoute>} />
                            <Route path="/motors/upload" element={<ProtectedRoute permissions={['motors.manage']}><AIUploadWizard /></ProtectedRoute>} />
                            <Route path="/motors/review" element={<ProtectedRoute permissions={['motors.review']}><ReviewQueue /></ProtectedRoute>} />
                            <Route path="/motors/:id" element={<ProtectedRoute permissions={['motors.view']}><MotorsProductDetail /></ProtectedRoute>} />
                            <Route path="/pipeline" element={<ProtectedRoute permissions={['pipeline.view']}><PipelinePage /></ProtectedRoute>} />
                            <Route path="/image-drive" element={<ProtectedRoute permissions={['image_drive.view']}><ImageDrivePage /></ProtectedRoute>} />
                            <Route path="/preview" element={<ProtectedRoute permissions={['listings.view']}><EbayPreviewPage /></ProtectedRoute>} />
                            <Route path="*" element={<div className="p-10 text-center text-slate-500 dark:text-slate-400">Page not found</div>} />
                        </Routes>
                    </Shell>
                    </ProtectedRoute>
                } />

                {/* Business & Industrial routes use a separate shell and permission boundary. */}
                <Route path="/business-industrial/*" element={
                    <ProtectedRoute permissions={['business_industrial.access']} loginPath="/business-industrial/login">
                        <BusinessIndustrialShell>
                            <Routes>
                                <Route path="/business-industrial" element={<ProtectedRoute permissions={['business_industrial.dashboard.view']} loginPath="/business-industrial/login"><BusinessIndustrialDashboardPage /></ProtectedRoute>} />
                                <Route path="/business-industrial/listings" element={<ProtectedRoute permissions={['business_industrial.listings.view']} loginPath="/business-industrial/login"><BusinessIndustrialListingsPage /></ProtectedRoute>} />
                                <Route path="/business-industrial/import" element={<ProtectedRoute permissions={['business_industrial.import']} loginPath="/business-industrial/login"><BusinessIndustrialImportPage /></ProtectedRoute>} />
                                <Route path="/business-industrial/review" element={<ProtectedRoute permissions={['business_industrial.review']} loginPath="/business-industrial/login"><BusinessIndustrialReviewPage /></ProtectedRoute>} />
                                <Route path="/business-industrial/stores" element={<ProtectedRoute permissions={['business_industrial.stores.view']} loginPath="/business-industrial/login"><BusinessIndustrialStoresPage /></ProtectedRoute>} />
                                <Route path="/business-industrial/incidents" element={<ProtectedRoute permissions={['business_industrial.incidents.view']} loginPath="/business-industrial/login"><BusinessIndustrialIncidentsPage /></ProtectedRoute>} />
                                <Route path="/business-industrial/users" element={<ProtectedRoute permissions={['business_industrial.users.manage']} loginPath="/business-industrial/login"><BusinessIndustrialUsersPage /></ProtectedRoute>} />
                            </Routes>
                        </BusinessIndustrialShell>
                    </ProtectedRoute>
                } />
            </Routes>
        </Router>
        </BrandingProvider>
        </AuthProvider>
        </QueryProvider>
    )
}

export default App
