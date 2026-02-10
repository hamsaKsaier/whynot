-- Migration: 016_webhooks.sql
-- Phase 9: Enhanced CI/CD Integration and Webhooks
-- API key management, webhook logging, and notification channels

-- Create API keys table
CREATE TABLE IF NOT EXISTS qa_loop_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(64) NOT NULL,
    key_prefix VARCHAR(8) NOT NULL,
    permissions JSONB DEFAULT '["retest", "status"]',
    rate_limit_per_hour INTEGER DEFAULT 100,
    last_used_at TIMESTAMP,
    expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at TIMESTAMP
);

-- Create webhook logs table
CREATE TABLE IF NOT EXISTS qa_loop_webhook_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    api_key_id UUID REFERENCES qa_loop_api_keys(id),
    endpoint VARCHAR(100) NOT NULL,
    method VARCHAR(10) NOT NULL,
    request_body JSONB,
    response_status INTEGER,
    response_body JSONB,
    ip_address VARCHAR(45),
    user_agent TEXT,
    duration_ms INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notification channels table
CREATE TABLE IF NOT EXISTS qa_loop_notification_channels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    channel_type VARCHAR(50) NOT NULL,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add triggered_by column to sessions if not exists
ALTER TABLE qa_loop_sessions ADD COLUMN IF NOT EXISTS triggered_by VARCHAR(50) DEFAULT 'manual';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created ON qa_loop_webhook_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_api_key ON qa_loop_webhook_logs(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON qa_loop_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON qa_loop_api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_notification_channels_type ON qa_loop_notification_channels(channel_type);
CREATE INDEX IF NOT EXISTS idx_notification_channels_active ON qa_loop_notification_channels(is_active) WHERE is_active = true;

-- Create view for API key usage analytics
CREATE OR REPLACE VIEW qa_loop_api_key_usage AS
SELECT 
    ak.id,
    ak.name,
    ak.key_prefix,
    ak.permissions,
    ak.rate_limit_per_hour,
    ak.last_used_at,
    ak.expires_at,
    ak.created_at,
    ak.revoked_at,
    COALESCE(stats.request_count, 0) as total_requests,
    COALESCE(stats.success_count, 0) as successful_requests,
    COALESCE(stats.failure_count, 0) as failed_requests,
    COALESCE(stats.avg_duration_ms, 0) as avg_duration_ms
FROM qa_loop_api_keys ak
LEFT JOIN (
    SELECT 
        api_key_id,
        COUNT(*) as request_count,
        SUM(CASE WHEN response_status >= 200 AND response_status < 300 THEN 1 ELSE 0 END) as success_count,
        SUM(CASE WHEN response_status >= 400 THEN 1 ELSE 0 END) as failure_count,
        ROUND(AVG(duration_ms)) as avg_duration_ms
    FROM qa_loop_webhook_logs
    WHERE created_at > NOW() - INTERVAL '30 days'
    GROUP BY api_key_id
) stats ON ak.id = stats.api_key_id;

-- Create function to clean old webhook logs (keep last 30 days)
CREATE OR REPLACE FUNCTION clean_old_webhook_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM qa_loop_webhook_logs
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE qa_loop_api_keys IS 'API keys for webhook authentication';
COMMENT ON COLUMN qa_loop_api_keys.key_hash IS 'SHA-256 hash of the full API key';
COMMENT ON COLUMN qa_loop_api_keys.key_prefix IS 'First 8 characters of key for identification';
COMMENT ON COLUMN qa_loop_api_keys.permissions IS 'JSON array of permissions: retest, status, trigger, admin';

COMMENT ON TABLE qa_loop_webhook_logs IS 'Audit log of all webhook requests';
COMMENT ON COLUMN qa_loop_webhook_logs.ip_address IS 'Client IP address (IPv4 or IPv6)';
COMMENT ON COLUMN qa_loop_webhook_logs.duration_ms IS 'Request processing time in milliseconds';

COMMENT ON TABLE qa_loop_notification_channels IS 'Notification destinations for QA events';
COMMENT ON COLUMN qa_loop_notification_channels.channel_type IS 'Type: slack, discord, email, webhook';
COMMENT ON COLUMN qa_loop_notification_channels.config IS 'Channel-specific configuration (webhookUrl, etc.)';
