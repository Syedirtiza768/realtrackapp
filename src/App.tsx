
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Shell from './components/layout/Shell';

// Placeholder Pages
import Dashboard from './components/dashboard/Dashboard';

import ListingEditor from './components/listings/ListingEditor';

import FitmentManager from './components/fitment/FitmentManager';

import CatalogManager from './components/catalog/CatalogManager';
import IngestionManager from './components/ingestion/IngestionManager';


function App() {
    return (
        <Router>
            <Shell>
                <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/listings/new" element={<ListingEditor />} />
                    <Route path="/ingestion" element={<IngestionManager />} />
                    <Route path="/fitment" element={<FitmentManager />} />
                    <Route path="/catalog" element={<CatalogManager />} />
                    <Route path="*" element={<div className="p-10 text-center text-slate-500">Page not found</div>} />
                </Routes>
            </Shell>
        </Router>
    )
}

export default App
