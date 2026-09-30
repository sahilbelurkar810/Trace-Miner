// Sample log files — realistic DB / API / infra traces
// Each log is an array of { ts, level, source, message, raw } objects
// so the scanner can highlight individual lines.

window.SAMPLE_LOGS = [
  {
    id: 'api-gateway',
    name: 'api-gateway.log',
    size: 4821,
    type: 'api',
    lines: [
      { ts: '2026-04-22T08:14:02.103Z', level: 'INFO',  msg: 'api-gateway started on :8080, 14 routes loaded' },
      { ts: '2026-04-22T08:14:03.441Z', level: 'INFO',  msg: 'healthcheck GET /healthz 200 3ms' },
      { ts: '2026-04-22T08:22:17.882Z', level: 'WARN',  msg: 'upstream auth-service p95 latency 812ms (threshold 400ms)' },
      { ts: '2026-04-22T08:22:44.012Z', level: 'ERROR', msg: 'upstream auth-service timeout after 5000ms on POST /v2/token' },
      { ts: '2026-04-22T08:22:44.014Z', level: 'ERROR', msg: 'connection pool exhausted: 64/64 in use, 128 queued' },
      { ts: '2026-04-22T08:22:45.220Z', level: 'ERROR', msg: 'upstream auth-service timeout after 5000ms on POST /v2/token' },
      { ts: '2026-04-22T08:22:46.110Z', level: 'ERROR', msg: 'circuit breaker OPEN for auth-service (5 failures / 10s)' },
      { ts: '2026-04-22T08:23:02.441Z', level: 'ERROR', msg: 'connection pool exhausted: 64/64 in use, 203 queued' },
      { ts: '2026-04-22T08:24:12.117Z', level: 'INFO',  msg: 'circuit breaker HALF_OPEN for auth-service, probing' },
      { ts: '2026-04-22T08:24:13.002Z', level: 'ERROR', msg: 'upstream auth-service timeout after 5000ms on POST /v2/token' },
      { ts: '2026-04-22T08:24:13.140Z', level: 'ERROR', msg: 'circuit breaker OPEN for auth-service (6 failures / 12s)' },
      { ts: '2026-04-22T08:25:44.990Z', level: 'WARN',  msg: 'deploying api-gateway v4.12.1 → v4.12.2 (rolling)' },
      { ts: '2026-04-22T08:26:18.301Z', level: 'ERROR', msg: 'config key FEATURE_NEW_TOKEN_FLOW missing from env (staging)' },
      { ts: '2026-04-22T08:26:18.309Z', level: 'FATAL', msg: 'panic: nil pointer dereference at handlers/token.go:142' },
      { ts: '2026-04-22T08:26:18.311Z', level: 'INFO',  msg: 'pod api-gateway-7f8c restart #2 in last 5m' },
    ]
  },
  {
    id: 'orders-db',
    name: 'orders-db.log',
    size: 3122,
    type: 'database',
    lines: [
      { ts: '2026-04-22T08:11:44.002Z', level: 'INFO',  msg: 'postgres 15.4 started, max_connections=200' },
      { ts: '2026-04-22T08:20:01.221Z', level: 'WARN',  msg: 'slow query 1842ms SELECT * FROM orders WHERE status=$1 ORDER BY created_at' },
      { ts: '2026-04-22T08:22:40.118Z', level: 'ERROR', msg: 'connection pool at capacity: 200/200 active, 47 waiting' },
      { ts: '2026-04-22T08:22:44.009Z', level: 'ERROR', msg: 'connection timeout after 5000ms (pool exhausted)' },
      { ts: '2026-04-22T08:22:44.210Z', level: 'ERROR', msg: 'connection timeout after 5000ms (pool exhausted)' },
      { ts: '2026-04-22T08:22:45.882Z', level: 'ERROR', msg: 'deadlock detected on relation orders, victim PID 28471' },
      { ts: '2026-04-22T08:23:11.002Z', level: 'ERROR', msg: 'connection pool at capacity: 200/200 active, 112 waiting' },
      { ts: '2026-04-22T08:23:18.442Z', level: 'ERROR', msg: 'connection timeout after 5000ms (pool exhausted)' },
      { ts: '2026-04-22T08:24:51.227Z', level: 'WARN',  msg: 'autovacuum worker started on public.orders (dead_tuples=184221)' },
      { ts: '2026-04-22T08:27:02.114Z', level: 'ERROR', msg: 'replication lag 14s exceeds threshold 5s on replica-02' },
      { ts: '2026-04-22T08:28:18.990Z', level: 'ERROR', msg: 'replication lag 22s exceeds threshold 5s on replica-02' },
    ]
  },
  {
    id: 'k8s-cluster',
    name: 'k8s-cluster.log',
    size: 2490,
    type: 'infra',
    lines: [
      { ts: '2026-04-22T08:15:22.002Z', level: 'INFO',  msg: 'scheduler assigned pod orders-api-6b4 to node ip-10-4-2-181' },
      { ts: '2026-04-22T08:22:33.019Z', level: 'WARN',  msg: 'node ip-10-4-2-181 memory pressure: 91% (threshold 85%)' },
      { ts: '2026-04-22T08:22:44.021Z', level: 'ERROR', msg: 'pod auth-service-9a2 OOMKilled (limit 512Mi, usage 523Mi)' },
      { ts: '2026-04-22T08:22:51.188Z', level: 'ERROR', msg: 'pod auth-service-4b1 OOMKilled (limit 512Mi, usage 531Mi)' },
      { ts: '2026-04-22T08:23:02.441Z', level: 'WARN',  msg: 'kubelet evicting pod checkout-2x1 DiskPressure' },
      { ts: '2026-04-22T08:23:15.882Z', level: 'ERROR', msg: 'pod auth-service-7c3 OOMKilled (limit 512Mi, usage 548Mi)' },
      { ts: '2026-04-22T08:24:09.012Z', level: 'INFO',  msg: 'HPA scaling auth-service 3 → 6 replicas' },
      { ts: '2026-04-22T08:25:44.441Z', level: 'ERROR', msg: 'ImagePullBackOff pod billing-0a2: registry.internal/billing:1.8.2 not found' },
      { ts: '2026-04-22T08:26:18.881Z', level: 'ERROR', msg: 'CrashLoopBackOff pod api-gateway-7f8c, 3 restarts in 5m' },
      { ts: '2026-04-22T08:28:02.001Z', level: 'WARN',  msg: 'node ip-10-4-2-182 disk pressure: 89% (threshold 85%)' },
    ]
  },
];

