import { useCallback, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  ArrowLeft,
  PackagePlus,
  Image,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import {
  useAddIntakePart,
  useNextSingleListingSku,
  useSingleListingBrands,
} from '../../lib/pipelineApi';
import ImageUploadZone from './ImageUploadZone';
import type { UploadedImage } from '../../lib/storageApi';

const MIN_PHOTOS = 2;

export default function SingleListingPipeline() {
  const navigate = useNavigate();
  const addPartMutation = useAddIntakePart();
  const { data: skuData, isLoading: skuLoading, error: skuError, refetch: refetchSku } =
    useNextSingleListingSku();
  const { data: brandsData } = useSingleListingBrands();

  const [partNumber, setPartNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const sku = skuData?.sku ?? '';

  const resetForm = useCallback(async () => {
    setPartNumber('');
    setBrand('');
    setUploadedImages([]);
    setError(null);
    await refetchSku();
  }, [refetchSku]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSuccessMessage(null);

      const oem = partNumber.trim();
      const make = brand.trim();
      if (!oem) {
        setError('OEM / Part Number is required');
        return;
      }
      if (!make) {
        setError('Brand is required');
        return;
      }
      if (!sku) {
        setError('SKU is still loading — please wait and try again');
        return;
      }

      const imageUrls = uploadedImages.map((img) => img.cdnUrl).filter(Boolean);
      if (imageUrls.length < MIN_PHOTOS) {
        setError(`Upload at least ${MIN_PHOTOS} photos (label close-up + overall part shot)`);
        return;
      }

      try {
        const result = await addPartMutation.mutateAsync({
          sku,
          partNumber: oem,
          brand: make,
          imageUrls,
          uploadedAssetIds: uploadedImages.map((img) => img.assetId),
        });

        setSuccessMessage(
          `Part saved to inventory as ${result.listing.customLabelSku ?? sku}. Add another part below.`,
        );
        await resetForm();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add part');
      }
    },
    [partNumber, brand, sku, uploadedImages, addPartMutation, resetForm],
  );

  const inputClassName =
    'w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-1 focus:ring-blue-500 focus:outline-none text-sm';

  return (
    <div className="flex flex-col gap-4 sm:gap-6 pb-8">
      <div className="min-w-0 flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:text-slate-200 transition-colors shrink-0"
        >
          <ArrowLeft size={16} />
        </button>
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-3">
            <PackagePlus className="h-7 w-7 text-blue-400" />
            Add Part
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Enter OEM number, brand, and photos — parts go to Inventory for enrichment
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-400" />
              Warehouse Intake
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                SKU
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={skuLoading ? 'Generating…' : sku}
                  readOnly
                  className={`${inputClassName} bg-slate-50 dark:bg-slate-900/60 font-mono cursor-not-allowed`}
                />
                {skuLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-slate-400" />
                )}
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Auto-generated label SKU (BLA prefix)
              </p>
              {skuError && (
                <p className="text-[11px] text-red-400 mt-1">
                  Could not generate SKU — refresh the page
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Brand / Make <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                list="add-part-brand-options"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="Select or type a brand"
                className={inputClassName}
                required
              />
              <datalist id="add-part-brand-options">
                {(brandsData?.brands ?? []).map((b) => (
                  <option key={b} value={b} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                OEM / Part Number <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
                placeholder="e.g. 27060-0V210, A12345678"
                className={inputClassName}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                <span className="flex items-center gap-1.5">
                  <Image className="h-4 w-4" />
                  Photos <span className="text-red-400">*</span>
                  <span className="text-xs font-normal text-slate-500">
                    (min {MIN_PHOTOS}: label + overall)
                  </span>
                </span>
              </label>
              <ImageUploadZone onImagesChange={setUploadedImages} maxImages={12} />
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-2">
                {uploadedImages.length} of {MIN_PHOTOS} required photos uploaded
              </p>
            </div>

            {successMessage && (
              <div className="flex items-center gap-2 text-emerald-300 text-sm bg-emerald-900/20 border border-emerald-500/30 rounded-lg p-3">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                {successMessage}
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={addPartMutation.isPending || skuLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm disabled:opacity-50 transition-colors"
            >
              {addPartMutation.isPending ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <PackagePlus size={16} />
                  Add to Inventory
                </>
              )}
            </button>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
