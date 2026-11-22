# Stage 10: financial statements and aging

Posted-only GL reports reuse journal and account records. Profit and loss uses period movements; the balance sheet adds accumulated unclosed earnings explicitly. Cash flow groups net class-11 movements by counterpart classification and displays mixed/unclassified and opening balances separately. Reports export CSV in company base currency. No cost centers.

Aging supports all clients/vendors or a selected Third Party and one currency at a time, with not-due, 1–30, 31–60, 61–90, 90+ and missing-due-date buckets. It reuses current unsettled items, including completed Media collections awaiting Accounting posting; it is not a historical aging reconstruction. Advances remain on the consolidated Third Party statement.

Validation: typecheck, targeted lint, model/navigation tests and rollback-only development SQL regression. Stage 9 bank matching/closing was browser verified, and the isolated fixture removed. The Chrome file chooser repeatedly stalled; CSV parser and database import tests passed, but browser upload verification remains incomplete.
