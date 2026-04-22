import { useFeatureFlagsContext } from '../providers/FeatureFlagsProvider';

export function useFeatureFlag(key: string): boolean {
  const { flags } = useFeatureFlagsContext();
  return flags[key] ?? false;
}
