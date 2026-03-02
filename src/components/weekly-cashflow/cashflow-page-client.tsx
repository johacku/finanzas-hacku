// @ts-nocheck
'use client'

import { useState } from 'react'
import { WeekSelector } from './week-selector'
import { CashflowWeekCard } from './cashflow-week-card'
import { PageHeader } from '@/components/shared/page-header'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SOCIEDADES, type Sociedad } from '@/lib/constants'
import { getWeekStart, formatDateForDB } from '@/lib/date'
import type { Database } from '@/types/database.types'

type WeeklyCashflowEntry = Database['public']['Tables']['weekly_cashflow_entries']['Row']

interface CashflowPageClientProps {
  initialData: WeeklyCashflowEntry[]
}

export function CashflowPageClient({ initialData }: CashflowPageClientProps) {
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getWeekStart())
  const [filterSociedad, setFilterSociedad] = useState<string>('all')

  const weekStr = formatDateForDB(currentWeekStart)

  const sociedades: Sociedad[] =
    filterSociedad === 'all'
      ? SOCIEDADES
      : SOCIEDADES.filter((s) => s === filterSociedad)

  function getEntryForSociedad(soc: Sociedad) {
    return initialData.find(
      (e) => e.sociedad === soc && e.week_start_date === weekStr
    ) ?? null
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Flujo de Caja Semanal"
        description="Vista semanal por sociedad — Proyectado vs Real"
      />

      <div className="flex items-center justify-between flex-wrap gap-3">
        <WeekSelector
          currentWeekStart={currentWeekStart}
          onChange={setCurrentWeekStart}
        />
        <Select value={filterSociedad} onValueChange={setFilterSociedad}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Sociedad" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las sociedades</SelectItem>
            {SOCIEDADES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {sociedades.map((soc) => (
          <CashflowWeekCard
            key={soc}
            sociedad={soc}
            weekStartDate={weekStr}
            entry={getEntryForSociedad(soc)}
          />
        ))}
      </div>
    </div>
  )
}
