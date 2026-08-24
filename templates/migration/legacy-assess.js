/**
 * workflow 模板：legacy-assess（遗留系统迁移评估）
 * domain: migration
 * 权威执行入口声明见 REQUIRED_REASON：遗留评估需按模块并行盘点与风险研判，
 * 属大规模多智能体编排，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "legacy-assess",
  "description": "遗留系统迁移评估：按模块并行盘点入口/依赖/测试与技术债，研判迁移风险，输出分优先级迁移路线图",
  "tags": ["migration", "legacy", "assess"],
  "args": {
    "repoPath": { "type": "string", "required": true, "description": "遗留仓库路径" },
    "modules": { "type": "array", "default": ["auth", "billing", "reporting"], "description": "待评估模块清单" }
  },
  "phases": [
    { "title": "inventory", "detail": "模块盘点" },
    { "title": "risk", "detail": "风险研判" },
    { "title": "roadmap", "detail": "迁移路线图" }
  ]
}

const REQUIRED_REASON = '遗留系统评估需要按模块并行盘点与风险研判、再汇总路线图，属于大规模多智能体编排：必须调用官方 workflow 工具执行，禁止 agent 手工代跑。'

phase('inventory')
const modules = args.modules
const inventories = await parallel(modules.map((m) => () =>
  agent('盘点模块 ' + m + '（仓库 ' + args.repoPath + '）：入口、依赖、测试覆盖、技术债。返回 JSON 对象，含 summary 字符串。', { label: 'inventory:' + m, phase: 'inventory' })
))

phase('risk')
const risks = await parallel(modules.map((m) => () =>
  agent('对模块 ' + m + '（仓库 ' + args.repoPath + '）做迁移风险研判：耦合度、隐藏依赖、回归面、建议顺序。返回 JSON 对象。', { label: 'risk:' + m, phase: 'risk' })
))

phase('roadmap')
log('汇总盘点与风险，输出迁移路线图')
return { "status": "ok", "assessedModules": modules.length, "inventories": inventories, "risks": risks }