// Pre-populated knowledge base — 3 patterns
window.INITIAL_KB = {
  database_logs: {
    patterns: [
      {
        id: 'P-001',
        title: 'Connection pool exhaustion after deploy',
        description: 'Postgres connection pool reaches capacity within minutes of a rolling deploy; queries queue and time out at the 5s client limit.',
        keywords: ['connection pool', 'exhausted', 'timeout', 'pool at capacity'],
        frequency: 14,
        confidence: 0.92,
        category: 'database_logs',
        first_seen: '2026-03-14',
        last_seen: '2026-04-19',
        source_files: ['orders-db.log', 'billing-db.log'],
        examples: [
          'connection pool at capacity: 200/200 active, 47 waiting',
          'connection timeout after 5000ms (pool exhausted)',
        ],
        fix: 'Raise pool ceiling or stagger rolling deploy windows. Verify PgBouncer transaction pooling is active; add `statement_timeout = 4500ms` server-side so the DB releases the connection before the client gives up.',
        human_intervention: {
          required: true,
          owner: 'DBRE · on-call',
          severity: 'P2',
          runbook: 'Drain writer node, bounce PgBouncer, verify pool saturation via pg_stat_activity. Do NOT restart Postgres primary without SRE approval.',
          escalation: 'Escalate to DB platform lead if pool saturates again within 15 min of restart.',
          avg_resolution_min: 18,
        },
      },
    ],
  },
  api_logs: {
    patterns: [
      {
        id: 'P-002',
        title: 'Auth-service upstream timeout → circuit breaker open',
        description: 'Requests to /v2/token exceed 5s, the gateway circuit breaker opens, and every subsequent call fails fast for ~60s.',
        keywords: ['auth-service', 'timeout', 'circuit breaker', 'upstream'],
        frequency: 9,
        confidence: 0.87,
        category: 'api_logs',
        first_seen: '2026-02-28',
        last_seen: '2026-04-21',
        source_files: ['api-gateway.log', 'auth-service.log'],
        examples: [
          'upstream auth-service timeout after 5000ms on POST /v2/token',
          'circuit breaker OPEN for auth-service (5 failures / 10s)',
        ],
        fix: 'Confirm auth-service pod memory limits are adequate (see pattern P-003). Reduce gateway timeout to 3s and enable retry with jitter for the client.',
        related_patterns: ['P-003'],
        human_intervention: {
          required: true,
          owner: 'Platform SRE',
          severity: 'P1',
          runbook: 'Force-close the gateway circuit breaker after auth-service health is green. Check auth-service pod memory — this almost always co-occurs with P-003.',
          escalation: 'Page auth-service owner on call after two consecutive breaker-open events.',
          avg_resolution_min: 12,
        },
      },
    ],
  },
  infra_logs: {
    patterns: [
      {
        id: 'P-003',
        title: 'auth-service pods OOMKilled under load',
        description: 'auth-service pods exceed their 512Mi memory limit under sustained login load and are OOMKilled by the kubelet in clusters.',
        keywords: ['OOMKilled', 'memory', 'pod', 'auth-service', 'limit'],
        frequency: 6,
        confidence: 0.95,
        category: 'infra_logs',
        first_seen: '2026-03-02',
        last_seen: '2026-04-22',
        source_files: ['k8s-cluster.log'],
        examples: [
          'pod auth-service-9a2 OOMKilled (limit 512Mi, usage 523Mi)',
          'node ip-10-4-2-181 memory pressure: 91%',
        ],
        fix: 'Raise auth-service memory limit to 1Gi, investigate token cache growth. Add a HPA rule on memory as well as CPU.',
        related_patterns: ['P-002'],
        human_intervention: {
          required: false,
          owner: 'Kubernetes platform',
          severity: 'P2',
          runbook: 'HPA usually recovers within 90s. Only intervene if pods stay Pending — then cordon the node and evict manually.',
          escalation: 'If OOMKilled persists after memory limit bump, open a JIRA for auth-service owner to profile token cache.',
          avg_resolution_min: 6,
        },
      },
    ],
  },
  unknown_logs: {
    patterns: [],
  },
};

// Seed pre-existing scan sessions for the History tab.
window.SEED_HISTORY = [
  {
    when: '2026-04-17 14:22',
    filesScanned: 2,
    matched: 2, newPatterns: 0,
    fileNames: ['postgres-primary.log', 'postgres-replica.log'],
  },
  {
    when: '2026-04-12 09:41',
    filesScanned: 3,
    matched: 1, newPatterns: 1,
    fileNames: ['api-gateway.log', 'auth-service.log', 'billing.log'],
  },
  {
    when: '2026-04-05 16:08',
    filesScanned: 1,
    matched: 0, newPatterns: 1,
    fileNames: ['kubelet.log'],
  },
];

// Seed one previously-applied fix so the feature is visible in History / KB.
(function seedAppliedFix() {
  const p = window.INITIAL_KB.database_logs.patterns.find(x => x.id === 'P-001');
  if (p) {
    p.applied_fix = {
      text: 'Raised PgBouncer pool size 120 → 200, set statement_timeout=4500ms, and staggered deploy windows by region. No recurrence in the last two weeks.',
      author: 'DBRE · M. Keller',
      saved_at: '2026-04-17 15:10',
    };
  }
})();
