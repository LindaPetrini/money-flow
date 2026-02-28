import { Badge } from '@/components/ui/badge';

interface ModeBadgeProps {
  mode: 'stabilize' | 'distribute';
}

const MODE_CONFIG = {
  stabilize: {
    label: 'Stabilize',
    explanation: 'Buffer or floor items need funding',
    variant: 'outline' as const,
  },
  distribute: {
    label: 'Distribute',
    explanation: 'All floors covered — splitting surplus',
    variant: 'default' as const,
  },
};

export function ModeBadge({ mode }: ModeBadgeProps) {
  const { label, explanation, variant } = MODE_CONFIG[mode];

  return (
    <div className="flex flex-col items-end gap-0.5">
      <Badge variant={variant}>{label}</Badge>
      <span className="text-xs text-muted-foreground">{explanation}</span>
    </div>
  );
}
