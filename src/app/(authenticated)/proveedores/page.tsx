import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProveedoresPageClient } from "@/components/proveedores/proveedores-page-client"

export const metadata = {
  title: "Proveedores",
  description: "Gestión de proveedores y proveedores de servicios",
}

export default async function ProveedoresPage() {
  const supabase = await createClient()

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  return <ProveedoresPageClient />
}
