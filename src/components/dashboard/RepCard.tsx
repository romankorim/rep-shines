import { Link } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface RepData {
  id: string;
  name: string;
  team: string;
  totalCommission: number;
  attainment: number;
  dealCount: number;
  quotaTier: { tier_name: string; color: string };
}

interface RepCardProps {
  rep: RepData;
}

const tierColorMap: Record<string, string> = {
  destructive: "bg-destructive/15 text-destructive border-destructive/20",
  warning: "bg-warning/15 text-warning-foreground border-warning/20",
  success: "bg-success/15 text-success border-success/20",
  primary: "bg-primary/15 text-primary border-primary/20",
};

const progressColorMap: Record<string, string> = {
  destructive: "[&>[data-slot=indicator]]:bg-destructive",
  warning: "[&>[data-slot=indicator]]:bg-warning",
  success: "[&>[data-slot=indicator]]:bg-success",
  primary: "[&>[data-slot=indicator]]:bg-primary",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}

export function RepCard({ rep }: RepCardProps) {
  const tier = rep.quotaTier;

  return (
    <Link to="/reps/$repId" params={{ repId: rep.id }}>
      <Card className="border-border/50 transition-colors hover:border-primary/30 hover:bg-card/80 cursor-pointer">
        <CardContent className="p-5">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                {rep.name.split(" ").map((n: string) => n[0]).join("")}
              </div>
              <div>
                <p className="text-sm font-semibold text-card-foreground">{rep.name}</p>
                <p className="text-xs text-muted-foreground">{rep.team}</p>
              </div>
            </div>
            <Badge variant="outline" className={cn("text-[10px] font-medium border", tierColorMap[tier.color])}>
              {tier.tier_name}
            </Badge>
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Quota attainment</span>
              <span className="text-xs font-semibold text-card-foreground">{Math.round(rep.attainment)}%</span>
            </div>
            <Progress value={Math.min(rep.attainment, 100)} className={cn("h-1.5 bg-secondary", progressColorMap[tier.color])} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Commission</p>
              <p className="text-sm font-semibold text-card-foreground">{formatCurrency(rep.totalCommission)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Deals</p>
              <p className="text-sm font-semibold text-card-foreground">{rep.dealCount}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
