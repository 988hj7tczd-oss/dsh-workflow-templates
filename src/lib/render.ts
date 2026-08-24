/**
 * 面向模型的 markdown 渲染与 run 起点装配。
 * 所有渲染函数是纯函数（不读运行时/会话状态），可离线测试。
 */

import type { RunPayload, TemplateEntry, ValidationIssue } from '../types.ts'
import type { SearchMatch } from './catalog.ts'

/** 按 META.args 默认值 + 调用方提供值装配 args，并指出仍未填充的必填参数。 */
export function buildRunPayload(entry: TemplateEntry, provided?: Record<string, unknown>): RunPayload {
  const meta: RunPayload['meta'] = {
    name: entry.meta.name,
    description: entry.meta.description,
    tags: entry.meta.tags,
  }
  if (entry.meta.phases !== undefined) meta.phases = entry.meta.phases

  const args: Record<string, unknown> = {}
  const spec = entry.meta.args ?? {}
  for (const [key, item] of Object.entries(spec)) {
    if (item !== undefined && item !== null && item.default !== undefined) {
      args[key] = item.default
    }
  }
  if (provided !== undefined) {
    for (const [key, value] of Object.entries(provided)) args[key] = value
  }
  const missingRequired = Object.keys(spec).filter((key) => spec[key]?.required === true && args[key] === undefined)
  return { meta, script: entry.body, args, missingRequired }
}

function argsSummary(entry: TemplateEntry): string {
  const spec = entry.meta.args ?? {}
  const keys = Object.keys(spec)
  if (keys.length === 0) return '—'
  return keys
    .map((key) => {
      const item = spec[key]
      if (item === undefined || item === null) return `\`${key}\``
      const req = item.required === true ? '（必填）' : ''
      const def = item.default !== undefined ? `=${JSON.stringify(item.default)}` : ''
      const desc = item.description !== undefined && item.description !== '' ? ` ${item.description}` : ''
      return `\`${key}\`${req}${def}${desc}`
    })
    .join('；')
}

/** wf_template_list 的 markdown 目录。 */
export function renderListMarkdown(
  entries: TemplateEntry[],
  allDomains: string[],
  filter: { domain?: string; tag?: string },
): string {
  const head = [
    '# Workflow 模板目录',
    '',
    `共 **${entries.length}** 个模板${filter.domain !== undefined ? ` · 领域=**${filter.domain}**` : ''}${filter.tag !== undefined ? ` · 标签=**${filter.tag}**` : ''}`,
    '',
  ]
  if (entries.length === 0) {
    return [...head, `（无匹配模板。可用领域：${allDomains.join(' / ')}；也可不带过滤列出全部）`].join('\n')
  }
  const rows = entries.map((e) => `| \`${e.name}\` | ${e.domain} | ${argsSummary(e)} | ${e.meta.description} |`)
  return [
    ...head,
    '| 模板 | 领域 | 参数 | 适用场景 |',
    '|---|---|---|---|',
    ...rows,
    '',
    '> 获取某个模板的完整 workflow 起点（meta/script/args 三参数）：调用 `wf_template_run` 并传 `name`。',
    '> 模板是 workflow 编排脚本：使用边界见 README，仅在显式要求 workflow / 大规模多智能体编排时走官方 `workflow` 工具。',
  ].join('\n')
}

/** wf_template_search 的 markdown 结果。 */
export function renderSearchMarkdown(query: string, domain: string | undefined, matches: SearchMatch[]): string {
  const head = [
    `# 模板搜索：${query}`,
    '',
    `命中 **${matches.length}** 个模板${domain !== undefined ? `（领域=${domain}）` : ''}`,
    '',
  ]
  if (matches.length === 0) {
    return [...head, '未命中。试试其他关键词，或调用 `wf_template_list` 查看全部模板。'].join('\n')
  }
  const rows = matches.map(({ entry, matchedBy }, i) =>
    `| ${i + 1} | \`${entry.name}\` | ${entry.domain} | ${matchedBy.join('、')} | ${entry.meta.description} |`)
  return [...head, '| # | 模板 | 领域 | 命中依据 | 说明 |', '|---|---|---|---|---|', ...rows].join('\n')
}

