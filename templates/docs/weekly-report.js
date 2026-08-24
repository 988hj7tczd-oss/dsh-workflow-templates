/**
 * workflow 模板：weekly-report（周报编排）
 * domain: docs
 * 权威执行入口声明见 REQUIRED_REASON：周报需并行收集多条工作线进展并汇总，
 * 属编排任务，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "weekly-report",
  "description": "周报编排：并行收集各工作线进展/阻塞/下周计划，汇总为结构化周报 Markdown",
  "tags": ["docs", "report", "weekly"],
  "args": {
    "period": { "type": "string", "required": true, "description": "周报周期，如 2026-W34" },
    "lines": { "type": "array", "default": ["工程", "数据", "文档"], "description": "工作线名称列表" },
    "channels": { "type": "array", "default": ["git-log", "issue", "standup"], "description": "信息渠道列表" }
  },
  "phases": [
    { "title": "collect", "detail": "并行收集各工作线" },
    { "title": "compose", "detail": "汇总为周报" }
  ]
}

const REQUIRED_REASON = '周报需要并行收集多条工作线的进展、阻塞与计划再汇总成文，属于多智能体编排任务：必须调用官方 workflow 工具执行。'

phase('collect')
const lines = args.lines
const collected = await parallel(lines.map((l) => () =>
  agent('收集工作线「' + l + '」在 ' + args.period + ' 的进展、阻塞与下周计划，渠道：' + args.channels.join('、') + '。返回 JSON 对象。', { label: 'collect:' + l, phase: 'collect' })
))

phase('compose')
const okLines = collected.filter(Boolean)
log('汇总 ' + okLines.length + '/' + lines.length + ' 条工作线为结构化周报')
return { "status": okLines.length === 0 ? "no-data" : "ok", "lineCount": lines.length, "collected": okLines }