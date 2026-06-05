
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
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
import PipelineWizard from './components/pipeline/PipelineWizard';
import EbayPreviewPage from './components/preview/EbayPreviewPage';
import InventoryManager from './components/inventory/InventoryManager';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import ProtectedRoute from './components/auth/ProtectedRoute';
import EbayOAuthCallback from './components/channels/EbayOAuthCallback';
import VinListingsPage from './components/fitment/VinListingsPage';
import ClientSettingsPage from './components/settings/ClientSettingsPage';
import UsersAdminPage from './components/settings/UsersAdminPage';
import PermissionsPage from './components/settings/PermissionsPage';


function App() {
    return (
        <QueryProvider>
        <AuthProvider>
        <BrandingProvider>
        <Router>
            <Routes>
                {/* Auth routes (no Shell) */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/channels/ebay/callback" element={<EbayOAuthCallback />} />

                {/* App routes (with Shell) */}
                <Route path="*" element={
                    <ProtectedRoute>
                    <Shell>
                        <Routes>
                            <Route path="/" element={<ProtectedRoute permissions={['dashboard.view']}><Dashboard /></ProtectedRoute>} />
                            <Route path="/listings/new" element={<ProtectedRoute permissions={['listings.create']}><ListingEditor /></ProtectedRoute>} />
                            <Route path="/listings/:id/edit" element={<ProtectedRoute permissions={['listings.update']}><ListingEditor /></ProtectedRoute>} />
                            <Route path="/listings/:id/history" element={<ProtectedRoute permissions={['listings.view']}><RevisionHistory /></ProtectedRoute>} />
                            <Route path="/ingestion" element={<ProtectedRoute permissions={['ingestion.view']}><IngestionManager /></ProtectedRoute>} />
                            <Route path="/fitment" element={<ProtectedRoute permissions={['fitment.view']}><FitmentManager /></ProtectedRoute>} />
                            <Route path="/fitment/vin" element={<ProtectedRoute permissions={['fitment.view']}><VinListingsPage /></ProtectedRoute>} />
                            <Route path="/catalog" element={<ProtectedRoute permissions={['catalog.view']}><CatalogManager /></ProtectedRoute>} />
                            <Route path="/catalog/import" element={<ProtectedRoute permissions={['catalog.import']}><CatalogImportDashboard /></ProtectedRoute>} />
                            <Route path="/catalog/motors-filters" element={<ProtectedRoute permissions={['catalog.view']}><CatalogMotorsFiltersPage /></ProtectedRoute>} />
                            <Route path="/inventory" element={<ProtectedRoute permissions={['inventory.view']}><InventoryManager /></ProtectedRoute>} />
                            <Route path="/bulk-actions" element={<ProtectedRoute permissions={['listings.update']}><BulkActionsPage /></ProtectedRoute>} />
                            <Route path="/orders" element={<ProtectedRoute permissions={['orders.view']}><OrdersPage /></ProtectedRoute>} />
                            <Route path="/settings" element={<ProtectedRoute permissions={['settings.view']}><SettingsPage /></ProtectedRoute>} />
                            <Route path="/settings/client" element={<ClientSettingsPage />} />
                            <Route path="/settings/users" element={<UsersAdminPage />} />
                            <Route path="/settings/permissions" element={<PermissionsPage />} />
                            <Route path="/settings/integrations/ebay" element={<ProtectedRoute permissions={['ebay.view']}><EbayStoresSettingsPage /></ProtectedRoute>} />
                            <Route path="/settings/integrations/ebay/:accountId" element={<ProtectedRoute permissions={['ebay.view']}><EbayStoreDetailPage /></ProtectedRoute>} />
                            <Route path="/settings/integrations/ebay/:accountId/policies" element={<ProtectedRoute permissions={['ebay.manage']}><EbayPolicyMappingPage /></ProtectedRoute>} />
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
                            <Route path="/pipeline" element={<ProtectedRoute permissions={['pipeline.view']}><PipelineWizard /></ProtectedRoute>} />
                            <Route path="/preview" element={<ProtectedRoute permissions={['listings.view']}><EbayPreviewPage /></ProtectedRoute>} />
                            <Route path="*" element={<div className="p-10 text-center text-slate-400 dark:text-slate-500">Page not found</div>} />
                        </Routes>
                    </Shell>
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
