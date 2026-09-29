import { closestCenter, DndContext, KeyboardSensor, PointerSensor, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, ArrowRight, GripVertical, ImageOff, Star, Trash2 } from 'lucide-react';
import OptimizedImage from '../../ui/OptimizedImage';

type Props = {
  images: string[];
  editable?: boolean;
  onChange?: (images: string[]) => void;
  onZoom?: (url: string) => void;
};

type SortableImageProps = {
  id: string;
  url: string;
  index: number;
  total: number;
  editable: boolean;
  onRemove?: () => void;
  onZoom?: () => void;
  onMoveLeft?: () => void;
  onMoveRight?: () => void;
};

function SortableImage({
  id,
  url,
  index,
  total,
  editable,
  onRemove,
  onZoom,
  onMoveLeft,
  onMoveRight,
}: SortableImageProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, disabled: !editable });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        'group relative h-28 w-28 overflow-hidden rounded-lg border bg-slate-100 dark:bg-slate-800 ' +
        (isDragging
          ? 'z-10 border-blue-500 shadow-lg'
          : 'border-slate-200 dark:border-slate-700')
      }
    >
      <button
        type="button"
        onClick={onZoom}
        className="block h-full w-full"
        aria-label={'Zoom image ' + (index + 1)}
      >
        <OptimizedImage
          src={url}
          alt={'Product image ' + (index + 1)}
          variant="small"
          className="h-full w-full object-cover"
        />
      </button>
      {index === 0 ? (
        <span className="absolute left-1 top-1 inline-flex items-center gap-0.5 rounded bg-blue-600 px-1 py-0.5 text-[9px] font-semibold text-white">
          <Star size={9} fill="currentColor" /> Primary
        </span>
      ) : null}
      {editable ? (
        <div className="absolute inset-x-1 bottom-1 flex items-center justify-between gap-1 rounded bg-white/90 p-0.5 shadow-sm dark:bg-slate-900/90">
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="touch-none cursor-grab rounded p-1 text-slate-700 hover:bg-slate-200 active:cursor-grabbing dark:text-slate-200 dark:hover:bg-slate-700"
            title="Drag to reorder"
            aria-label={'Drag image ' + (index + 1) + ' to reorder'}
          >
            <GripVertical size={13} />
          </button>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              disabled={index === 0}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onMoveLeft}
              className="rounded p-1 text-slate-700 hover:bg-slate-200 disabled:opacity-30 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Move left"
              aria-label={'Move image ' + (index + 1) + ' left'}
            >
              <ArrowLeft size={13} />
            </button>
            <button
              type="button"
              disabled={index === total - 1}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onMoveRight}
              className="rounded p-1 text-slate-700 hover:bg-slate-200 disabled:opacity-30 dark:text-slate-200 dark:hover:bg-slate-700"
              title="Move right"
              aria-label={'Move image ' + (index + 1) + ' right'}
            >
              <ArrowRight size={13} />
            </button>
            <button
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onRemove}
              className="rounded p-1 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
              title="Remove image"
              aria-label={'Remove image ' + (index + 1)}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function CatalogImageGallery({
  images,
  editable = false,
  onChange,
  onZoom,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = images.map((url, index) => String(index) + ':' + url);

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!editable || !over || active.id === over.id || !onChange) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex >= 0 && newIndex >= 0) {
      onChange(arrayMove(images, oldIndex, newIndex));
    }
  };

  if (!images.length) {
    return (
      <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-slate-300 text-xs text-slate-400 dark:border-slate-700">
        <ImageOff size={18} className="mr-2" /> No images yet
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="flex flex-wrap gap-2">
          {images.map((url, index) => (
            <SortableImage
              key={ids[index]}
              id={ids[index]}
              url={url}
              index={index}
              total={images.length}
              editable={editable}
              onMoveLeft={() =>
                index > 0 && onChange?.(arrayMove(images, index, index - 1))
              }
              onMoveRight={() =>
                index < images.length - 1 &&
                onChange?.(arrayMove(images, index, index + 1))
              }
              onRemove={() =>
                onChange?.(
                  images.filter((_, imageIndex) => imageIndex !== index),
                )
              }
              onZoom={() => onZoom?.(url)}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
