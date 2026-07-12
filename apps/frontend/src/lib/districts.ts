import type { ComboboxOption } from '@repo/ui';

/**
 * The 25 administrative districts of Sri Lanka, alphabetically ordered. Used to
 * populate the searchable district selectors across job/trade filters and
 * profile forms so the value is always a recognised district.
 */
export const SRI_LANKA_DISTRICTS = [
  'Ampara',
  'Anuradhapura',
  'Badulla',
  'Batticaloa',
  'Colombo',
  'Galle',
  'Gampaha',
  'Hambantota',
  'Jaffna',
  'Kalutara',
  'Kandy',
  'Kegalle',
  'Kilinochchi',
  'Kurunegala',
  'Mannar',
  'Matale',
  'Matara',
  'Monaragala',
  'Mullaitivu',
  'Nuwara Eliya',
  'Polonnaruwa',
  'Puttalam',
  'Ratnapura',
  'Trincomalee',
  'Vavuniya',
] as const;

export const DISTRICT_OPTIONS: ComboboxOption[] = SRI_LANKA_DISTRICTS.map(
  (d) => ({ value: d, label: d }),
);
