\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout='10s';
SET LOCAL statement_timeout='60s';
SET LOCAL search_path=public;
\ir vendor-io-quantities-20261111-core.sql
-- Default is a rollback rehearsal; pass -v apply=true only for the approved repair.
\if :{?apply}
  \if :apply
    COMMIT;
  \else
    ROLLBACK;
  \endif
\else
  ROLLBACK;
\endif
