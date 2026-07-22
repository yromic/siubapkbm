"use client";

import React from "react";
import { MilestoneCelebrationModal, MilestoneCelebrationModalProps } from "./milestone-celebration-modal";

export type CelebrationModalProps = Omit<MilestoneCelebrationModalProps, "variant">;

export function CelebrationModal(props: CelebrationModalProps) {
  return <MilestoneCelebrationModal {...props} variant="celebration" />;
}
