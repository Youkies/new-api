import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Copy, Plus, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Main } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { getMyInviteCodes, generateInviteCode } from './api'
import type { InviteCode } from './api'

const STATUS_PENDING = 0
const STATUS_USED = 1
// const STATUS_EXPIRED = 2

function formatDate(unix: number) {
  return new Date(unix * 1000).toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CodeStatusBadge({ code }: { code: InviteCode }) {
  const { t } = useTranslation()
  const now = Date.now() / 1000
  if (code.status === STATUS_USED) {
    return (
      <Badge variant='secondary' className='gap-1'>
        <CheckCircle2 className='h-3 w-3' />
        {t('Used')}
      </Badge>
    )
  }
  if (code.status !== STATUS_PENDING || now > code.expired_at) {
    return (
      <Badge variant='outline' className='gap-1 text-muted-foreground'>
        <XCircle className='h-3 w-3' />
        {t('Expired')}
      </Badge>
    )
  }
  return (
    <Badge variant='default' className='gap-1'>
      <Clock className='h-3 w-3' />
      {t('Active')}
    </Badge>
  )
}

function isActive(code: InviteCode) {
  return code.status === STATUS_PENDING && Date.now() / 1000 <= code.expired_at
}

export function InvitePage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['invite-codes'],
    queryFn: getMyInviteCodes,
  })

  const { mutate: generate, isPending: isGenerating } = useMutation({
    mutationFn: generateInviteCode,
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t('Invite code generated'))
        queryClient.invalidateQueries({ queryKey: ['invite-codes'] })
      }
    },
    onError: () => {
      // Errors handled by global interceptor
    },
  })

  const canGenerate =
    data?.has_top_up &&
    (data?.today_used ?? 0) < (data?.today_max ?? 2) &&
    (data?.active_count ?? 0) < (data?.active_max ?? 2)

  function handleCopy(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(code)
      toast.success(t('Copied to clipboard'))
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <Main>
      <div className='mx-auto max-w-2xl space-y-6 p-4'>
        <div>
          <h1 className='text-2xl font-bold'>{t('Invite codes')}</h1>
          <p className='text-muted-foreground mt-1 text-sm'>
            {t('Share invite codes with friends to grant them registration access.')}
          </p>
        </div>

        {/* Status card */}
        <Card>
          <CardHeader className='pb-3'>
            <CardTitle className='text-base'>{t('Today\'s quota')}</CardTitle>
            {!data?.has_top_up && (
              <CardDescription className='text-amber-600 dark:text-amber-400'>
                {t('Top up your account to unlock invite code generation.')}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className='space-y-4'>
            <div className='flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>{t('Generated today')}</span>
              <span className='font-medium'>
                {data?.today_used ?? 0} / {data?.today_max ?? 2}
              </span>
            </div>
            <div className='flex items-center justify-between text-sm'>
              <span className='text-muted-foreground'>{t('Active codes')}</span>
              <span className='font-medium'>
                {data?.active_count ?? 0} / {data?.active_max ?? 2}
              </span>
            </div>
            <Button
              onClick={() => generate()}
              disabled={!canGenerate || isGenerating || isLoading}
              className='w-full gap-2'
            >
              <Plus className='h-4 w-4' />
              {t('Generate invite code')}
            </Button>
          </CardContent>
        </Card>

        {/* Code list */}
        {data?.data && data.data.length > 0 && (
          <Card>
            <CardHeader className='pb-3'>
              <CardTitle className='text-base'>{t('Your invite codes')}</CardTitle>
            </CardHeader>
            <CardContent className='space-y-3'>
              {data.data.map((code) => (
                <div
                  key={code.id}
                  className='flex items-center justify-between rounded-lg border px-4 py-3'
                >
                  <div className='space-y-0.5'>
                    <div className='flex items-center gap-2'>
                      <span className='font-mono text-base font-semibold tracking-widest'>
                        {code.code}
                      </span>
                      <CodeStatusBadge code={code} />
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      {isActive(code)
                        ? t('Expires {{date}}', { date: formatDate(code.expired_at) })
                        : t('Created {{date}}', { date: formatDate(code.created_at) })}
                    </p>
                  </div>
                  {isActive(code) && (
                    <Button
                      variant='ghost'
                      size='icon'
                      onClick={() => handleCopy(code.code)}
                      className='shrink-0'
                    >
                      <Copy
                        className={`h-4 w-4 ${copied === code.code ? 'text-green-500' : ''}`}
                      />
                    </Button>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {!isLoading && (!data?.data || data.data.length === 0) && (
          <p className='text-muted-foreground text-center text-sm py-8'>
            {t('No invite codes yet.')}
          </p>
        )}
      </div>
    </Main>
  )
}
