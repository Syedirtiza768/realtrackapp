import { useState } from 'react';
import {
    Check,
    X,
    Filter,
    Download,
    Plus,
    Search,
    MoreHorizontal
} from 'lucide-react';
import { Card, CardContent, CardHeader } from '../ui/card';

// Mock Data
const FITMENT_DATA = [
    { id: 1, year: 2024, make: 'Toyota', model: 'Camry', trim: 'LE', engine: '2.5L L4', confidence: 99, status: 'verified' },
    { id: 2, year: 2024, make: 'Toyota', model: 'Camry', trim: 'SE', engine: '2.5L L4', confidence: 99, status: 'verified' },
    { id: 3, year: 2024, make: 'Toyota', model: 'Camry', trim: 'XLE', engine: '2.5L L4', confidence: 99, status: 'verified' },
    { id: 4, year: 2024, make: 'Toyota', model: 'Camry', trim: 'XSE', engine: '3.5L V6', confidence: 85, status: 'review' },
    { id: 5, year: 2023, make: 'Toyota', model: 'Camry', trim: 'LE', engine: '2.5L L4', confidence: 99, status: 'verified' },
    { id: 6, year: 2023, make: 'Toyota', model: 'Camry', trim: 'TRD', engine: '3.5L V6', confidence: 45, status: 'review' },
    { id: 7, year: 2022, make: 'Toyota', model: 'Camry', trim: 'Hybrid LE', engine: '2.5L L4 Hybrid', confidence: 12, status: 'rejected' },
];

export default function FitmentManager() {
    const [selected, setSelected] = useState<number[]>([]);

    const toggleSelect = (id: number) => {
        if (selected.includes(id)) {
            setSelected(selected.filter(i => i !== id));
        } else {
            setSelected([...selected, id]);
        }
    };

    const toggleAll = () => {
        if (selected.length === FITMENT_DATA.length) {
            setSelected([]);
        } else {
            setSelected(FITMENT_DATA.map(d => d.id));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Fitment Manager</h2>
                    <p className="text-slate-500">Managing compatibility for SKU: <span className="font-mono text-slate-300">ALT-TOY-245</span></p>
                </div>
                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 px-4 py-2 border border-slate-700 rounded-lg text-slate-300 hover:bg-slate-800">
                        <Download size={16} /> Import/Export
                    </button>
                    <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium">
                        <Plus size={16} /> Add Manually
                    </button>
                </div>
            </div>

            <Card>
                <CardHeader className="border-b border-slate-800 pb-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 w-96">
                            <Search size={16} className="text-slate-500" />
                            <input
                                type="text"
                                placeholder="Filter by Make, Model, or Year..."
                                className="bg-transparent border-none focus:outline-none text-sm w-full text-slate-200 placeholder:text-slate-600"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <button className="p-2 border border-slate-700 rounded-lg hover:bg-slate-800 text-slate-400">
                                <Filter size={16} />
                            </button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="relative w-full overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs uppercase bg-slate-900/50 text-slate-400 font-medium">
                                <tr>
                                    <th className="p-4 w-10">
                                        <input
                                            type="checkbox"
                                            className="rounded border-slate-700 bg-slate-800"
                                            checked={selected.length === FITMENT_DATA.length}
                                            onChange={toggleAll}
                                        />
                                    </th>
                                    <th className="p-4">Fitment Details</th>
                                    <th className="p-4">Engine / Trim</th>
                                    <th className="p-4">Confidence</th>
                                    <th className="p-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800">
                                {FITMENT_DATA.map((row) => (
                                    <tr key={row.id} className="hover:bg-slate-800/50 transition-colors">
                                        <td className="p-4">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-700 bg-slate-800"
                                                checked={selected.includes(row.id)}
                                                onChange={() => toggleSelect(row.id)}
                                            />
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-200">{row.year} {row.make} {row.model}</div>
                                            <div className="text-xs text-slate-500">ID: {row.id}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="text-slate-300">{row.trim}</div>
                                            <div className="text-xs text-slate-500">{row.engine}</div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="h-2 w-24 bg-slate-800 rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${row.confidence > 90 ? 'bg-emerald-500' :
                                                            row.confidence > 50 ? 'bg-amber-500' : 'bg-red-500'
                                                            }`}
                                                        style={{ width: `${row.confidence}%` }}
                                                    />
                                                </div>
                                                <span className={`text-xs font-medium ${row.confidence > 90 ? 'text-emerald-500' :
                                                    row.confidence > 50 ? 'text-amber-500' : 'text-red-500'
                                                    }`}>{row.confidence}%</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button className="p-1.5 hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-500 rounded">
                                                    <Check size={16} />
                                                </button>
                                                <button className="p-1.5 hover:bg-red-500/10 text-slate-400 hover:text-red-500 rounded">
                                                    <X size={16} />
                                                </button>
                                                <button className="p-1.5 hover:bg-slate-800 text-slate-400 rounded">
                                                    <MoreHorizontal size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>

            {/* Bulk Actions Bar (Conditional) */}
            {selected.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-slate-800 border border-slate-700 shadow-xl rounded-full px-6 py-3 flex items-center gap-4 animate-in slide-in-from-bottom-4">
                    <span className="text-sm font-medium text-slate-200">{selected.length} selected</span>
                    <div className="h-4 w-px bg-slate-700"></div>
                    <button className="text-sm text-emerald-400 hover:text-emerald-300 font-medium">Verify Selected</button>
                    <button className="text-sm text-red-400 hover:text-red-300 font-medium">Remove</button>
                </div>
            )}
        </div>
    );
}
