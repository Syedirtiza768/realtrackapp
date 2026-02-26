
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Shell from './components/layout/Shell';

// Pages
import Dashboard from './components/dashboard/Dashboard';

import ListingEditor from './components/listings/ListingEditor';
import RevisionHistory from './components/listings/RevisionHistory';

import FitmentManager from './components/fitment/FitmentManager';

import CatalogManager from './components/catalog/CatalogManager';
import IngestionManager from './components/ingestion/IngestionManager';
import OrdersPage from './components/orders/OrdersPage';
import SettingsPage from './components/settings/SettingsPage';
import NotificationsPage from './components/notifications/NotificationsPage';


function App() {
    return (
        <Router>
            <Shell>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/listings/new" element={<ListingEditor />} />
                    <Route path="/listings/:id/edit" element={<ListingEditor />} />
                    <Route path="/listings/:id/history" element={<RevisionHistory />} />
                    <Route path="/ingestion" element={<IngestionManager />} />
                    <Route path="/fitment" element={<FitmentManager />} />
                    <Route path="/catalog" element={<CatalogManager />} />
                    <Route path="/orders" element={<OrdersPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="*" element={<div className="p-10 text-center text-slate-500">Page not found</div>} />
                </Routes>
            </Shell>
        </Router>
    )
}

export default App
