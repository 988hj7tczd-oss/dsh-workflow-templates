/**
 * workflow 模板：release-checklist（发布前检查清单）
 * domain: release
 * 权威执行入口声明见 REQUIRED_REASON：发布门禁需并行核对多项检查并汇总，
 * 属编排任务，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "release-checklist",
  "description": "发布前检查清单编排：并行核对构建/测试/文档/回滚计划四道门禁，输出发布门禁结论",
  "tags": ["release", "checklist", "quality"],
  "args": {
    "version": { "type": "string", "required": true, "description": "目标版本号" },
    "branch": { "type": "string", "default": "release", "description": "发布分支" }
  },
  "phases": [
    { "title": "checks", "detail": "并行门禁核对" },
    { "title": "gate", "detail": "发布门禁汇总" }
  ]
}

const REQUIRED_REASON = '发布门禁需要并行核对多项检查并汇总结论，属于多智能体编排任务：必须调用官方 workflow 工具执行，保证检查互不干扰且结论可追溯。'

phase('checks')
const gate = ['build', 'test', 'docs', 'rollback-plan']
const results = await parallel(gate.map((g) => () =>
  agent('执行发布门禁项 ' + g + '：版本 ' + args.version + '、分支 ' + args.branch + '。返回 JSON 对象：{ "pass": boolean, "evidence": string }。', { label: 'gate:' + g, phase: 'checks' })
))

phase('gate')
const passed = results.filter(Boolean).filter((r) => r.pass === true).length
log('门禁通过 ' + passed + '/' + gate.length)
return {
  "status": passed === gate.length ? "ok" : "blocked",
  "passed": passed,
  "total": gate.length,
  "conclusion": results.map((r, i) => (r && r.pass === true ? '通过' : '未通过') + '：' + gate[i] + (r && r.evidence ? '（' + r.evidence + '）' : '')).join('；')
}