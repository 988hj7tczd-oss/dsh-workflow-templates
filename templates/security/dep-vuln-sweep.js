/**
 * workflow 模板：dep-vuln-sweep（依赖漏洞扫描编排）
 * domain: security
 * 权威执行入口声明见 REQUIRED_REASON：漏洞台账需按依赖并行核查 CVE 与修复
 * 版本并分级，属多智能体编排，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "dep-vuln-sweep",
  "description": "依赖漏洞扫描编排：按依赖并行核查已知 CVE/受影响版本/修复版本，按严重度输出漏洞台账（模板为占位骨架，未内置与 dsh-dep-vuln-scan 的联通）",
  "tags": ["security", "dependencies", "vulnerability"],
  "args": {
    "manifest": { "type": "string", "required": true, "description": "锁定清单路径，如 package-lock.json" },
    "deps": { "type": "array", "default": ["axios", "lodash", "minimist"], "description": "待核查依赖名清单" },
    "severity": { "type": "string", "default": "high", "description": "最低关注级别（critical/high/medium/low）" }
  },
  "phases": [
    { "title": "enumerate", "detail": "锁定依赖清单" },
    { "title": "sweep", "detail": "并行漏洞核查" },
    { "title": "triage", "detail": "分级输出台账" }
  ]
}

const REQUIRED_REASON = '漏洞台账需要按依赖并行核查 CVE、受影响/修复版本并分级研判，属于大规模多智能体编排：必须调用官方 workflow 工具执行。'

phase('enumerate')
log('枚举 ' + args.manifest + ' 中的关键依赖')
const deps = args.deps

phase('sweep')
const sweeps = await parallel(deps.map((d) => () =>
  agent('核查依赖 ' + d + '（锁定清单 ' + args.manifest + '）：已知 CVE、受影响版本、修复版本、绕过/缓解措施。返回 JSON 对象。', { label: 'sweep:' + d, phase: 'sweep' })
))

phase('triage')
const findings = sweeps.filter(Boolean).flatMap((s) => (s && Array.isArray(s.advisories) ? s.advisories : []))
log('核查 ' + deps.length + ' 个依赖，累计 ' + findings.length + ' 条漏洞记录（最低级别 ' + args.severity + '）')
return { "status": "ok", "scannedDeps": deps.length, "advisoryCount": findings.length, "advisories": findings }