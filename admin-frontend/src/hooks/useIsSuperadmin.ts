import { useAuth } from '../contexts/AuthContext';

export function useIsSuperadmin(): boolean {
  const { isSuperadmin } = useAuth();
  return isSuperadmin;
}
