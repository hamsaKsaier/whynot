import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiSave, FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../contexts/AuthContext';
import { apiClient } from '../../../services/api';
import { toast } from 'sonner';

export const ProfileTab: React.FC = () => {
  const { t } = useTranslation('settings');
  const { user } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const loadProfile = useCallback(async () => {
    try {
      const res = await apiClient.get('/me/profile');
      setName(res.data.name || '');
      setEmail(res.data.email || '');
    } catch {
      if (user) {
        setName(user.name || '');
        setEmail(user.email || '');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch('/me/profile', { name, email });
      toast.success(t('settings.profile.saved', { defaultValue: 'Profile updated' }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(t('settings.profile.passwordMismatch', { defaultValue: 'Passwords do not match' }));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t('settings.profile.passwordTooShort', { defaultValue: 'Password must be at least 8 characters' }));
      return;
    }
    setChangingPassword(true);
    try {
      await apiClient.post('/me/password', { currentPassword, newPassword });
      toast.success(t('settings.profile.passwordChanged', { defaultValue: 'Password changed successfully' }));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t('settings.profile.title', { defaultValue: 'Profile Information' })}</CardTitle>
          <CardDescription className="text-muted-foreground">{t('settings.profile.description', { defaultValue: 'Update your name and email address' })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {t('settings.profile.name', { defaultValue: 'Full name' })}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">
                  {t('settings.profile.email', { defaultValue: 'Email address' })}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  required
                />
              </div>
            </div>
            <Button type="submit" disabled={saving} className="gap-2 w-full sm:w-auto">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
              {t('settings.profile.save', { defaultValue: 'Save changes' })}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-foreground">{t('settings.profile.changePassword', { defaultValue: 'Change Password' })}</CardTitle>
          <CardDescription className="text-muted-foreground">{t('settings.profile.changePasswordDesc', { defaultValue: 'Update your password. You must provide your current password.' })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t('settings.profile.currentPassword', { defaultValue: 'Current password' })}
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-3 py-2 pe-10 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showCurrentPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t('settings.profile.newPassword', { defaultValue: 'New password' })}
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 py-2 pe-10 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  required
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showNewPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-1">
                {t('settings.profile.confirmPassword', { defaultValue: 'Confirm new password' })}
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                required
                minLength={8}
              />
            </div>
            <Button type="submit" disabled={changingPassword} className="gap-2 w-full sm:w-auto">
              {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <FiLock className="h-4 w-4" />}
              {t('settings.profile.updatePassword', { defaultValue: 'Update password' })}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};
