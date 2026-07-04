import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import {
  Upload,
  Download,
  Loader2,
  AlertCircle,
  Info,
  Plus,
  History,
  CloudUpload,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useUploadPipelineFile } from '../../lib/pipelineApi';
import { listTeams, PIPELINE_CONDITIONS, type PipelineConditionLabel } from '../../lib/teamsApi';
import { ProcessingStep } from './PipelineWizard';
import PipelineQueue from './PipelineQueue';

export interface BulkUploadHandle {
  startUpload: () => void;
  focusUpload: () => void;
}

export default function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeJobId = searchParams.get('job');
  const uploadRef = useRef<BulkUploadHandle>(null);
  const queueRef = useRef<HTMLDivElement>(null);

  const closeJob = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const openJob = useCallback(
    (id: string) => {
      setSearchParams({ job: id }, { replace: true });
    },
    [setSearchParams],
  );

  const scrollToQueue = useCallback(() => {
    queueRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  if (activeJobId) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pipeline</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">Job processing detail</p>
        </div>
        <ProcessingStep jobId={activeJobId} onBack={closeJob} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        onUploadHistory={scrollToQueue}
        onStartUpload={() => uploadRef.current?.startUpload()}
      />

      <BulkUploadCard ref={uploadRef} onJobCreated={openJob} />

      <div ref={queueRef}>
        <PipelineQueue onViewJob={openJob} />
      </div>
    </div>
  );
}

function PageHeader({
  onUploadHistory,
  onStartUpload,
}: {
  onUploadHistory: () => void;
  onStartUpload: () => void;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pipeline</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Bulk upload parts, assign teams, and push inventory into the catalog.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onUploadHistory}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <History className="h-4 w-4" />
          Upload History
        </button>
        <a
          href="/pipeline-template.csv"
          download
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Download className="h-4 w-4" />
          Download Template
        </a>
        <button
          type="button"
          onClick={onStartUpload}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500"
        >
          <Plus className="h-4 w-4" />
          Start Upload
        </button>
      </div>
    </div>
  );
}

const BulkUploadCard = forwardRef<BulkUploadHandle, { onJobCreated: (jobId: string) => void }>(
  function BulkUploadCard({ onJobCreated }, ref) {
    const cardRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);
    const [condition, setCondition] = useState<PipelineConditionLabel>('Used');
    const [teamId, setTeamId] = useState('');
    const [pendingFile, setPendingFile] = useState<File | null>(null);
    const { upload, uploading, progress, error } = useUploadPipelineFile();

    const { data: teams = [], isLoading: teamsLoading } = useQuery({
      queryKey: ['teams'],
      queryFn: ({ signal }) => listTeams(signal),
    });

    const selectedTeamId = teamId || teams[0]?.id || '';

    const submitUpload = useCallback(
      async (file: File) => {
        if (!selectedTeamId) {
          alert('Select a team before uploading.');
          return;
        }
        try {
          const result = await upload(file, selectedTeamId, condition);
          if (result?.job?.id) onJobCreated(result.job.id);
        } catch {
          // hook sets error
        }
      },
      [upload, selectedTeamId, condition, onJobCreated],
    );

    const handleFile = useCallback((file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
        alert('Please upload a CSV or XLSX file');
        return;
      }
      setPendingFile(file);
    }, []);

    const startUpload = useCallback(() => {
      if (pendingFile) {
        void submitUpload(pendingFile);
      } else {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        fileInputRef.current?.click();
      }
    }, [pendingFile, submitUpload]);

    useImperativeHandle(ref, () => ({
      startUpload,
      focusUpload: () => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        fileInputRef.current?.click();
      },
    }));

    return (
      <div ref={cardRef}>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <CloudUpload className="h-4 w-4 text-slate-500" />
            Bulk Upload
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:max-w-xl">
            <label className="block text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-300">Condition</span>
              <select
                value={condition}
                onChange={(e) => setCondition(e.target.value as PipelineConditionLabel)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
              >
                {PIPELINE_CONDITIONS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-300">Team</span>
              <select
                value={selectedTeamId}
                onChange={(e) => setTeamId(e.target.value)}
                disabled={teamsLoading || teams.length === 0}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800"
              >
                {teams.length === 0 ? (
                  <option value="">No teams available</option>
                ) : (
                  teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))
                )}
              </select>
            </label>
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const file = e.dataTransfer.files?.[0];
              if (file) handleFile(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-lg border-2 border-dashed p-10 text-center transition ${
              dragOver
                ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10'
                : 'border-slate-200 hover:border-slate-400 dark:border-slate-600'
            } ${uploading ? 'pointer-events-none opacity-60' : ''}`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {uploading ? (
              <div className="space-y-2">
                <Loader2 className="mx-auto h-10 w-10 animate-spin text-blue-500" />
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Uploading… {progress}%
                </p>
              </div>
            ) : (
              <>
                <Upload className="mx-auto mb-3 h-10 w-10 text-slate-400" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {pendingFile
                    ? pendingFile.name
                    : 'Drag and drop your file here or click to browse'}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  CSV or XLSX files up to 50MB
                </p>
              </>
            )}
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>The selected team will be assigned to every part in this upload.</span>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}

          {pendingFile && !uploading && (
            <button
              type="button"
              onClick={() => void submitUpload(pendingFile)}
              disabled={!selectedTeamId || teams.length === 0}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 py-2.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50 sm:w-auto sm:px-6"
            >
              <Plus className="h-4 w-4" />
              Start Upload
            </button>
          )}
        </CardContent>
      </Card>
      </div>
    );
  },
);
