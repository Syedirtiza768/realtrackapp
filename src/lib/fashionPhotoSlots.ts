/**
 * Fashion photo slots. The slot order is the eBay picture order (front is primary).
 * Roles persist on the draft as `verticalAttributes._photoRoles`, one `role:url` entry per
 * image, so other screens that reorder `imageUrls` cannot mislabel photos.
 * Mirrors PHOTO_ROLE_ORDER in backend/src/verticals/fashion-intake.service.ts.
 */
export type FashionPhotoRole = 'front' | 'back' | 'tag' | 'additional' | 'sizeChart';

export type FashionPhotoSlots = Record<FashionPhotoRole, string[]>;

export const FASHION_PHOTO_SLOTS: Array<{
  role: FashionPhotoRole;
  label: string;
  hint: string;
  min: number;
  max: number;
  camera: boolean;
}> = [
  { role: 'front', label: 'Front', hint: 'Whole item laid flat. This is the main listing photo.', min: 1, max: 1, camera: true },
  { role: 'back', label: 'Back', hint: 'Whole item from the back.', min: 1, max: 1, camera: true },
  { role: 'tag', label: 'Tag & labels', hint: 'Brand, size and care labels. At least one.', min: 1, max: 2, camera: true },
  { role: 'additional', label: 'Additional', hint: 'Details, defects and ruler shots.', min: 0, max: 13, camera: true },
  { role: 'sizeChart', label: 'Size chart', hint: 'Created from the measurement chart, or uploaded.', min: 0, max: 1, camera: false },
];

export const emptyFashionPhotoSlots = (): FashionPhotoSlots => ({ front: [], back: [], tag: [], additional: [], sizeChart: [] });

const isRole = (value: string): value is FashionPhotoRole => FASHION_PHOTO_SLOTS.some((slot) => slot.role === value);

/** `role:url` entries → url→role map. Entries without a known role are ignored. */
export function fashionPhotoRoleMap(roles: unknown): Map<string, FashionPhotoRole> {
  const map = new Map<string, FashionPhotoRole>();
  if (!Array.isArray(roles)) return map;
  for (const entry of roles) {
    if (typeof entry !== 'string') continue;
    const split = entry.indexOf(':');
    const role = entry.slice(0, split);
    if (split > 0 && isRole(role)) map.set(entry.slice(split + 1), role);
  }
  return map;
}

export function fashionSlotsFromImages(images: string[], roles: unknown): FashionPhotoSlots {
  const slots = emptyFashionPhotoSlots();
  const known = fashionPhotoRoleMap(roles);
  images.forEach((url, index) => {
    let role: FashionPhotoRole = known.get(url) ?? (index === 0 && !known.size ? 'front' : 'additional');
    const limit = FASHION_PHOTO_SLOTS.find((slot) => slot.role === role)!.max;
    if (slots[role].length >= limit) role = 'additional';
    slots[role].push(url);
  });
  return slots;
}

export function fashionImagesFromSlots(slots: FashionPhotoSlots): { images: string[]; roles: string[] } {
  const images: string[] = [];
  const roles: string[] = [];
  for (const slot of FASHION_PHOTO_SLOTS) {
    for (const url of slots[slot.role]) {
      images.push(url);
      roles.push(`${slot.role}:${url}`);
    }
  }
  return { images, roles };
}

export function missingFashionPhotoSlots(slots: FashionPhotoSlots): string[] {
  return FASHION_PHOTO_SLOTS.filter((slot) => slots[slot.role].length < slot.min).map((slot) => slot.label);
}

export function countFashionPhotos(slots: FashionPhotoSlots) {
  return FASHION_PHOTO_SLOTS.reduce((total, slot) => total + slots[slot.role].length, 0);
}
