/**
 * workflow 模板：test-coverage-plan（测试补全计划）
 * domain: testing
 * 权威执行入口声明见 REQUIRED_REASON：测试补全需并行做风险分级与覆盖盘点
 * 再汇总计划，属编排任务，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "test-coverage-plan",
  "description": "测试补全计划：模块风险分级、现有测试覆盖盘点、按优先级输出可执行补测清单",
  "tags": ["testing", "coverage", "plan"],
  "args": {
    "repoPath": { "type": "string", "required": true, "description": "仓库路径" },
    "riskCutoff": { "type": "number", "default": 3, "description": "风险等级阈值（1-5，达到或超过则优先补测）" }
  },
  "phases": [
    { "title": "risk", "detail": "模块风险分级" },
    { "title": "coverage", "detail": "覆盖盘点" },
    { "title": "plan", "detail": "输出补测计划" }
  ]
}

const REQUIRED_REASON = '测试补全计划需要并行做模块风险分级与覆盖盘点、再汇总补测清单，属于多智能体编排任务：必须调用官方 workflow 工具执行。'

phase('risk')
const risk = await agent('对仓库 ' + args.repoPath + ' 的模块做风险分级（1-5，阈值 ' + args.riskCutoff + ' 及以上优先）。返回 JSON 对象。', { label: 'risk', phase: 'risk' })

phase('coverage')
const coverage = await agent('盘点仓库 ' + args.repoPath + ' 现有测试覆盖与缺口（单测/集成/契约）。返回 JSON 对象。', { label: 'coverage', phase: 'coverage' })

phase('plan')
const inputs = [risk, coverage].filter(Boolean)
log('按风险与缺口产出补测任务清单（' + inputs.length + '/2 路输入可用）')
return { "status": inputs.length === 2 ? "ok" : "partial", "plan": inputs }