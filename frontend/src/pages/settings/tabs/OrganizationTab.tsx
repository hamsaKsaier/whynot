import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FiSave, FiUserPlus, FiTrash2, FiArrowRight, FiMail } from 'react-icons/fi';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '../../../components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../../components/ui/table';
import { apiClient } from '../../../services/api';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from 'sonner';

interface Member {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: string;
  createdAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

export const OrganizationTab: React.FC = () => {
  const { t } = useTranslation('settings');
  const { user } = useAuth();

  const [orgName, setOrgName] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  const [showTransferDialog, setShowTransferDialog] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState('');
  const [transferConfirm, setTransferConfirm] = useState('');

  const [removingId, setRemovingId] = useState<string | null>(null);

  const loadOrganization = useCallback(async () => {
    try {
      const [orgRes, membersRes, invitationsRes] = await Promise.all([
        apiClient.get('/me/organization'),
        apiClient.get('/me/organization/members'),
        apiClient.get('/me/organization/invitations'),
      ]);
      setOrgName(orgRes.data.name || '');
      setMembers(orgRes.data.members || membersRes.data.members || []);
      setInvitations(invitationsRes.data.invitations || []);
    } catch {
      toast.error('Failed to load organization');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOrganization();
  }, [loadOrganization]);

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await apiClient.patch('/me/organization', { name: orgName });
      toast.success(t('settings.org.saved', { defaultValue: 'Organization updated' }));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to update organization');
    } finally {
      setSaving(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviting(true);
    try {
      await apiClient.post('/me/organization/invitations', { email: inviteEmail, role: inviteRole });
      toast.success(t('settings.org.inviteSent', { defaultValue: 'Invitation sent' }));
      setShowInviteDialog(false);
      setInviteEmail('');
      setInviteRole('member');
      loadOrganization();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to send invitation');
    } finally {
      setInviting(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setRemovingId(memberId);
    try {
      await apiClient.delete(`/me/organization/members/${memberId}`);
      toast.success(t('settings.org.memberRemoved', { defaultValue: 'Member removed' }));
      loadOrganization();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to remove member');
    } finally {
      setRemovingId(null);
    }
  };

  const handleTransferOwnership = async () => {
    if (transferConfirm !== 'TRANSFER') return;
    try {
      await apiClient.post('/me/organization/transfer', { newOwnerId: transferTargetId });
      toast.success(t('settings.org.ownershipTransferred', { defaultValue: 'Ownership transferred' }));
      setShowTransferDialog(false);
      setTransferConfirm('');
      loadOrganization();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to transfer ownership');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">{t('settings.org.title', { defaultValue: 'Organization' })}</CardTitle>
          <CardDescription className="text-slate-400">{t('settings.org.description', { defaultValue: 'Manage your organization name and settings' })}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveOrg} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                {t('settings.org.name', { defaultValue: 'Organization name' })}
              </label>
              <input
                type="text"
                value={orgName}
                onChange={(e) => setOrgName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
                required
              />
            </div>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <FiSave className="h-4 w-4" />}
              {t('settings.org.save', { defaultValue: 'Save' })}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="bg-slate-800/50 border-slate-700">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-white">{t('settings.org.members', { defaultValue: 'Members' })}</CardTitle>
            <CardDescription className="text-slate-400">{t('settings.org.membersDesc', { defaultValue: 'People in your organization' })}</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(true)} className="gap-2">
            <FiUserPlus className="h-4 w-4" />
            {t('settings.org.invite', { defaultValue: 'Invite member' })}
          </Button>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-slate-400 text-sm">{t('settings.org.noMembers', { defaultValue: 'No members yet' })}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700">
                  <TableHead className="text-start text-slate-400">{t('settings.org.memberName', { defaultValue: 'Name' })}</TableHead>
                  <TableHead className="text-start text-slate-400">{t('settings.org.memberEmail', { defaultValue: 'Email' })}</TableHead>
                  <TableHead className="text-start text-slate-400">{t('settings.org.memberRole', { defaultValue: 'Role' })}</TableHead>
                  <TableHead className="text-end text-slate-400">{t('settings.org.actions', { defaultValue: 'Actions' })}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member.id} className="border-slate-700">
                    <TableCell className="text-start text-white">{member.name}</TableCell>
                    <TableCell className="text-start text-slate-300">{member.email}</TableCell>
                    <TableCell className="text-start">
                      <Badge variant="outline" className="text-slate-300 border-slate-600">
                        {member.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-end">
                      {member.userId !== user?.id && member.role !== 'owner' && (
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setTransferTargetId(member.userId); setShowTransferDialog(true); }}
                            className="text-slate-400 hover:text-white"
                          >
                            <FiArrowRight className="h-4 w-4 rtl:scale-x-[-1]" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={removingId === member.id}
                            className="text-red-400 hover:text-red-300"
                          >
                            {removingId === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <FiTrash2 className="h-4 w-4" />}
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          {invitations.length > 0 && (
            <div className="mt-6">
              <h4 className="text-sm font-medium text-slate-300 mb-2">{t('settings.org.pendingInvitations', { defaultValue: 'Pending Invitations' })}</h4>
              {invitations.map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                  <div className="flex items-center gap-2">
                    <FiMail className="h-4 w-4 text-slate-400" />
                    <span className="text-slate-300">{inv.email}</span>
                    <Badge variant="outline" className="text-slate-400 border-slate-600">{inv.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={showInviteDialog} onOpenChange={setShowInviteDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">{t('settings.org.inviteTitle', { defaultValue: 'Invite a member' })}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.org.inviteEmail', { defaultValue: 'Email address' })}</label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">{t('settings.org.inviteRole', { defaultValue: 'Role' })}</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white focus:outline-none focus:border-primary-500"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">{t('settings.org.cancel', { defaultValue: 'Cancel' })}</Button>
              </DialogClose>
              <Button type="submit" disabled={inviting} className="gap-2">
                {inviting && <Loader2 className="h-4 w-4 animate-spin" />}
                {t('settings.org.sendInvite', { defaultValue: 'Send invitation' })}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showTransferDialog} onOpenChange={setShowTransferDialog}>
        <DialogContent className="bg-slate-800 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white">{t('settings.org.transferTitle', { defaultValue: 'Transfer Ownership' })}</DialogTitle>
          </DialogHeader>
          <p className="text-slate-400 text-sm">
            {t('settings.org.transferWarning', { defaultValue: 'This will transfer organization ownership. Type TRANSFER to confirm.' })}
          </p>
          <input
            type="text"
            value={transferConfirm}
            onChange={(e) => setTransferConfirm(e.target.value)}
            placeholder="TRANSFER"
            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:border-primary-500"
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">{t('settings.org.cancel', { defaultValue: 'Cancel' })}</Button>
            </DialogClose>
            <Button
              variant="destructive"
              onClick={handleTransferOwnership}
              disabled={transferConfirm !== 'TRANSFER'}
            >
              {t('settings.org.confirmTransfer', { defaultValue: 'Transfer ownership' })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
