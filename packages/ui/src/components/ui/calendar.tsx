'use client';

import * as React from 'react';
import { DayPicker, type DropdownProps } from 'react-day-picker';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';

import { cn } from '@repo/ui/lib/utils';
import { buttonVariants } from '@repo/ui/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';

/**
 * Month/year caption dropdown, rendered with the shadcn `Select` (Base UI)
 * instead of react-day-picker's native `<select>` so it matches the rest of the
 * design system and themes correctly. react-day-picker drives it through a
 * native-select `onChange`, so we synthesise the minimal event shape it reads.
 */
function CalendarDropdown({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
}: DropdownProps) {
  const selected = options?.find((o) => String(o.value) === String(value));
  const handleValueChange = (next: string | null) => {
    onChange?.({
      target: { value: next ?? '' },
    } as React.ChangeEvent<HTMLSelectElement>);
  };
  return (
    <Select
      value={value != null ? String(value) : undefined}
      onValueChange={handleValueChange}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-7 w-fit gap-1 rounded-md px-2 py-0 text-sm font-medium [&_svg]:size-3.5"
      >
        <SelectValue>{selected?.label}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {options?.map((o) => (
          <SelectItem
            key={o.value}
            value={String(o.value)}
            disabled={o.disabled}
          >
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/**
 * Calendar styled with the design tokens, built on react-day-picker v9. The
 * full `classNames` map means we don't ship react-day-picker's stylesheet.
 */
function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-3', className)}
      classNames={{
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex w-full flex-col gap-4',
        month_caption: 'relative z-0 flex h-8 items-center justify-center',
        caption_label: 'text-sm font-medium',
        dropdowns: 'flex items-center gap-1.5 text-sm font-medium',
        // `pointer-events-none` on the container lets clicks pass through the
        // transparent middle of the nav (which overlays the caption) to the
        // month/year dropdowns beneath it; the buttons re-enable pointer events
        // for themselves. Without this the dropdowns can't be opened.
        nav: 'pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between',
        button_previous: cn(
          buttonVariants({ variant: 'outline', size: 'icon' }),
          'pointer-events-auto size-7 bg-transparent p-0 opacity-70 hover:opacity-100',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline', size: 'icon' }),
          'pointer-events-auto size-7 bg-transparent p-0 opacity-70 hover:opacity-100',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex',
        weekday:
          'w-8 rounded-md text-[0.8rem] font-normal text-muted-foreground',
        week: 'mt-2 flex w-full',
        day: 'relative size-8 p-0 text-center text-sm focus-within:relative focus-within:z-20',
        day_button: cn(
          buttonVariants({ variant: 'ghost' }),
          'size-8 rounded-md p-0 font-normal aria-selected:opacity-100',
        ),
        range_start: 'rounded-l-md',
        range_end: 'rounded-r-md',
        selected:
          '[&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground',
        today: '[&>button]:bg-accent [&>button]:text-accent-foreground',
        outside: 'text-muted-foreground opacity-50',
        disabled: 'text-muted-foreground opacity-50',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Dropdown: CalendarDropdown,
        // The prev/next nav buttons only ever render left/right chevrons; the
        // caption month/year selects supply their own carets (CalendarDropdown).
        Chevron: ({ orientation, className: chevronClassName }) =>
          orientation === 'left' ? (
            <ChevronLeftIcon className={cn('size-4', chevronClassName)} />
          ) : (
            <ChevronRightIcon className={cn('size-4', chevronClassName)} />
          ),
      }}
      {...props}
    />
  );
}

export { Calendar };
