import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { MasterListsPageClient } from "@/components/settings/master-lists-page-client"

export const metadata = {
  title: "Listas Maestras",
  description: "Gestiona planes, aliados, vendedores, tipos de pago y conceptos",
}

export default async function MasterListsPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <MasterListsPageClient />
}
