-- PostgreSQL starter schema. Apply manually after provisioning a database.
CREATE TABLE IF NOT EXISTS chains (
  chain_id BIGINT PRIMARY KEY,
  name TEXT NOT NULL,
  rpc_label TEXT,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS threat_addresses (
  id BIGSERIAL PRIMARY KEY,
  chain_id BIGINT NOT NULL REFERENCES chains(chain_id),
  address TEXT NOT NULL,
  threat_type TEXT NOT NULL,
  source TEXT NOT NULL,
  confidence SMALLINT NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(chain_id, address, threat_type, source)
);

CREATE TABLE IF NOT EXISTS transaction_scans (
  id UUID PRIMARY KEY,
  chain_id BIGINT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  calldata_selector TEXT,
  status TEXT NOT NULL,
  risk_score SMALLINT NOT NULL CHECK (risk_score BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS risk_findings (
  id BIGSERIAL PRIMARY KEY,
  scan_id UUID NOT NULL REFERENCES transaction_scans(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  description TEXT NOT NULL
);

-- Do not store private keys, seed phrases, passwords, or raw authentication secrets.
