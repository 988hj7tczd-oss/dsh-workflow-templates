/**
 * workflow 模板：api-contract-audit（API 契约审计）
 * domain: api
 * 权威执行入口声明见 REQUIRED_REASON：契约审计需并行核对端点/语义/破坏性
 * 变更，属编排任务，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "api-contract-audit",
  "description": "API 契约审计：端点清单盘点、语义核对、对消费方的破坏性变更评估三路并行，输出契约审计报告",
  "tags": ["api", "contract", "audit"],
  "args": {
    "specPath": { "type": "string", "required": true, "description": "OpenAPI 或契约文件路径" },
    "consumers": { "type": "array", "default": ["web", "mobile"], "description": "已知消费方清单" }
  },
  "phases": [
    { "title": "inventory", "detail": "端点盘点" },
    { "title": "semantics", "detail": "语义核对" },
    { "title": "breaking", "detail": "破坏性变更评估" }
  ]
}

const REQUIRED_REASON = 'API 契约审计需要并行核对端点、语义与破坏性变更再汇总结论，属于多智能体编排任务：必须调用官方 workflow 工具执行。'

phase('inventory')
const inventory = await agent('盘点契约 ' + args.specPath + ' 的端点清单与公开面（版本、认证、限流）。返回 JSON 对象。', { label: 'inventory', phase: 'inventory' })

phase('semantics')
const semantics = await agent('核对契约 ' + args.specPath + ' 的语义：状态码、错误模型、幂等性与分页。返回 JSON 对象。', { label: 'semantics', phase: 'semantics' })

phase('breaking')
const breaking = await agent('评估契约 ' + args.specPath + ' 对消费方 ' + args.consumers.join('、') + ' 的破坏性变更与兼容策略。返回 JSON 对象。', { label: 'breaking', phase: 'breaking' })

const parts = [inventory, semantics, breaking].filter(Boolean)
return { "status": parts.length === 3 ? "ok" : "partial", "auditedFacets": parts.length, "inventory": inventory, "semantics": semantics, "breaking": breaking }