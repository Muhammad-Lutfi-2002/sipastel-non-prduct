export interface CategoryNav {
  id: string;
  name: string;
  tagline: string;
  /** Which BrandPlaceholder gradient to show until real category photography is added. */
  variant: 'sage' | 'clay' | 'ink' | 'accent';
  filterKey: 'KAOS' | 'JERSEY' | 'CUSTOM' | 'BEST SELLER';
  aspectRatio?: string;
}

export const categoriesData: CategoryNav[] = [
  {
    id: 'cat-kaos',
    name: 'KAOS',
    tagline: 'Heavyweight cotton & daily essentials',
    variant: 'sage',
    filterKey: 'KAOS',
  },
  {
    id: 'cat-jersey',
    name: 'JERSEY',
    tagline: 'Technical fabric with retro silhouettes',
    variant: 'clay',
    filterKey: 'JERSEY',
  },
  {
    id: 'cat-custom',
    name: 'CUSTOM',
    tagline: 'Batch orders, embroidery & full sublimation',
    variant: 'accent',
    filterKey: 'CUSTOM',
  },
  {
    id: 'cat-bestseller',
    name: 'BEST SELLER',
    tagline: 'Most loved cuts and signature colorways',
    variant: 'ink',
    filterKey: 'BEST SELLER',
  },
];
