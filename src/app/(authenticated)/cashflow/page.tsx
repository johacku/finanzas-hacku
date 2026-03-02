import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { WeeklyCashflowView } from "@/components/weekly-cashflow/weekly-cashflow-view"

export const metadata = {
  title: "Flujo de Caja Semanal",
  description: "Análisis de flujo de caja semanal con auto-cálculos",
}

export default async function CashflowPage() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <WeeklyCashflowView />
}
