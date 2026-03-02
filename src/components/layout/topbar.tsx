import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import type { User } from '@supabase/supabase-js'

interface TopbarProps {
  user: User
}

export function Topbar({ user }: TopbarProps) {
  const initials = user.email?.slice(0, 2).toUpperCase() ?? 'HÜ'

  return (
    <header className="h-16 border-b bg-white flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-3">
        <span className="text-sm text-slate-600">{user.email}</span>
        <Avatar className="h-8 w-8">
          <AvatarFallback className="bg-slate-700 text-white text-xs">
            {initials}
          </AvatarFallback>
        </Avatar>
      </div>
    </header>
  )
}