/** wf_template_run 的"调起 workflow 工具的完整起点"。 */
export function renderRunMarkdown(
  entry: TemplateEntry,
  payload: RunPayload,
  opts: { visible: boolean; workflowToolName: string },
): string {
  const lines: string[] = []
  lines.push(`# workflow 模板起点：\`${entry.name}\`（${entry.domain}）`)
  lines.push('')
  lines.push('> **权威执行入口声明**：' + (entry.requiredReason || '（模板未声明 REQUIRED_REASON，请先修复）'))
  lines.push('> 模板库只产出起点，**不自动执行**——执行权在模型与你，以及官方 `workflow` 工具。')
  lines.push('')
  if (opts.visible) {
    lines.push(
      '✅ 当前会话可见 `workflow` 工具（注册名 `' + opts.workflowToolName + '`）。请在下一轮调用 **`' + opts.workflowToolName + '`** 工具，按下方三参数 meta / script / args 发起编排。',
    )
  } else {
    lines.push(
      `⚠️ **工具未启用**：当前会话不可见 \`${opts.workflowToolName}\` 工具（dsh-tool-workflow 插件未挂载，或它被作用域限制隐藏）。请先在组合中启用该工具，或在外部环境用官方 workflow 机制发起；本工具仍先产出起点供你保存。`,
    )
  }
  lines.push('')
  lines.push('### meta（JSON）')
  lines.push('```json')
  lines.push(JSON.stringify(payload.meta, null, 2))
  lines.push('```')
  lines.push('')
  lines.push('### script（模板全文 · JS）')
  lines.push('```js')
  lines.push(payload.script)
  lines.push('```')
  lines.push('')
  lines.push('### args（JSON，已按 META.args 默认值填充）')
  lines.push('```json')
  lines.push(JSON.stringify(payload.args, null, 2))
  lines.push('```')
  lines.push('')
  if (payload.missingRequired.length > 0) {
    lines.push(`> 尚未填写的必填参数：${payload.missingRequired.map((k) => `\`${k}\``).join('、')}——发起前请补全（本工具支持用 args 参数填充）。`)
    lines.push('')
  }
  lines.push('### 使用边界')
  lines.push('- 仅当模型/用户**显式要求** workflow 或大规模多智能体编排时使用官方 `workflow` 工具；一两处委派直接用普通 subagent。')
  lines.push('- 本模板库不绕过该边界：模板是"引导素材"，`wf_template_run` 只产出起点。')
  return lines.join('\n')
}

/** wf_template_validate 的逐条诊断结果（解析失败逐条报错）。 */
export function renderValidateMarkdown(
  results: Array<{ name: string; domain: string; ok: boolean; issues: ValidationIssue[] }>,
): string {
  const errors = results.reduce((n, r) => n + r.issues.filter((i) => i.severity === 'error').length, 0)
  const warnings = results.reduce((n, r) => n + r.issues.filter((i) => i.severity === 'warning').length, 0)
  const lines: string[] = [
    '# wf_template_validate 结果',
    '',
    `共检查 **${results.length}** 个模板：${errors} 错误 / ${warnings} 警告`,
    '',
  ]
  for (const r of results) {
    if (r.ok) {
      lines.push(`- ✅ \`${r.name}\`（${r.domain}）——meta 完整 / 钩子合法 / return 表达式合法 / REQUIRED_REASON 已声明${r.issues.length > 0 ? `（${r.issues.length} 条警告）` : ''}`)
      continue
    }
    lines.push(`- ❌ \`${r.name}\`（${r.domain}）——${r.issues.filter((i) => i.severity === 'error').length} 处错误：`)
    for (const i of r.issues) {
      lines.push(`  - [${i.severity === 'error' ? '✗' : '⚠'} ${i.code}] ${i.message}`)
    }
  }
  if (errors > 0) {
    lines.push('', '> 存在错误模板：run 起点仍可产出，但请先按上面逐条信息修复模板。')
  } else {
    lines.push('', '> 全部模板通过静态校验；INDEX.md 与磁盘模板的一致性由 tests/smoke.e2e.ts 断言。')
  }
  return lines.join('\n')
}