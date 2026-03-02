"use client"

import { useEffect, useState } from "react"
import {
  getPlanes,
  getAliados,
  getVendedores,
  getTiposPago,
  getConceptosGasto,
} from "@/actions/master-lists.actions"

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface MasterLists {
  planes: any[]
  aliados: any[]
  vendedores: any[]
  tiposPago: any[]
  conceptosGasto: any[]
}
/* eslint-enable @typescript-eslint/no-explicit-any */

interface MasterListLoaderProps {
  children: (lists: MasterLists & { loading: boolean }) => React.ReactNode
}

export function MasterListLoader({ children }: MasterListLoaderProps) {
  const [lists, setLists] = useState<MasterLists>({
    planes: [],
    aliados: [],
    vendedores: [],
    tiposPago: [],
    conceptosGasto: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadLists = async () => {
      try {
        const [planesData, aliadosData, vendedoresData, tiposPagoData, conceptosData] =
          await Promise.all([
            getPlanes(),
            getAliados(),
            getVendedores(),
            getTiposPago(),
            getConceptosGasto(),
          ])

        setLists({
          planes: planesData || [],
          aliados: aliadosData || [],
          vendedores: vendedoresData || [],
          tiposPago: tiposPagoData || [],
          conceptosGasto: conceptosData || [],
        })
      } catch (error) {
        console.error("Failed to load master lists:", error)
      } finally {
        setLoading(false)
      }
    }

    loadLists()
  }, [])

  return <>{children({ ...lists, loading })}</>
}
