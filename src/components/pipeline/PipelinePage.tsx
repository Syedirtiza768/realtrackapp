import { useCallback, useRef, useState } from 'react';
import {
  Upload,
  Download,
  Loader2,
  AlertCircle,
  Info,
  Users,
  Filter,
  Shield,
  Plus,
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { useUploadPipelineFile } from '../../lib/pipelineApi';
import { listTeams, PIPELINE_CONDITIONS, type PipelineConditionLabel } from '../../lib/teamsApi';
import { ProcessingStep } from './PipelineWizard';

export default function PipelinePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeJobId = searchParams.get('job');

  const closeJob = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const openJob = useCallback(
    (id: string) => {
      setSearchParams({ job: id }, { replace: true });
    },
    [setSearchParams],
  );

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
      <PageHeader />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BulkUploadCard onJobCreated={openJob} />
        <BulkUploadRulesCard />
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Pipeline</h1>
        <p className="text-slate-500 dark:text-slate-400 mt-1">
          Bulk upload parts, assign teams, and push inventory into the catalog.
        </p>
      </div>
      <a
        href="/pipeline-template.csv"
        download
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        <Download className="h-4 w-4" />
        Download Template
      </a>
    </div>
  );
}

function BulkUploadCard({ onJobCreated }: { onJobCreated: (jobId: string) => void }) {
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

  const handleFile = useCallback(
    (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
        alert('Please upload a CSV or XLSX file');
        return;
      }
      setPendingFile(file);
    },
    [],
  );

  const startUpload = () => {
    if (pendingFile) void submitUpload(pendingFile);
    else fileInputRef.current?.click();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Bulk Upload</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Condition</span>
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value as PipelineConditionLabel)}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm"
            >
              {PIPELINE_CONDITIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-slate-600 dark:text-slate-300 font-medium">Team</span>
            <select
              value={selectedTeamId}
              onChange={(e) => setTeamId(e.target.value)}
              disabled={teamsLoading || teams.length === 0}
              className="mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-sm disabled:opacity-50"
            >
              {teams.length === 0 ? (
                <option value="">No teams available</option>
              ) : (
                teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))
              )}
            </select>
          </label>
        </div>

        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) handleFile(file);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition ${
            dragOver
              ? 'border-blue-400 bg-blue-50 dark:bg-blue-500/10'
              : 'border-slate-200 dark:border-slate-600 hover:border-slate-400'
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
              <Loader2 className="h-10 w-10 text-blue-500 animate-spin mx-auto" />
              <p className="text-sm text-slate-600 dark:text-slate-300">Uploading… {progress}%</p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                {pendingFile ? pendingFile.name : 'Drag and drop your file here or click to browse'}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">CSV or XLSX files up to 50MB</p>
            </>
          )}
        </div>

        <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
          <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <span>The selected team will be assigned to every part in this upload.</span>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-500 text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}

        <button
          type="button"
          onClick={startUpload}
          disabled={uploading || !selectedTeamId || teams.length === 0}
          className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium py-2.5 text-sm"
        >
          <Plus className="h-4 w-4" />
          Start Upload
        </button>
      </CardContent>
    </Card>
  );
}

function BulkUploadRulesCard() {
  const rules = [
    {
      icon: Users,
      title: 'Team Assignment',
      body: 'The team you select is assigned to every part in the uploaded sheet.',
    },
    {
      icon: Filter,
      title: 'Catalog Filtering',
      body: 'Uploaded parts can be filtered by team in the Catalog for focused review.',
    },
    {
      icon: Shield,
      title: 'Policy Editing',
      body: 'Bulk policy changes respect the active team filter for accuracy and consistency.',
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Bulk Upload Rules</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {rules.map((rule) => (
          <div key={rule.title} className="flex gap-3">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <rule.icon className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{rule.title}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{rule.body}</p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
