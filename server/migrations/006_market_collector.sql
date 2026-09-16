ALTER TABLE trade_stream ADD COLUMN collector_config jsonb;
ALTER TABLE trade_stream ADD COLUMN halt_reason text;
CREATE TABLE market_quotes (
 source text NOT NULL,
 bucket_end bigint NOT NULL,
 quote jsonb NOT NULL,
 PRIMARY KEY(source,bucket_end)
);
