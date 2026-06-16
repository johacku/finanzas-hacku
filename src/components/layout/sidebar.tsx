'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ArrowDownCircle,
  ArrowUpCircle,
  CalendarRange,
  Users,
  TrendingUp,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Settings,
  Briefcase,
  CreditCard,
  Receipt,
  Landmark,
  BarChart3,
  Activity,
} from 'lucide-react'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const navItems = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { href: '/alegra-invoices', icon: Receipt, label: 'Solicitud de Factura' },
  { href: '/income-invoices', icon: ArrowDownCircle, label: 'Facturas Ingreso' },
  { href: '/mrr', icon: BarChart3, label: 'MRR / ARR' },
  { href: '/analytics', icon: Activity, label: 'Analytics' },
  { href: '/expense-invoices', icon: ArrowUpCircle, label: 'Facturas Gasto' },
  { href: '/weekly-cashflow', icon: CalendarRange, label: 'Flujo Semanal' },
  { href: '/customers', icon: Users, label: 'Clientes' },
  { href: '/proveedores', icon: Briefcase, label: 'Proveedores' },
  { href: '/financial-liabilities', icon: CreditCard, label: 'Pasivos Financieros' },
  { href: '/saldos-bancarios', icon: Landmark, label: 'Saldos Bancarios' },
  { href: '/trm-rates', icon: TrendingUp, label: 'TRM / Tasas' },
  { href: '/settings/master-lists', icon: Settings, label: 'Configuración' },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          'flex flex-col bg-slate-900 text-white transition-all duration-300',
          collapsed ? 'w-16' : 'w-64'
        )}
      >
        {/* Logo */}
        <div
          className={cn(
            'flex items-center h-16 border-b border-slate-700 px-4',
            collapsed ? 'justify-center' : 'justify-between'
          )}
        >
          {!collapsed && (
            <span className="text-xl font-bold tracking-tight">hackÜ</span>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-white hover:bg-slate-700 h-8 w-8"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 space-y-1 px-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-slate-700 text-white'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-white',
                      collapsed && 'justify-center px-2'
                    )}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    <p>{item.label}</p>
                  </TooltipContent>
                )}
              </Tooltip>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-2 border-t border-slate-700">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogout}
                className={cn(
                  'flex items-center gap-3 w-full rounded-lg px-3 py-2 text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors',
                  collapsed && 'justify-center px-2'
                )}
              >
                <LogOut className="h-5 w-5 shrink-0" />
                {!collapsed && <span>Cerrar Sesión</span>}
              </button>
            </TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                <p>Cerrar Sesión</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>
      </aside>
    </TooltipProvider>
  )
}
