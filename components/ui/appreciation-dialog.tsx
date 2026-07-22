"use client";

import React from "react";
import { MilestoneCelebrationModal, MilestoneCelebrationModalProps } from "./milestone-celebration-modal";

export type AppreciationDialogProps = Omit<MilestoneCelebrationModalProps, "variant">;

export function AppreciationDialog(props: AppreciationDialogProps) {
  return <MilestoneCelebrationModal {...props} variant="appreciation" />;
}
