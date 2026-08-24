/**
 * workflow 模板：feature-slicing（新功能拆解）
 * domain: feature
 * 权威执行入口声明见 REQUIRED_REASON：新功能拆解需并行澄清需求、拆分用户
 * 故事并定义验收条件，属编排任务，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "feature-slicing",
  "description": "新功能拆解：需求澄清、用户故事切片拆分、验收条件定义三阶段，输出可独立交付的切片清单",
  "tags": ["feature", "slicing", "planning"],
  "args": {
    "feature": { "type": "string", "required": true, "description": "功能需求描述" }
  },
  "phases": [
    { "title": "clarify", "detail": "需求澄清" },
    { "title": "slice", "detail": "用户故事拆分" },
    { "title": "accept", "detail": "验收条件定义" }
  ]
}

const REQUIRED_REASON = '新功能拆解需要并行澄清需求、拆分用户故事并定义验收条件，属于多智能体编排任务：必须调用官方 workflow 工具执行。'

phase('clarify')
const clarified = await agent('澄清功能需求「' + args.feature + '」：边界、非目标、开放问题与假设。返回 JSON 对象。', { label: 'clarify', phase: 'clarify' })

phase('slice')
const slices = await agent('将功能「' + args.feature + '」拆为可独立交付的用户故事切片（含依赖顺序与估时）。返回 JSON 对象。', { label: 'slice', phase: 'slice' })

phase('accept')
const outputs = [clarified, slices, accept].filter(Boolean)
log('输出 ' + outputs.length + '/3 个阶段的解析结果')
return { "status": outputs.length === 3 ? "ok" : "partial", "clarified": clarified, "slices": slices, "accept": accept }