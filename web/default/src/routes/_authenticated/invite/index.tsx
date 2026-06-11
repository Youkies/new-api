import { createFileRoute } from '@tanstack/react-router'
import { InvitePage } from '@/features/invite'

export const Route = createFileRoute('/_authenticated/invite/')({
  component: InvitePage,
})
