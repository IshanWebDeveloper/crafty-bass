'use client';

import * as React from 'react';
import { Combobox as ComboboxPrimitive } from '@base-ui/react/combobox';
import { CheckIcon, ChevronsUpDownIcon } from 'lucide-react';

import { cn } from '@repo/ui/lib/utils';

export type ComboboxOption = { value: string; label: string };

/**
 * shadcn-style searchable select built on Base UI's Combobox. Pass `items`
 * (`{ value, label }` objects, plus any extra fields you want in `renderItem`),
 * a controlled `value` (the option's `value`, or `null`), and `onValueChange`.
 * Filtering on the typed query is handled by Base UI against each option label.
 *
 * For custom rows (e.g. an icon beside the label) pass `renderItem`; the input
 * still shows the selected option's `label` automatically.
 */
function Combobox<T extends ComboboxOption>({
  items,
  value,
  onValueChange,
  placeholder,
  emptyText = 'No results found.',
  renderItem,
  id,
  className,
  contentClassName,
  disabled,
  'aria-label': ariaLabel,
}: {
  items: readonly T[];
  value: string | null | undefined;
  onValueChange: (value: string | null) => void;
  placeholder?: string;
  emptyText?: string;
  renderItem?: (item: T) => React.ReactNode;
  id?: string;
  className?: string;
  contentClassName?: string;
  disabled?: boolean;
  'aria-label'?: string;
}) {
  const selected = React.useMemo(
    () => items.find((item) => item.value === value) ?? null,
    [items, value],
  );

  return (
    <ComboboxPrimitive.Root
      items={items as T[]}
      value={selected}
      onValueChange={(item) => onValueChange(item ? item.value : null)}
      disabled={disabled}
    >
      <div className="relative">
        <ComboboxPrimitive.Input
          id={id}
          placeholder={placeholder}
          aria-label={ariaLabel}
          data-slot="combobox-input"
          className={cn(
            'h-9 w-full min-w-0 rounded-lg border border-input bg-transparent py-1 pr-9 pl-2.5 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30',
            className,
          )}
        />
        <ComboboxPrimitive.Icon
          data-slot="combobox-icon"
          className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground"
        >
          <ChevronsUpDownIcon className="size-4 opacity-60" />
        </ComboboxPrimitive.Icon>
      </div>

      <ComboboxPrimitive.Portal>
        <ComboboxPrimitive.Positioner
          className="isolate z-50 outline-none"
          align="start"
          sideOffset={4}
        >
          <ComboboxPrimitive.Popup
            data-slot="combobox-content"
            className={cn(
              'z-50 max-h-(--available-height) w-(--anchor-width) min-w-(--anchor-width) origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95',
              contentClassName,
            )}
          >
            <ComboboxPrimitive.Empty className="px-2 py-4 text-center text-sm text-muted-foreground">
              {emptyText}
            </ComboboxPrimitive.Empty>
            <ComboboxPrimitive.List>
              {(item: T) => (
                <ComboboxPrimitive.Item
                  key={item.value}
                  value={item}
                  data-slot="combobox-item"
                  className={cn(
                    'relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pr-8 pl-2 text-sm outline-hidden select-none',
                    'data-highlighted:bg-accent data-highlighted:text-accent-foreground',
                    'data-disabled:pointer-events-none data-disabled:opacity-50',
                  )}
                >
                  {renderItem ? renderItem(item) : item.label}
                  <span className="pointer-events-none absolute right-2 flex items-center justify-center">
                    <ComboboxPrimitive.ItemIndicator>
                      <CheckIcon className="size-4" />
                    </ComboboxPrimitive.ItemIndicator>
                  </span>
                </ComboboxPrimitive.Item>
              )}
            </ComboboxPrimitive.List>
          </ComboboxPrimitive.Popup>
        </ComboboxPrimitive.Positioner>
      </ComboboxPrimitive.Portal>
    </ComboboxPrimitive.Root>
  );
}

export { Combobox };
