export interface BotApplication {
  id: string
  owner_id: string
  name: string
  description: string
  icon_url: string | null
  created_at: string
}

export interface BotRow {
  id: string
  application_id: string
  user_id: string
  token_prefix: string | null
  token_created_at: string | null
  token_last_used_at: string | null
  created_at: string
}

export interface ServerRow {
  id: string
  name: string
  label: string
  color: string
  owner_id: string | null
  created_at: string
}

export const BOT_PERMISSIONS = ['read_messages', 'send_messages', 'manage_messages'] as const
export type BotPermission = (typeof BOT_PERMISSIONS)[number]

export const PERMISSION_LABELS: Record<BotPermission, { ru: string; en: string }> = {
  read_messages: { ru: 'Читать сообщения в канале', en: 'Read messages in the channel' },
  send_messages: { ru: 'Отправлять сообщения и кнопки', en: 'Send messages and buttons' },
  manage_messages: { ru: 'Редактировать/удалять свои сообщения', en: 'Manage its own messages' },
}
