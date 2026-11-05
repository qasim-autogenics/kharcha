import { APP } from "./config";

const nf = new Intl.NumberFormat(APP.LOCALE, { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat(APP.LOCALE, { maximumFractionDigits: 2 });

export const money = (n: number) => `${n < 0 ? "-" : ""}${APP.CURRENCY_LABEL} ${nf.format(Math.abs(Math.round(n)))}`;
export const moneyExact = (n: number) => `${n < 0 ? "-" : ""}${APP.CURRENCY_LABEL} ${nf2.format(Math.abs(n))}`;
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
