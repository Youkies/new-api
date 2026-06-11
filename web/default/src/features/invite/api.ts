import { api } from '@/lib/api'

export interface InviteCode {
  id: number
  code: string
  owner_id: number
  used_by_id: number
  status: number // 0=pending, 1=used, 2=expired
  created_at: number
  expired_at: number
}

export interface InviteListResponse {
  success: boolean
  data: InviteCode[]
  has_top_up: boolean
  today_used: number
  today_max: number
  active_count: number
  active_max: number
}

export async function getMyInviteCodes(): Promise<InviteListResponse> {
  const res = await api.get('/api/user/invite')
  return res.data
}

export async function generateInviteCode(): Promise<{
  success: boolean
  data?: InviteCode
  message?: string
}> {
  const res = await api.post('/api/user/invite')
  return res.data
}
