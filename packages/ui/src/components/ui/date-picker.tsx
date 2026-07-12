'use client';

import * as React from 'react';
import { format } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

import { cn } from '@repo/ui/lib/utils';
import { buttonVariants } from '@repo/ui/components/ui/button';
import { Calendar } from '@repo/ui/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/ui/popover';

export type DatePickerProps = {
  /** Currently selected date (controlled). */
  value?: Date;
  onChange?: (date: Date | undefined) => void;
  placeholder?: string;
  /** Disables the whole control (the trigger button). */
  disabled?: boolean;
  /**
   * Restricts which dates can be picked - forwarded to react-day-picker's
   * `disabled` matcher (e.g. `{ before: new Date() }` for future-only).
   */
  disabledDates?: React.ComponentProps<typeof Calendar>['disabled'];
  /** date-fns format string for the trigger label. Defaults to e.g. "June 26th, 2026". */
  dateFormat?: string;
  /**
   * Calendar caption style - forwarded to react-day-picker. Use `'dropdown'`
   * (with `startMonth`/`endMonth`) for far-back dates like a date of birth so
   * users can jump years instead of paging month by month.
   */
  captionLayout?: React.ComponentProps<typeof Calendar>['captionLayout'];
  /** Earliest navigable month - bounds the dropdown range when using `captionLayout`. */
  startMonth?: Date;
  /** Latest navigable month - bounds the dropdown range when using `captionLayout`. */
  endMonth?: Date;
  /** Forwarded to the trigger so a <label htmlFor> can target it. */
  id?: string;
  className?: string;
  align?: 'start' | 'center' | 'end';
};

/**
 * Single-date picker - the shadcn Base-UI composition of Popover + Calendar.
 * The trigger is styled directly with `buttonVariants` (rather than nesting a
 * <Button>) so there's only one real <button>, avoiding Base UI's
 * nested-button hydration error. Controlled: pass `value` + `onChange`.
 */
function DatePicker({
  value,
  onChange,
  placeholder = 'Pick a date',
  disabled = false,
  disabledDates,
  dateFormat = 'PPP',
  captionLayout,
  startMonth,
  endMonth,
  id,
  className,
  align = 'start',
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false);

  return (
    // The wrapper keeps the trigger out of the consumer's spacing context. When
    // the popover opens, Base UI injects focus-guard <span>s as siblings of the
    // trigger; if the trigger were a direct child of a `space-y-*` container,
    // those guards would make it stop being `:last-child` and pick up a stray
    // margin, nudging the layout down by a few pixels. Containing them here
    // keeps the control a single, fixed-height box.
    <div className="relative">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          disabled={disabled}
          data-empty={!value}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'w-full justify-start gap-2 text-left font-normal data-[empty=true]:text-muted-foreground',
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 opacity-70" />
          {value ? format(value, dateFormat) : placeholder}
        </PopoverTrigger>
        {/* initialFocus={false} stops Base UI from focusing the first calendar
          cell on open. That focus runs with preventScroll: false while the
          popup is still being positioned, which yanks the whole page to the
          top. With it off (and no Calendar autoFocus) the popup opens in place;
          keyboard users tab into the grid, and focus still returns to the
          trigger on close. */}
        <PopoverContent
          align={align}
          className="w-auto p-0"
          initialFocus={false}
        >
          <Calendar
            mode="single"
            selected={value}
            onSelect={(date) => {
              onChange?.(date);
              setOpen(false);
            }}
            disabled={disabledDates}
            captionLayout={captionLayout}
            startMonth={startMonth}
            endMonth={endMonth}
            defaultMonth={value ?? endMonth}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export { DatePicker };
