import { authenticated } from '@/lib/translation-admin/http'
import { passwordConfigured } from '@/lib/translation-admin/security.mjs'
import { TranslationAdmin } from '@/components/admin/translation-admin'

export const metadata = {
  title: '翻译管理',
  robots: { index: false, follow: false },
  alternates: { canonical: '/admin/translations', languages: {} }
}
export default async function TranslationAdminPage() {
  return (
    <TranslationAdmin
      initialAuthenticated={await authenticated()}
      configured={passwordConfigured(process.env.TRANSLATION_ADMIN_PASSWORD)}
    />
  )
}
