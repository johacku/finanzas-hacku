// @ts-nocheck
/* eslint-disable @typescript-eslint/no-explicit-any */
'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Plus, Trash2 } from 'lucide-react'

interface Participant {
  beneficiario_nombre: string
  rol: string
  porcentaje: number
}

interface Props {
  vendedores: Array<{ id: string; nombre: string; rol?: string }>
  participants: Participant[]
  onChange: (participants: Participant[]) => void
}

export function CommissionParticipantsEditor({ vendedores, participants, onChange }: Props) {
  const addParticipant = () => {
    onChange([...participants, { beneficiario_nombre: '', rol: 'closer', porcentaje: 5 }])
  }

  const removeParticipant = (index: number) => {
    onChange(participants.filter((_, i) => i !== index))
  }

  const updateParticipant = (index: number, field: string, value: any) => {
    const updated = [...participants]
    updated[index] = { ...updated[index], [field]: value }
    onChange(updated)
  }

  const totalPorcentaje = participants.reduce((sum, p) => sum + (p.porcentaje || 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium">Comisiones por KAM/Aliado</label>
        <Button type="button" variant="outline" size="sm" onClick={addParticipant}>
          <Plus className="h-3 w-3 mr-1" /> Agregar
        </Button>
      </div>

      {participants.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">Sin comisiones asignadas. Haz clic en Agregar.</p>
      )}

      {participants.map((p, i) => (
        <div key={i} className="grid grid-cols-12 gap-2 items-center">
          <div className="col-span-5">
            <Select value={p.beneficiario_nombre} onValueChange={(v) => updateParticipant(i, 'beneficiario_nombre', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {vendedores.map((v) => (
                  <SelectItem key={v.id || v.nombre} value={v.nombre}>
                    {v.nombre} {v.rol ? `(${v.rol})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-3">
            <Select value={p.rol} onValueChange={(v) => updateParticipant(i, 'rol', v)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="closer">Closer</SelectItem>
                <SelectItem value="support">Support</SelectItem>
                <SelectItem value="aliado">Aliado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-3">
            <div className="flex items-center gap-1">
              <Input
                type="number"
                min="0"
                max="100"
                step="0.5"
                value={p.porcentaje}
                onChange={(e) => updateParticipant(i, 'porcentaje', parseFloat(e.target.value) || 0)}
                className="h-8 text-xs text-right"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="col-span-1">
            <Button type="button" variant="ghost" size="sm" className="h-8 w-8 text-red-500" onClick={() => removeParticipant(i)}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
      ))}

      {participants.length > 0 && (
        <div className="flex justify-between items-center pt-2 border-t text-xs">
          <span className="text-muted-foreground">Total comision</span>
          <span className={`font-bold ${totalPorcentaje > 100 ? 'text-red-600' : 'text-slate-700'}`}>
            {totalPorcentaje}%
            {totalPorcentaje > 100 && ' ⚠️'}
          </span>
        </div>
      )}
    </div>
  )
}
