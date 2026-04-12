import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useRealtimeDeals() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("deals-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "deals" }, () => {
        queryClient.invalidateQueries({ queryKey: ["deals"] });
        queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        queryClient.invalidateQueries({ queryKey: ["reps"] });
        queryClient.invalidateQueries({ queryKey: ["rep"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
