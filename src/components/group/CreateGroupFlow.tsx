"use client";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { VisuallyHidden } from "radix-ui";
import { useUIStore } from "@/store/ui";
import { Step1SelectMembers } from "./Step1SelectMembers";
import { Step2GroupDetails } from "./Step2GroupDetails";

export function CreateGroupFlow() {
  const createFlow = useUIStore((s) => s.createFlow);
  const closeCreateFlow = useUIStore((s) => s.closeCreateFlow);
  const setCreateFlowStep = useUIStore((s) => s.setCreateFlowStep);

  if (!createFlow || createFlow.type !== "group") return null;

  return (
    <Sheet
      open={createFlow.isOpen}
      onOpenChange={(open) => {
        if (!open) closeCreateFlow();
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-md p-0 [&>button]:hidden"
      >
        <VisuallyHidden.Root><SheetTitle>Новая группа</SheetTitle></VisuallyHidden.Root>
        {createFlow.step === 1 && (
          <Step1SelectMembers
            title="Новая группа"
            nextLabel="Далее"
            onBack={closeCreateFlow}
            onNext={() => setCreateFlowStep(2)}
          />
        )}
        {createFlow.step === 2 && <Step2GroupDetails />}
      </SheetContent>
    </Sheet>
  );
}
