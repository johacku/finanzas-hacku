'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import {
  getWeekStart,
  getPreviousWeek,
  getNextWeek,
  formatWeekLabel,
  formatDateForDB,
} from '@/lib/date'

interface WeekSelectorProps {
  currentWeekStart: Date
  onChange: (weekStart: Date) => void
}

export function WeekSelector({ currentWeekStart, onChange }: WeekSelectorProps) {
  const isCurrentWeek =
    formatDateForDB(currentWeekStart) === formatDateForDB(getWeekStart())

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(getPreviousWeek(currentWeekStart))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="flex items-center gap-2 min-w-60 justify-center">
        <CalendarDays className="h-4 w-4 text-slate-400" />
        <span className="text-sm font-medium text-slate-700">
          {formatWeekLabel(currentWeekStart)}
        </span>
        {isCurrentWeek && (
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
            Esta semana
          </span>
        )}
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(getNextWeek(currentWeekStart))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
      {!isCurrentWeek && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(getWeekStart())}
          className="text-xs"
        >
          Hoy
        </Button>
      )}
    </div>
  )
}
