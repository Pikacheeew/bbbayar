import { Progress } from "@/components/ui/progress";

export default function ProgressBar({
  percent,
  label,
}: {
  percent: number;
  label?: string;
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div>
      {label && (
        <p className="mb-1 flex justify-between text-xs text-muted-foreground">
          <span>{label}</span>
          <span className="font-medium text-foreground">{clamped}%</span>
        </p>
      )}
      <Progress
        value={clamped}
        className="block [&_[data-slot=progress-indicator]]:bg-emerald-500"
      />
    </div>
  );
}
