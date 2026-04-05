type EmptyStateProps = {
  icon?: string;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
};

export default function EmptyState({ icon = '◈', title, description, action }: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', gap: 12, textAlign: 'center',
    }}>
      <div style={{
        fontSize: 32, lineHeight: 1,
        opacity: 0.25,
        filter: 'grayscale(1)',
      }}>{icon}</div>
      <div style={{
        fontSize: 12, fontWeight: 700, color: 'var(--text-dim)',
        letterSpacing: 1, textTransform: 'uppercase',
      }}>{title}</div>
      {description && (
        <div style={{ fontSize: 11, color: 'var(--text-dim)', maxWidth: 260, lineHeight: 1.6, opacity: 0.7 }}>
          {description}
        </div>
      )}
      {action && (
        <button className="btn cyan btn-sm" onClick={action.onClick} style={{ marginTop: 4 }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
