import type { Locale } from './config.ts';
export const en = {
  'error.title': 'Unable to complete this action',
  'error.guild': 'This bot is only available in approved community servers.',
  'error.permission': 'You do not have permission to use this action.',
  'error.botPermission': 'The bot is missing a required permission in this channel.',
  'error.expired': 'This action is unavailable. Open a new panel with the command.',
  'error.rate': 'Too many requests. Please try again in a few seconds.',
  'error.generic': 'An internal error occurred. Reference: {reference}',
  'error.input': 'The supplied value is not supported.',
  'system.title': 'Yuna-chan · System',
  'system.body': 'The foundation is online. Community feature modules are not installed yet.',
  'system.uptime': 'Uptime: {seconds} seconds',
  'system.refresh': 'Refresh',
  'settings.title': 'Server settings',
  'settings.body': 'Default language for public bot messages: **{language}**. Private responses follow your Discord language.',
  'settings.placeholder': 'Choose the server language',
  'settings.saved': 'The server language has been saved.',
} as const;
export type TranslationKey = keyof typeof en;
export const vi: Record<TranslationKey, string> = {
  'error.title': 'Không thể thực hiện thao tác',
  'error.guild': 'Bot chỉ hoạt động trong các server cộng đồng được cho phép.',
  'error.permission': 'Bạn không có quyền thực hiện thao tác này.',
  'error.botPermission': 'Bot thiếu quyền cần thiết trong kênh này.',
  'error.expired': 'Thao tác này không còn khả dụng. Hãy dùng lệnh để mở bảng mới.',
  'error.rate': 'Bạn thao tác quá nhanh. Hãy thử lại sau vài giây.',
  'error.generic': 'Đã xảy ra lỗi nội bộ. Mã tham chiếu: {reference}',
  'error.input': 'Giá trị được cung cấp không được hỗ trợ.',
  'system.title': 'Yuna-chan · Hệ thống',
  'system.body': 'Nền tảng đang hoạt động. Chưa cài đặt module tính năng cộng đồng.',
  'system.uptime': 'Thời gian hoạt động: {seconds} giây',
  'system.refresh': 'Làm mới',
  'settings.title': 'Cấu hình server',
  'settings.body': 'Ngôn ngữ mặc định cho thông báo công khai của bot: **{language}**. Phản hồi riêng dùng ngôn ngữ Discord của bạn.',
  'settings.placeholder': 'Chọn ngôn ngữ của server',
  'settings.saved': 'Đã lưu ngôn ngữ của server.',
};
export function resolveLocale(locale: string | null | undefined, fallback: Locale = 'en'): Locale {
  const language = locale?.toLowerCase().split('-')[0];
  return language === 'vi' || language === 'en' ? language : fallback;
}
export function t(locale: Locale, key: TranslationKey, values: Record<string, string | number> = {}): string {
  const template = (locale === 'vi' ? vi[key] : en[key]) ?? en[key];
  return template.replace(/\{([a-zA-Z]+)\}/g, (_, name: string) => {
    if (values[name] === undefined) throw new Error(`Missing translation argument: ${key}.${name}`);
    return String(values[name]);
  });
}
export function isLocale(value: unknown): value is Locale { return value === 'en' || value === 'vi'; }
