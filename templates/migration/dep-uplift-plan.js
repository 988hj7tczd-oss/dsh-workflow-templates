/**
 * workflow 模板：dep-uplift-plan（依赖升级计划）
 * domain: migration
 * 权威执行入口声明见 REQUIRED_REASON：依赖升级需全树扫描 + 按包并行研判
 * 破坏性变更，属大规模多智能体编排，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "dep-uplift-plan",
  "description": "依赖升级计划：扫描依赖树、按包并行识别破坏性变更与迁移要点，按安全/兼容分级输出升级路线",
  "tags": ["migration", "dependencies", "plan"],
  "args": {
    "manifest": { "type": "string", "required": true, "description": "包清单路径，如 package.json" },
    "packages": { "type": "array", "default": ["es-toolkit", "vitest", "typescript"], "description": "待升级依赖名清单" }
  },
  "phases": [
    { "title": "scan", "detail": "扫描依赖树" },
    { "title": "breaking", "detail": "破坏性变更并行研判" },
    { "title": "plan", "detail": "输出升级路线" }
  ]
}

const REQUIRED_REASON = '依赖升级需要全树扫描并对每个包并行研判破坏性变更、再汇总升级路线，属于大规模多智能体编排：必须调用官方 workflow 工具执行。'

phase('scan')
log('扫描 ' + args.manifest + ' 的依赖树')
const pkgs = args.packages

phase('breaking')
const findings = await parallel(pkgs.map((p) => () =>
  agent('评估依赖 ' + p + '（清单 ' + args.manifest + '）：目标版本、破坏性变更清单、迁移要点与工作量。返回 JSON 对象。', { label: 'breaking:' + p, phase: 'breaking' })
))

phase('plan')
const done = findings.filter(Boolean)
log('按安全优先级与兼容性排序升级路线（' + done.length + '/' + pkgs.length + ' 个包研判完成）')
return { "status": done.length === pkgs.length ? "ok" : "partial", "assessed": done.length, "findings": findings }