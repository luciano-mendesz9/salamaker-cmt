ALTER TABLE "InvestmentPosition"
DROP CONSTRAINT IF EXISTS "InvestmentPosition_principal_check";

ALTER TABLE "InvestmentPosition"
ADD CONSTRAINT "InvestmentPosition_principal_check" CHECK (
  (
    "product" = 'MAKER_SAVINGS'
    AND "principal" BETWEEN 1 AND 1000
  )
  OR
  (
    "product" IN ('MAKER_BOND', 'MAKER_BOND_PLUS')
    AND "principal" BETWEEN 1000 AND 3000
    AND "principal" % 1000 = 0
  )
);
