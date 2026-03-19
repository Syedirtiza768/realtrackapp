
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Shell from './components/layout/Shell';
import { AuthProvider } from './components/auth/AuthContext';
import { QueryProvider } from './lib/queryProvider';

// Pages
import Dashboard from './components/dashboard/Dashboard';

import ListingEditor from './components/listings/ListingEditor';
import RevisionHistory from './components/listings/RevisionHistory';

import FitmentManager from './components/fitment/FitmentManager';

import CatalogManager from './components/catalog/CatalogManager';
import BulkActionsPage from './components/catalog/BulkActionsPage';
import CatalogImportDashboard from './components/catalog-import/CatalogImportDashboard';
import IngestionManager from './components/ingestion/IngestionManager';
import OrdersPage from './components/orders/OrdersPage';
import SettingsPage from './components/settings/SettingsPage';
import NotificationsPage from './components/notifications/NotificationsPage';
import SkuDetailPage from './components/sku/SkuDetailPage';
import AutomationRulesPage from './components/automation/AutomationRulesPage';
import TemplateManagerPage from './components/templates/TemplateManagerPage';
import AuditTrailPage from './components/audit/AuditTrailPage';
import MotorsDashboard from './components/motors/MotorsDashboard';
import MotorsProductDetail from './components/motors/MotorsProductDetail';
import ReviewQueue from './components/motors/ReviewQueue';
import AIUploadWizard from './components/motors/AIUploadWizard';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import ForgotPasswordPage from './components/auth/ForgotPasswordPage';
import EbayOAuthCallback from './components/channels/EbayOAuthCallback';


function App() {
    return (
        <QueryProvider>
        <AuthProvider>
        <Router>
            <Routes>
                {/* Auth routes (no Shell) */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/channels/ebay/callback" element={<EbayOAuthCallback />} />

                {/* App routes (with Shell) */}
                <Route path="*" element={
                    <Shell>
                        <Routes>
                            <Route path="/" element={<Dashboard />} />
                            <Route path="/listings/new" element={<ListingEditor />} />
                            <Route path="/listings/:id/edit" element={<ListingEditor />} />
                            <Route path="/listings/:id/history" element={<RevisionHistory />} />
                            <Route path="/ingestion" element={<IngestionManager />} />
                            <Route path="/fitment" element={<FitmentManager />} />
                            <Route path="/catalog" element={<CatalogManager />} />
                            <Route path="/catalog/import" element={<CatalogImportDashboard />} />
                            <Route path="/bulk-actions" element={<BulkActionsPage />} />
                            <Route path="/orders" element={<OrdersPage />} />
                            <Route path="/settings" element={<SettingsPage />} />
                            <Route path="/automation" element={<AutomationRulesPage />} />
                            <Route path="/templates" element={<TemplateManagerPage />} />
                            <Route path="/audit" element={<AuditTrailPage />} />
                            <Route path="/notifications" element={<NotificationsPage />} />
                            <Route path="/sku/:id" element={<SkuDetailPage />} />
                            <Route path="/motors" element={<MotorsDashboard />} />
                            <Route path="/motors/upload" element={<AIUploadWizard />} />
                            <Route path="/motors/review" element={<ReviewQueue />} />
                            <Route path="/motors/:id" element={<MotorsProductDetail />} />
                            <Route path="*" element={<div className="p-10 text-center text-slate-500">Page not found</div>} />
                        </Routes>
                    </Shell>
                } />
            </Routes>
        </Router>
        </AuthProvider>
        </QueryProvider>
    )
}

export default App
