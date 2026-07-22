// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown, Search } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

interface ItemOption {
  id: string
  name: string
  moneda?: string
  precio_default?: number
  commission_ranges?: any[]
}

interface Props {
  items: ItemOption[]
  value: string
  onSelect: (itemId: string) => void
  placeholder?: string
  loading?: boolean
}

export function ItemSearchSelect({ items, value, onSelect, placeholder = 'Seleccionar item...', loading = false }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selectedItem = items.find(i => String(i.id) === value)

  const filtered = search.length > 0
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()))
    : items

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between h-9 text-sm font-normal"
        >
          <span className="truncate">
            {selectedItem ? (
              <>
                {selectedItem.name}
                {selectedItem.moneda && selectedItem.moneda !== 'COP' ? ` (${selectedItem.moneda})` : ''}
              </>
            ) : (
              <span className="text-muted-foreground">{loading ? 'Cargando items...' : placeholder}</span>
            )}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 z-[9999]" align="start" side="bottom" sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}>
        <div className="flex items-center border-b px-3">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <input
            className="flex h-10 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Buscar item..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto overscroll-contain p-1">
          {filtered.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">No se encontraron items.</p>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              type="button"
              className={cn(
                'relative flex w-full cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground',
                value === String(item.id) && 'bg-accent'
              )}
              onClick={() => {
                onSelect(String(item.id))
                setOpen(false)
                setSearch('')
              }}
            >
              <Check className={cn('mr-2 h-4 w-4', value === String(item.id) ? 'opacity-100' : 'opacity-0')} />
              <span className="truncate">
                {item.name}
                {item.moneda && item.moneda !== 'COP' ? ` (${item.moneda})` : ''}
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
