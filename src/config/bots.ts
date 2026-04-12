export interface BotConfig {
  id: 'chb' | 'sa' | 'fpc'
  label: string
  icon: string
  color: string
  defaultUrl: string
  storageKey: string
}

export const BOTS: BotConfig[] = [
  {
    id: 'sa',
    label: 'SexyAffair',
    icon: '💋',
    color: '#f472b6',
    defaultUrl: 'http://localhost:8002',
    storageKey: 'botUrl_sa',
  },
  {
    id: 'fpc',
    label: 'FPC',
    icon: '🎯',
    color: '#a78bfa',
    defaultUrl: 'http://localhost:8003',
    storageKey: 'botUrl_fpc',
  },
  {
    id: 'chb',
    label: 'ChatHomeBase',
    icon: '🏠',
    color: '#60a5fa',
    defaultUrl: (import.meta.env.VITE_API_URL as string) || 'http://localhost:8000',
    storageKey: 'botUrl_chb',
  },
]

export function getBotUrl(bot: BotConfig): string {
  try {
    return localStorage.getItem(bot.storageKey) || bot.defaultUrl
  } catch {
    return bot.defaultUrl
  }
}

export function setBotUrl(bot: BotConfig, url: string): void {
  try {
    localStorage.setItem(bot.storageKey, url)
  } catch {
    // ignore
  }
}
