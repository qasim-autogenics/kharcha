import { createContext, useContext } from "react";
import type { PayDirection } from "./types";

/** A request to jump to the Roommates tab with a payment sheet already open for one person. */
export interface PayIntent { personId: string; direction: PayDirection; amount: number }
interface NavCtx { openPay: (i: PayIntent) => void; intent: PayIntent | null; clearIntent: () => void }

export const Nav = createContext<NavCtx>({ openPay: () => {}, intent: null, clearIntent: () => {} });
export const useNav = () => useContext(Nav);
