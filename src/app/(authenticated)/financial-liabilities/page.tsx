import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { LiabilitiesPageClient } from "@/components/financial-liabilities/liabilities-page-client"

export const metadata = {
  title: "Pasivos Financieros",
  description: "Gestión de créditos, TDCs, préstamos e intereses",
}

export default async function FinancialLiabilitiesPage() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <LiabilitiesPageClient />
}
