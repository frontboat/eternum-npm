import { ModalContainer } from "@/ui/components/modal-container";
import { LoadingAnimation } from "@/ui/elements/loading-animation";
import { ID } from "@frontboat/types";
import { Suspense } from "react";
import { HelpContainer } from "./help-container";

export const HelpModal = ({
  selected,
  target,
  allowBothDirections = false,
}: {
  selected: {
    type: "explorer" | "structure";
    id: ID;
    hex: { x: number; y: number };
  };
  target: {
    type: "explorer" | "structure";
    id: ID;
    hex: { x: number; y: number };
  };
  allowBothDirections?: boolean;
}) => {
  return (
    <ModalContainer size="large">
      <div className="production-modal-selector container mx-auto grid grid-cols-12  h-full row-span-12 rounded-2xl relative">
        <div className="h-full col-span-12 overflow-y-auto">
          <Suspense fallback={<LoadingAnimation />}>
            <HelpContainer selected={selected} target={target} allowBothDirections={allowBothDirections} />
          </Suspense>
        </div>
      </div>
    </ModalContainer>
  );
};
