'use client';

import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { DateRange } from 'react-day-picker';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

interface PresetConfig {
  label: string;
  value: string;
  days?: number;
  getRange?: () => DateRange;
}

const PRESETS: PresetConfig[] = [
  { label: 'Last 7 days', value: '7d', days: 7 },
  { label: 'Last 30 days', value: '30d', days: 30 },
  { label: 'Last 90 days', value: '90d', days: 90 },
  {
    label: 'This week',
    value: 'week',
    getRange: () => ({
      from: startOfWeek(new Date()),
      to: endOfWeek(new Date()),
    }),
  },
  {
    label: 'This month',
    value: 'month',
    getRange: () => ({
      from: startOfMonth(new Date()),
      to: endOfMonth(new Date()),
    }),
  },
];

interface DateRangePickerProps {
  className?: string;
}

export function DateRangePicker({ className }: DateRangePickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const fromParam = searchParams.get('from');
  const toParam = searchParams.get('to');

  const [date, setDate] = useState<DateRange | undefined>(() => {
    if (fromParam && toParam) {
      return {
        from: new Date(fromParam),
        to: new Date(toParam),
      };
    }
    // Default to last 30 days
    return {
      from: subDays(new Date(), 30),
      to: new Date(),
    };
  });

  const updateRange = (range: DateRange | undefined) => {
    setDate(range);
    if (range?.from && range?.to) {
      const params = new URLSearchParams(searchParams.toString());
      params.set('from', format(range.from, 'yyyy-MM-dd'));
      params.set('to', format(range.to, 'yyyy-MM-dd'));
      router.push(`${pathname}?${params.toString()}`);
    }
  };

  const applyPreset = (preset: PresetConfig) => {
    let range: DateRange;
    if (preset.days !== undefined) {
      range = {
        from: subDays(new Date(), preset.days),
        to: new Date(),
      };
    } else if (preset.getRange) {
      range = preset.getRange();
    } else {
      return;
    }
    updateRange(range);
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex gap-1">
        {PRESETS.slice(0, 3).map((preset) => (
          <Button
            key={preset.value}
            variant="outline"
            size="sm"
            onClick={() => applyPreset(preset)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn('justify-start text-left font-normal', !date && 'text-muted-foreground')}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {format(date.from, 'MMM d')} - {format(date.to, 'MMM d')}
                </>
              ) : (
                format(date.from, 'MMM d, yyyy')
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            defaultMonth={date?.from}
            selected={date}
            onSelect={updateRange}
            numberOfMonths={2}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
