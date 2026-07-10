export const PaymentMode = {
  UPI: "UPI",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  NET_BANKING: "Net Banking",
  CASH: "Cash",
  NONE: ""
} as const;
export type PaymentMode = typeof PaymentMode[keyof typeof PaymentMode];

export const TransactionType = {
  DEBIT: "DEBIT",
  CREDIT: "CREDIT"
} as const;
export type TransactionType = typeof TransactionType[keyof typeof TransactionType];
