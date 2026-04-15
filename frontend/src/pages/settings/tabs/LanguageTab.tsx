import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FiCheck } from 'react-icons/fi';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { apiClient } from '../../../services/api';
import { toast } from 'sonner';

const LANGUAGES = [
  { code: 'en', label: 'English', nativeLabel: 'English' },
  { code: 'ar', label: 'Arabic', nativeLabel: 'العربية' },
  { code: 'fr', label: 'French', nativeLabel: 'Français' },
  { code: 'de', label: 'German', nativeLabel: 'Deutsch' },
  { code: 'es', label: 'Spanish', nativeLabel: 'Español' },
];

export const LanguageTab: React.FC = () => {
  const { t, i18n } = useTranslation('settings');
  const [saving, setSaving] = useState(false);
  const currentLang = i18n.language?.split('-')[0] || 'en';

  const handleLanguageChange = async (langCode: string) => {
    if (langCode === currentLang) return;
    setSaving(true);
    try {
      await i18n.changeLanguage(langCode);
      document.documentElement.dir = langCode === 'ar' ? 'rtl' : 'ltr';
      document.documentElement.lang = langCode;

      try {
        await apiClient.patch('/me/language', { language: langCode });
      } catch {
        // Language changed locally even if server persist fails
      }

      toast.success(t('settings.language.changed', { defaultValue: 'Language updated' }));
    } catch {
      toast.error('Failed to change language');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">{t('settings.language.title', { defaultValue: 'Language' })}</CardTitle>
          <CardDescription className="text-slate-400">
            {t('settings.language.description', { defaultValue: 'Choose your preferred language. The interface will update immediately.' })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {LANGUAGES.map((lang) => {
              const isActive = currentLang === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  disabled={saving}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-md text-start transition-colors ${
                    isActive
                      ? 'bg-primary-600/20 border border-primary-500/50 text-white'
                      : 'hover:bg-slate-700/50 text-slate-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{lang.nativeLabel}</span>
                    <span className="text-sm text-slate-400">{lang.label}</span>
                  </div>
                  {isActive && <FiCheck className="h-4 w-4 text-primary-400" />}
                  {saving && currentLang !== lang.code && (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
