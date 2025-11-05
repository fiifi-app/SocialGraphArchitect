import { Badge } from "@/components/ui/badge";

type ContactType = 'LP' | 'GP' | 'Angel' | 'FamilyOffice' | 'Startup' | 'Other';

interface RoleTagProps {
  type: ContactType | null | undefined;
  className?: string;
}

const ROLE_CONFIG: Record<ContactType, { label: string; color: string; bgColor: string }> = {
  GP: {
    label: 'GP',
    color: '#0EA5E9', // cyan-500
    bgColor: 'rgba(14, 165, 233, 0.1)',
  },
  Startup: {
    label: 'Startup',
    color: '#22C55E', // green-500
    bgColor: 'rgba(34, 197, 94, 0.1)',
  },
  Angel: {
    label: 'Angel',
    color: '#A855F7', // purple-500
    bgColor: 'rgba(168, 85, 247, 0.1)',
  },
  LP: {
    label: 'LP',
    color: '#F59E0B', // amber-500
    bgColor: 'rgba(245, 158, 11, 0.1)',
  },
  FamilyOffice: {
    label: 'Family Office',
    color: '#F43F5E', // rose-500
    bgColor: 'rgba(244, 63, 94, 0.1)',
  },
  Other: {
    label: 'Other',
    color: '#6B7280', // gray-500
    bgColor: 'rgba(107, 114, 128, 0.1)',
  },
};

export default function RoleTag({ type, className }: RoleTagProps) {
  if (!type) return null;

  const config = ROLE_CONFIG[type];
  
  return (
    <Badge
      variant="outline"
      className={className}
      style={{
        color: config.color,
        borderColor: config.color,
        backgroundColor: config.bgColor,
      }}
      data-testid={`role-tag-${type.toLowerCase()}`}
    >
      {config.label}
    </Badge>
  );
}
