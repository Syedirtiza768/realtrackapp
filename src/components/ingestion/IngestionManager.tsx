import { useCallback, useEffect, useMemo, useState } from 'react';
import { Camera, Upload, Layers, Play, Trash2, Sparkles, Download, Filter, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
    checkIngestionProviderHealth,
    createIngestionService,
    getIngestionRuntimeConfig,
    type IngestionProviderHealth,
} from '../../lib/ingestionAdapters';
import { clearIngestionPersistence, loadJson, saveJson, STORAGE_KEYS } from '../../lib/persistence';
import type {
    AiGeneratedProductData,
    IngestionListingSeed,
    ImageRecognitionResult,
    IngestionJob,
    IngestionMode,
    ProductImage,
} from '../../types/platform';

type QueueJob = {
    job: IngestionJob;
    images: ProductImage[];
    recognition?: ImageRecognitionResult;
    generatedData?: AiGeneratedProductData;
};

function generateId(): string {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const angleHints = ['front', 'rear', 'side', 'label', 'connector'];

export default function IngestionManager() {
    const navigate = useNavigate();
    const runtimeConfig = useMemo(() => getIngestionRuntimeConfig(), []);
    const ingestionService = useMemo(() => {
        try {
            return createIngestionService(runtimeConfig);
        } catch {
            return null;
        }
    }, [runtimeConfig]);
    const [mode, setMode] = useState<IngestionMode>('single');
    const [stagedImages, setStagedImages] = useState<ProductImage[]>([]);
    const [queue, setQueue] = useState<QueueJob[]>(() => loadJson<QueueJob[]>(STORAGE_KEYS.ingestionQueue, []));
    const [statusFilter, setStatusFilter] = useState<'all' | IngestionJob['status']>('all');
    const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
    const [health, setHealth] = useState<IngestionProviderHealth | null>(null);
    const [healthLoading, setHealthLoading] = useState(true);
    const [healthCheckedAt, setHealthCheckedAt] = useState<string | null>(null);

    useEffect(() => {
        saveJson(STORAGE_KEYS.ingestionQueue, queue);
    }, [queue]);

    const runHealthCheck = useCallback(async () => {
        setHealthLoading(true);
        const result = await checkIngestionProviderHealth(runtimeConfig);
        setHealth(result);
        setHealthLoading(false);
        setHealthCheckedAt(new Date().toISOString());
    }, [runtimeConfig]);

    useEffect(() => {
        let disposed = false;

        const checkNow = async () => {
            setHealthLoading(true);
            const result = await checkIngestionProviderHealth(runtimeConfig);
            if (!disposed) {
                setHealth(result);
                setHealthLoading(false);
                setHealthCheckedAt(new Date().toISOString());
            }
        };

        void checkNow();

        const intervalId = window.setInterval(() => {
            if (!disposed) {
                void checkNow();
            }
        }, 30000);

        return () => {
            disposed = true;
            window.clearInterval(intervalId);
        };
    }, [runtimeConfig]);

    const canCreateJob = useMemo(() => {
        if (mode === 'single') {
            return stagedImages.length === 1;
        }
        if (mode === 'bundle') {
            return stagedImages.length >= 2;
        }
        return stagedImages.length > 0;
    }, [mode, stagedImages.length]);

    const filteredQueue = useMemo(() => {
        if (statusFilter === 'all') {
            return queue;
        }
        return queue.filter((entry) => entry.job.status === statusFilter);
    }, [queue, statusFilter]);

    const allVisibleSelected = filteredQueue.length > 0 && filteredQueue.every((entry) => selectedJobIds.includes(entry.job.id));

    const statusVariant = (status: IngestionJob['status']) => {
        if (status === 'completed') return 'success';
        if (status === 'failed' || status === 'needs_review') return 'warning';
        if (status === 'processing') return 'secondary';
        return 'outline';
    };

    const stageFiles = async (files: FileList | null, source: ProductImage['source']) => {
        if (!files || files.length === 0) {
            return;
        }

        const bundleId = mode === 'bundle' ? generateId() : undefined;
        const newImages = await Promise.all(
            Array.from(files).map(async (file, index) => ({
                id: generateId(),
                uri: await readFileAsDataUrl(file),
                source,
                bundleId,
                angle: mode === 'bundle' ? angleHints[index % angleHints.length] : undefined,
                capturedAt: new Date().toISOString(),
            })),
        );

        if (mode === 'single') {
            setStagedImages(newImages.slice(0, 1));
            return;
        }

        setStagedImages((prev) => [...prev, ...newImages]);
    };

    const createJob = () => {
        if (!canCreateJob) {
            return;
        }

        const job: IngestionJob = {
            id: generateId(),
            mode,
            imageIds: stagedImages.map((image) => image.id),
            status: 'queued',
        };

        setQueue((prev) => [{ job, images: stagedImages }, ...prev]);
        setStagedImages([]);
    };

    const processJob = async (jobId: string) => {
        if (!ingestionService) {
            setQueue((prev) =>
                prev.map((entry) =>
                    entry.job.id === jobId
                        ? {
                            ...entry,
                            job: {
                                ...entry.job,
                                status: 'failed',
                                completedAt: new Date().toISOString(),
                            },
                        }
                        : entry,
                ),
            );
            return;
        }

        let selectedJob: QueueJob | undefined;

        setQueue((prev) =>
            prev.map((entry) => {
                if (entry.job.id !== jobId) {
                    return entry;
                }
                selectedJob = entry;
                return {
                    ...entry,
                    job: {
                        ...entry.job,
                        status: 'processing',
                        startedAt: new Date().toISOString(),
                    },
                };
            }),
        );

        if (!selectedJob) {
            return;
        }

        try {
            const result = await ingestionService.process(selectedJob.job, selectedJob.images);
            setQueue((prev) =>
                prev.map((entry) =>
                    entry.job.id === jobId
                        ? {
                            ...entry,
                            job: result.job,
                            recognition: result.recognition,
                            generatedData: result.generatedData,
                        }
                        : entry,
                ),
            );
        } catch {
            setQueue((prev) =>
                prev.map((entry) =>
                    entry.job.id === jobId
                        ? {
                            ...entry,
                            job: {
                                ...entry.job,
                                status: 'failed',
                                completedAt: new Date().toISOString(),
                            },
                        }
                        : entry,
                ),
            );
        }
    };

    const processAllQueued = async () => {
        if (!ingestionService) {
            return;
        }

        const queuedIds = queue.filter((entry) => entry.job.status === 'queued').map((entry) => entry.job.id);
        for (const jobId of queuedIds) {
            // eslint-disable-next-line no-await-in-loop
            await processJob(jobId);
        }
    };

    const toggleJobSelection = (jobId: string) => {
        setSelectedJobIds((prev) =>
            prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId],
        );
    };

    const toggleSelectVisible = () => {
        if (allVisibleSelected) {
            const visibleIds = filteredQueue.map((entry) => entry.job.id);
            setSelectedJobIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
            return;
        }

        const visibleIds = filteredQueue.map((entry) => entry.job.id);
        setSelectedJobIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    };

    const deleteSelectedJobs = () => {
        if (selectedJobIds.length === 0) {
            return;
        }
        setQueue((prev) => prev.filter((entry) => !selectedJobIds.includes(entry.job.id)));
        setSelectedJobIds([]);
    };

    const exportQueue = () => {
        const payload = JSON.stringify(filteredQueue, null, 2);
        const blob = new Blob([payload], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `ingestion-queue-${new Date().toISOString().slice(0, 10)}.json`;
        anchor.click();
        URL.revokeObjectURL(url);
    };

    const clearPersistedData = () => {
        clearIngestionPersistence();
        setQueue([]);
        setStagedImages([]);
        setSelectedJobIds([]);
    };

    const createListingDraft = (entry: QueueJob) => {
        if (!entry.recognition || !entry.generatedData) {
            return;
        }

        const seed: IngestionListingSeed = {
            recognition: entry.recognition,
            generatedData: entry.generatedData,
            images: entry.images,
        };

        saveJson(STORAGE_KEYS.ingestionListingSeed, seed);

        navigate('/listings/new', {
            state: {
                ingestionSeed: seed,
            },
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Image Ingestion</h2>
                    <p className="text-slate-500">Capture or upload part images, then run AI recognition and product enrichment.</p>
                    <div className="mt-2 flex items-center gap-2">
                        <Badge variant="outline">Provider: {runtimeConfig.provider}</Badge>
                        <Badge
                            variant={
                                healthLoading
                                    ? 'secondary'
                                    : health?.healthy
                                        ? 'success'
                                        : 'warning'
                            }
                        >
                            {healthLoading ? 'Checking health...' : health?.message ?? 'Unknown status'}
                        </Badge>
                    </div>
                    {runtimeConfig.provider === 'api' && !healthLoading && !health?.healthy && (
                        <p className="text-xs text-amber-400 mt-2">
                            API mode is unhealthy. Verify `VITE_INGESTION_API_BASE_URL` and health endpoint before processing jobs.
                        </p>
                    )}
                    {healthCheckedAt && (
                        <p className="text-xs text-slate-500 mt-1">
                            Last checked: {new Date(healthCheckedAt).toLocaleTimeString()}
                        </p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <button
                        className="flex items-center gap-2 px-3 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={() => void runHealthCheck()}
                        disabled={healthLoading}
                    >
                        <RefreshCw size={14} className={healthLoading ? 'animate-spin' : ''} /> Re-check health
                    </button>
                    <button
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        onClick={processAllQueued}
                        disabled={!queue.some((entry) => entry.job.status === 'queued') || !ingestionService || !!(runtimeConfig.provider === 'api' && !healthLoading && !health?.healthy)}
                    >
                        <Play size={16} /> Process queued jobs
                    </button>
                </div>
            </div>

            <Card>
                <CardHeader className="border-b border-slate-800">
                    <CardTitle>Ingestion Input</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                    <div className="flex flex-wrap gap-2">
                        {([
                            { value: 'single', label: 'Single Image' },
                            { value: 'bulk', label: 'Bulk Upload' },
                            { value: 'bundle', label: 'Bundled Set' },
                        ] as Array<{ value: IngestionMode; label: string }>).map((option) => (
                            <button
                                key={option.value}
                                onClick={() => {
                                    setMode(option.value);
                                    setStagedImages([]);
                                }}
                                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                                    mode === option.value
                                        ? 'bg-blue-600/10 text-blue-400 border-blue-500/40'
                                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                        <label className="flex items-center justify-center gap-2 h-28 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer text-slate-300">
                            <Camera size={18} />
                            <span className="text-sm font-medium">Capture via Camera</span>
                            <input
                                type="file"
                                accept="image/*"
                                capture="environment"
                                multiple={mode !== 'single'}
                                className="hidden"
                                onChange={(event) => stageFiles(event.target.files, 'camera')}
                            />
                        </label>

                        <label className="flex items-center justify-center gap-2 h-28 rounded-lg border border-slate-700 bg-slate-900 hover:bg-slate-800 cursor-pointer text-slate-300">
                            <Upload size={18} />
                            <span className="text-sm font-medium">Upload from Device</span>
                            <input
                                type="file"
                                accept="image/*"
                                multiple={mode !== 'single'}
                                className="hidden"
                                onChange={(event) => stageFiles(event.target.files, 'upload')}
                            />
                        </label>
                    </div>

                    <div className="flex items-center justify-between">
                        <div className="text-sm text-slate-400">
                            {mode === 'single' && 'Single mode expects one image.'}
                            {mode === 'bulk' && 'Bulk mode accepts multiple images across many parts.'}
                            {mode === 'bundle' && 'Bundle mode groups multi-angle images for one part.'}
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                className="px-3 py-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800"
                                onClick={() => setStagedImages([])}
                            >
                                Clear staged
                            </button>
                            <button
                                className="px-3 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                disabled={!canCreateJob}
                                onClick={createJob}
                            >
                                Create ingestion job
                            </button>
                        </div>
                    </div>

                    {stagedImages.length > 0 && (
                        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
                            {stagedImages.map((image) => (
                                <div key={image.id} className="rounded-lg border border-slate-700 overflow-hidden bg-slate-900">
                                    <img src={image.uri} alt="Staged part" className="w-full h-24 object-cover" />
                                    <div className="p-2 text-xs text-slate-400 flex items-center justify-between">
                                        <span>{image.source}</span>
                                        <span>{image.angle ?? 'n/a'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="border-b border-slate-800 flex flex-row items-center justify-between">
                    <CardTitle>Ingestion Job Queue</CardTitle>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 border border-slate-700 rounded-lg px-2 py-1.5 bg-slate-900">
                            <Filter size={14} className="text-slate-500" />
                            <select
                                value={statusFilter}
                                onChange={(event) => setStatusFilter(event.target.value as 'all' | IngestionJob['status'])}
                                className="bg-transparent text-sm text-slate-300 focus:outline-none"
                            >
                                <option value="all">All statuses</option>
                                <option value="queued">Queued</option>
                                <option value="processing">Processing</option>
                                <option value="completed">Completed</option>
                                <option value="needs_review">Needs review</option>
                                <option value="failed">Failed</option>
                            </select>
                        </div>
                        <button
                            className="px-3 py-1.5 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm disabled:opacity-50"
                            onClick={toggleSelectVisible}
                            disabled={filteredQueue.length === 0}
                        >
                            {allVisibleSelected ? 'Unselect visible' : 'Select visible'}
                        </button>
                        <button
                            className="p-2 rounded-lg border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                            onClick={exportQueue}
                            disabled={filteredQueue.length === 0}
                            title="Export current queue view"
                        >
                            <Download size={14} />
                        </button>
                        <button
                            className="px-3 py-1.5 rounded-lg border border-red-700/50 text-red-400 hover:bg-red-900/20 text-sm disabled:opacity-50"
                            onClick={deleteSelectedJobs}
                            disabled={selectedJobIds.length === 0}
                        >
                            Delete selected ({selectedJobIds.length})
                        </button>
                        <button
                            className="px-3 py-1.5 rounded-lg border border-amber-700/50 text-amber-400 hover:bg-amber-900/20 text-sm"
                            onClick={clearPersistedData}
                        >
                            Reset persisted
                        </button>
                        <Badge variant="secondary">{filteredQueue.length}/{queue.length} jobs</Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-6">
                    {filteredQueue.length === 0 ? (
                        <div className="text-sm text-slate-500">No jobs yet. Stage images and create an ingestion job.</div>
                    ) : (
                        <div className="space-y-3">
                            {filteredQueue.map((entry) => (
                                <div key={entry.job.id} className="rounded-lg border border-slate-700 p-4 bg-slate-900/60">
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                className="rounded border-slate-700 bg-slate-800"
                                                checked={selectedJobIds.includes(entry.job.id)}
                                                onChange={() => toggleJobSelection(entry.job.id)}
                                            />
                                            <Badge variant="outline">{entry.job.mode}</Badge>
                                            <span className="text-sm text-slate-300">{entry.images.length} images</span>
                                            <Badge variant={statusVariant(entry.job.status)}>{entry.job.status}</Badge>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                className="px-3 py-1.5 rounded-lg text-sm border border-slate-700 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                                                onClick={() => processJob(entry.job.id)}
                                                disabled={entry.job.status !== 'queued' || !ingestionService || !!(runtimeConfig.provider === 'api' && !healthLoading && !health?.healthy)}
                                            >
                                                Run AI
                                            </button>
                                            <button
                                                className="px-3 py-1.5 rounded-lg text-sm border border-blue-500/40 text-blue-400 hover:bg-blue-600/10 disabled:opacity-50"
                                                onClick={() => createListingDraft(entry)}
                                                disabled={entry.job.status !== 'completed' || !entry.recognition || !entry.generatedData}
                                            >
                                                Create listing
                                            </button>
                                            <button
                                                className="p-2 rounded-lg border border-slate-700 text-slate-400 hover:bg-slate-800"
                                                onClick={() => setQueue((prev) => prev.filter((jobEntry) => jobEntry.job.id !== entry.job.id))}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>

                                    {entry.recognition && entry.generatedData && (
                                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                                            <div className="rounded-lg border border-slate-700 p-3">
                                                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2">Recognition</div>
                                                <div className="space-y-1 text-sm">
                                                    <div className="text-slate-200">{entry.recognition.partName}</div>
                                                    <div className="text-slate-400">{entry.recognition.category}</div>
                                                    <div className="text-slate-400">Brand: {entry.recognition.brand ?? 'Unknown'}</div>
                                                    <div className="text-slate-400">Confidence: {entry.recognition.confidence}%</div>
                                                </div>
                                            </div>
                                            <div className="rounded-lg border border-slate-700 p-3">
                                                <div className="text-xs uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1">
                                                    <Sparkles size={12} /> Generated Listing Seed
                                                </div>
                                                <div className="space-y-1 text-sm">
                                                    <div className="text-slate-200 line-clamp-1">{entry.generatedData.seoTitle}</div>
                                                    <div className="text-slate-400">Category: {entry.generatedData.suggestedCategory}</div>
                                                    <div className="text-slate-400">Specifics: {Object.keys(entry.generatedData.itemSpecifics).length}</div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="border-b border-slate-800">
                    <CardTitle>Bundled Set Guidance</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 text-sm text-slate-400 flex items-start gap-3">
                    <Layers size={16} className="mt-0.5 text-slate-500" />
                    Bundle mode is intended for one part with multiple angles (front, side, connector, label), improving AI condition and part-type confidence before listing generation.
                </CardContent>
            </Card>
        </div>
    );
}

function readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
    });
}
