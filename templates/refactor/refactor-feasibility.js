/**
 * workflow 模板：refactor-feasibility（重构可行性评估）
 * domain: refactor
 * 权威执行入口声明见 REQUIRED_REASON：重构可行性需并行评估目标形态与影响面
 * 再下结论，属编排任务，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "refactor-feasibility",
  "description": "重构可行性评估：目标形态与收益、依赖影响面与风险、工作量三路并行，输出可行/慎行/不可行结论",
  "tags": ["refactor", "feasibility", "assessment"],
  "args": {
    "target": { "type": "string", "required": true, "description": "重构目标描述（如：把模块 A 迁移到新架构）" },
    "repoPath": { "type": "string", "required": true, "description": "仓库路径" }
  },
  "phases": [
    { "title": "shape", "detail": "目标形态评估" },
    { "title": "impact", "detail": "影响面评估" },
    { "title": "verdict", "detail": "可行性结论" }
  ]
}

const REQUIRED_REASON = '重构可行性需要并行评估目标形态、依赖影响面与风险后再给出结论，属于多智能体编排任务：必须调用官方 workflow 工具执行。'

phase('shape')
const shape = await agent('评估重构目标「' + args.target + '」（仓库 ' + args.repoPath + '）的目标形态、收益与预期产出。返回 JSON 对象。', { label: 'shape', phase: 'shape' })

phase('impact')
const impact = await agent('评估「' + args.target + '」的依赖影响面、风险点、兼容策略与工作量。返回 JSON 对象。', { label: 'impact', phase: 'impact' })

phase('verdict')
const inputs = [shape, impact].filter(Boolean)
log('综合目标形态与影响面给出可行性结论（' + inputs.length + '/2 路输入可用）')
return { "status": inputs.length === 2 ? "ok" : "partial", "shape": shape, "impact": impact }