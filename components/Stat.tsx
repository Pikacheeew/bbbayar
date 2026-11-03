import { Card } from "@/components/ui/card";

export default function Stat({
  label,
  value,
  breakWords,
}: {
  label: string;
  value: string;
  breakWords?: boolean;
}) {
  return (
    <Card className="p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`mt-1 font-medium text-foreground ${breakWords ? "break-words" : ""}`}>
        {value}
      </dd>
    </Card>
  );
}
