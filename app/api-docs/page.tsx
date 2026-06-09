export default function ApiDocsPage() {
  const base = 'https://your-domain.com'

  const endpoints = [
    {
      method: 'POST',
      path: '/api/v1/cases/submit',
      also: '/api/process-application',
      description: 'Submit a housing arrears rescheduling case for AI processing via SADDAD',
      roles: ['admin', 'officer'],
      request: `{
  "case_number": "SADDAD-2024-0001",
  "full_name": "Ahmed Al Mansouri",
  "emirates_id": "784-1985-1234567-1",
  "phone": "+971501234567",
  "arrears_amount": 45000,
  "monthly_salary": 12000,
  "monthly_expenses": 4500,
  "reschedule_reason": "other",
  "months_in_arrears": 3,
  "car_loan_payment": 0,
  "personal_loan_payment": 0,
  "other_obligations": 0,
  "documents": ["salary_slip", "bank_statement"]
}`,
      response: `{
  "success": true,
  "version": "v1",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "data": {
    "caseId": "SADDAD-2024-0001",
    "queuePosition": 1,
    "message": "Case queued successfully"
  }
}`,
    },
    {
      method: 'GET',
      path: '/api/v1/cases/:id/status',
      also: '/api/case-status/:id',
      description: 'Poll the processing status of a submitted case with live agent step updates',
      roles: ['admin', 'officer', 'readonly'],
      request: null,
      response: `{
  "success": true,
  "version": "v1",
  "timestamp": "2024-01-15T10:30:05.000Z",
  "data": {
    "caseNumber": "SADDAD-2024-0001",
    "status": "completed",
    "agentSteps": [
      { "agentName": "risk_forecaster", "status": "done", "durationMs": 45 },
      { "agentName": "rules_agent", "status": "done", "durationMs": 3400 }
    ],
    "decision": {
      "outcome": "approved",
      "monthlyPayment": 750,
      "durationMonths": 60,
      "rationale": "The applicant demonstrates an expense ratio of 37.5%...",
      "rationaleAr": "يُظهر مقدم الطلب نسبة نفقات تبلغ 37.5%...",
      "riskLevel": "LOW",
      "consistencyScore": 85,
      "similarCasesFound": 3,
      "fairnessNote": "3/3 comparable cases received same decision"
    },
    "processingTimeMs": 8200,
    "queuePosition": null
  }
}`,
    },
    {
      method: 'GET',
      path: '/api/v1/dashboard/stats',
      also: '/api/dashboard',
      description: 'Retrieve aggregate stats, recent cases, and live queue metrics',
      roles: ['admin', 'officer', 'readonly'],
      request: null,
      response: `{
  "success": true,
  "version": "v1",
  "data": {
    "cases": [ { "case_number": "SADDAD-2024-0001", "status": "approved", ... } ],
    "stats": {
      "total": 42, "approved": 28, "rejected": 8, "escalated": 6
    },
    "queue": {
      "queued": 2, "processing": 1,
      "avgProcessingMs": 8400, "longestWaitMs": 1200
    }
  }
}`,
    },
  ]

  const consumers = [
    { role: 'admin', name: 'MOEI Admin Portal', access: 'Full access — submit, read, dashboard', envVar: 'API_KEY_ADMIN' },
    { role: 'officer', name: 'Officer Dashboard', access: 'Submit + read status', envVar: 'API_KEY_OFFICER' },
    { role: 'readonly', name: 'Analytics Consumer', access: 'Dashboard stats only', envVar: 'API_KEY_READONLY' },
  ]

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 bg-blue-900/30 border border-blue-700/50 rounded-full px-4 py-2 mb-4">
            <span className="text-blue-300 text-sm font-medium">وزارة الطاقة والبنية التحتية</span>
          </div>
          <h1 className="text-4xl font-bold mb-3">SADDAD Platform API</h1>
          <p className="text-slate-400 text-lg max-w-2xl">
            AI-powered housing arrears rescheduling platform for the UAE Ministry of Energy and
            Infrastructure. Processes cases in seconds using an 11-agent parallel pipeline with
            fairness validation and bilingual AI rationale.
          </p>
          <div className="flex gap-4 mt-4 text-sm text-slate-500">
            <span>Version: v1</span>
            <span>·</span>
            <span>Base URL: <code className="text-slate-300">{base}</code></span>
            <span>·</span>
            <span>Auth: <code className="text-slate-300">x-api-key</code> header</span>
          </div>
        </div>

        {/* Architecture */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-10">
          <h2 className="text-xl font-semibold mb-3">11-Agent Pipeline Architecture</h2>
          <p className="text-slate-400 text-sm mb-4">
            Each submitted case is processed by 11 specialized agents running in sequential groups,
            with document/database and notification/audit work executing in parallel for throughput.
          </p>
          <div className="grid grid-cols-3 gap-3 text-xs">
            {[
              { group: 'Group 1', agents: ['🔮 Risk Forecaster'], color: 'text-purple-400' },
              { group: 'Group 2 ∥', agents: ['📄 Document Agent', '🗄️ DB Fetch'], color: 'text-blue-400' },
              { group: 'Group 3', agents: ['📊 Financial Analysis'], color: 'text-cyan-400' },
              { group: 'Group 4', agents: ['⚖️ Rules Engine + AI'], color: 'text-yellow-400' },
              { group: 'Group 5', agents: ['🤝 Fairness Check'], color: 'text-emerald-400' },
              { group: 'Group 6 ∥', agents: ['📱 Communication', '📋 Escalation & Audit'], color: 'text-green-400' },
            ].map((g, i) => (
              <div key={i} className="bg-slate-900/60 rounded-xl p-3">
                <div className={`font-medium mb-2 ${g.color}`}>{g.group}</div>
                {g.agents.map(a => (
                  <div key={a} className="text-slate-400 mb-1">{a}</div>
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Governance rules */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-10">
          <h2 className="text-xl font-semibold mb-3">Governance Rules (G-00 to G-06)</h2>
          <p className="text-slate-400 text-sm mb-4">
            Rules are evaluated in order. First failing rule determines outcome. A duplicate active application is rejected outright; the total salary deduction must stay within 20% of income, and arrears must clear within the remaining loan period.
          </p>
          <div className="space-y-2 text-xs">
            {[
              { id: 'G-00', condition: 'No existing active rescheduling application for this beneficiary (Brief Rule 3)', action: 'REJECT if duplicate', color: 'text-red-400' },
              { id: 'G-01', condition: 'Recent salary certificate (or notarised non-work letter) must be present', action: 'REJECT if missing', color: 'text-red-400' },
              { id: 'G-02', condition: 'Salary certificate must be issued within the last 30 days', action: 'ESCALATE if stale', color: 'text-yellow-400' },
              { id: 'G-03', condition: 'Total salary deduction (existing installment + arrears premium) must not exceed 20% of income', action: 'ESCALATE if no headroom', color: 'text-yellow-400' },
              { id: 'G-04', condition: 'Arrears premium must clear arrears within the remaining/original loan repayment period', action: 'ESCALATE if exceeded', color: 'text-yellow-400' },
              { id: 'G-05', condition: 'No previous rescheduling default / intentional negligence on record', action: 'ESCALATE if found', color: 'text-yellow-400' },
              { id: 'G-06', condition: 'Priority / hardship beneficiaries (widow, orphan, senior, person of determination)', action: 'ESCALATE to fast-track', color: 'text-yellow-400' },
            ].map(r => (
              <div key={r.id} className="flex items-center gap-3 bg-slate-900/40 rounded-lg px-3 py-2">
                <code className="text-slate-400 w-10 flex-shrink-0">{r.id}</code>
                <span className="text-slate-300 flex-1">{r.condition}</span>
                <span className={`font-bold flex-shrink-0 ${r.color}`}>{r.action}</span>
              </div>
            ))}
          </div>
          <p className="text-slate-500 text-xs mt-3">All rules pass → APPROVED with arrears premium using the available headroom under the 20% total-deduction ceiling.</p>
        </div>

        {/* Authentication */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Authentication</h2>
          <p className="text-slate-400 text-sm mb-4">
            All endpoints require an <code className="bg-slate-800 px-1 rounded text-slate-300">x-api-key</code> header.
            Three consumer roles are supported with different access levels.
          </p>
          <div className="space-y-3">
            {consumers.map(c => (
              <div key={c.role} className="bg-slate-800 border border-slate-700 rounded-xl p-4 flex items-start gap-4">
                <code className="bg-slate-900 text-slate-500 px-3 py-1.5 rounded text-sm font-mono flex-shrink-0 whitespace-nowrap">
                  ${c.envVar}
                </code>
                <div>
                  <div className="text-white font-medium text-sm">{c.name}</div>
                  <div className="text-slate-400 text-xs mt-0.5">{c.access}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 bg-slate-800/50 border border-slate-700 rounded-xl p-3 text-xs text-slate-400">
            API keys are set as environment variables on the deployment server. Contact your system administrator to obtain a key.
          </div>
        </div>

        {/* Endpoints */}
        <div className="mb-10">
          <h2 className="text-2xl font-semibold mb-4">Endpoints</h2>
          <div className="space-y-8">
            {endpoints.map((ep, i) => (
              <div key={i} className="bg-slate-800/50 border border-slate-700 rounded-2xl overflow-hidden">
                {/* Endpoint header */}
                <div className="px-6 py-4 border-b border-slate-700 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                        ep.method === 'POST' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'
                      }`}>
                        {ep.method}
                      </span>
                      <code className="text-white font-mono text-sm">{ep.path}</code>
                    </div>
                    {ep.also && (
                      <div className="text-xs text-slate-500 ml-12">
                        Also available at: <code className="text-slate-400">{ep.also}</code>
                      </div>
                    )}
                    <p className="text-slate-400 text-sm mt-2">{ep.description}</p>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    {ep.roles.map(r => (
                      <span key={r} className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-300">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 divide-x divide-slate-700">
                  {/* Request */}
                  <div className="p-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">
                      {ep.request ? 'Request Body (JSON)' : 'No Request Body'}
                    </div>
                    {ep.request && (
                      <pre className="text-xs text-slate-300 bg-slate-900/60 rounded-lg p-3 overflow-x-auto">
                        {ep.request}
                      </pre>
                    )}
                  </div>

                  {/* Response */}
                  <div className="p-4">
                    <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Response (JSON)</div>
                    <pre className="text-xs text-slate-300 bg-slate-900/60 rounded-lg p-3 overflow-x-auto">
                      {ep.response}
                    </pre>
                  </div>
                </div>

                {/* curl example */}
                <div className="px-4 pb-4 border-t border-slate-700/50 pt-4">
                  <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Example</div>
                  <pre className="text-xs text-green-400 bg-slate-900/60 rounded-lg p-3 overflow-x-auto">
                    {ep.method === 'POST'
                      ? `curl -X POST ${base}${ep.path} \\\n  -H "Content-Type: application/json" \\\n  -H "x-api-key: $YOUR_API_KEY" \\\n  -d '${ep.request?.split('\n').join(' ')}'`
                      : `curl ${base}${ep.path.replace(':id', 'SADDAD-2024-0001')} \\\n  -H "x-api-key: $YOUR_API_KEY"`}
                  </pre>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Response envelope */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-10">
          <h2 className="text-xl font-semibold mb-3">Standard Response Envelope</h2>
          <p className="text-slate-400 text-sm mb-4">All responses follow this structure.</p>
          <pre className="text-xs text-slate-300 bg-slate-900/60 rounded-lg p-4">
{`{
  "success": true | false,
  "version": "v1",
  "timestamp": "ISO 8601",
  "data": { ... },      // present on success
  "error": "...",       // present on failure
  "code": 400 | 401 | 500
}`}
          </pre>
        </div>

        {/* Footer */}
        <div className="text-center text-slate-600 text-sm">
          SADDAD · وزارة الطاقة والبنية التحتية · Ministry of Energy and Infrastructure
        </div>
      </div>
    </div>
  )
}
