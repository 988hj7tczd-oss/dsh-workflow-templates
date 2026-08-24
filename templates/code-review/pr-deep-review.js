/**
 * workflow 模板：pr-deep-review（多面 PR 评审）
 * domain: code-review
 * 权威执行入口声明见 REQUIRED_REASON：多面 PR 评审 = 并行多路评审 subagent
 * + 阶段汇总，属大规模多智能体编排，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "pr-deep-review",
  "description": "多面 PR 评审：并行多路 subagent（正确性/安全/风格/性能）审阅 + 阶段化汇总报告",
  "tags": ["code-review", "pr", "parallel", "review"],
  "args": {
    "prUrl": { "type": "string", "required": true, "description": "待评审 PR 链接" },
    "branch": { "type": "string", "default": "main", "description": "目标基线分支" },
    "reviewers": { "type": "number", "default": 4, "description": "并行评审视角数" }
  },
  "phases": [
    { "title": "assign", "detail": "拆解评审视角" },
    { "title": "review", "detail": "并行审阅" },
    { "title": "summarize", "detail": "汇总报告" }
  ]
}

const REQUIRED_REASON = '多面 PR 评审需要并行多路评审 subagent 与阶段汇总，属于大规模多智能体编排：必须调用官方 workflow 工具执行，禁止 agent 手工代跑（对齐 claude-security 的权威执行入口立场）。'

phase('assign')
const facets = [
  { name: 'correctness', prompt: '评审正确性：逻辑、竞态、边界条件' },
  { name: 'security', prompt: '评审安全：注入、鉴权、敏感信息' },
  { name: 'style', prompt: '评审风格与可维护性' },
  { name: 'performance', prompt: '评审性能与复杂度' },
]
const assigned = facets.slice(0, args.reviewers)

phase('review')
log('并行启动 ' + assigned.length + ' 路评审')
const reviews = await parallel(assigned.map((f) => () =>
  agent('请以 ' + f.name + ' 视角评审 PR ' + args.prUrl + '（基线分支 ' + args.branch + '）：' + f.prompt + '。返回 JSON 对象，含 findings 数组与 summary 字符串。', { label: 'review:' + f.name, phase: 'review' })
))

phase('summarize')
log('汇总全部评审视角')
const finished = reviews.filter(Boolean)
const findings = finished.flatMap((r) => (r && Array.isArray(r.findings) ? r.findings : []))
const summary = finished.length === 0
  ? '各评审视角均未返回可用结果：请核对 PR 链接与基线分支后重试。'
  : await agent('请基于以下各视角评审结果，按严重度去重聚合 findings，并输出 3-8 行评审结论 summary（markdown）：' + JSON.stringify(finished), { label: 'summarize', phase: 'summarize' })
return {
  "status": finished.length === 0 ? "no-reviews" : "ok",
  "agentsStarted": reviews.length,
  "findings": findings,
  "summary": summary
}