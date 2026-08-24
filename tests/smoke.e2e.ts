/**
 * dsh-workflow-templates 离线冒烟测试（纯 Node，不依赖 DSH 运行时与 node_modules）。
 *
 * 覆盖 PROMPT.md 验收标准：
 *  ① 全部模板通过静态校验（meta 完整 / 钩子合法 / return 表达式合法 / args 可序列化）
 *     ——逐模板断言，且要求零错误、零警告；另含校验器对齐回归
 *     （官方合法计算型 return 不误报；赋值型 return / 缺 tags / 缺 REQUIRED_REASON
 *     各按预期报 E10 / W-TAGS / W-REASON）；
 *  ② wf_template_list 按领域过滤正确、search 关键词命中 tags/描述；
 *  ③ 至少 pr-deep-review 产出合法 workflow 起点（meta/script/args 三参数，
 *     整体可 JSON 序列化、meta 含 name+description、script 全文通过校验）；
 *  ④ INDEX.md 与模板目录一一对应（测试断言）；
 *  ⑤ 使用边界说明放在 README（本测试同时断言 run 起点渲染包含边界文案）。
 *
 * 运行：node --import tsx tests/smoke.e2e.ts
 *   （或用仓库内 tsx：<root>/node_modules/.bin/tsx tests/smoke.e2e.ts）
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { filterCatalog, knownDomains, loadCatalogSync, searchCatalog } from '../src/lib/catalog.ts'
import { buildRunPayload, renderListMarkdown, renderRunMarkdown } from '../src/lib/render.ts'
import { validateTemplateText } from '../src/lib/validate.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const templatesRoot = join(root, 'templates')

let failures = 0
const assert = (cond: boolean, message: string): void => {
  if (cond) {
    console.log('  ✓ ' + message)
  } else {
    failures += 1
    console.error('  ✗ ' + message)
  }
}

console.log('模板根目录：' + templatesRoot)
const catalog = loadCatalogSync(templatesRoot)
assert(!catalog.missing, '模板目录存在')
assert(catalog.entries.length >= 12, '模板总数 >= 12（实际 ' + catalog.entries.length + '）')

const names = catalog.entries.map((e) => e.name)
const required12 = [
  'pr-deep-review', 'legacy-assess', 'dep-uplift-plan', 'release-checklist',
  'data-clean-validate', 'weekly-report', 'dep-vuln-sweep', 'doc-bilingual-review',
  'api-contract-audit', 'test-coverage-plan', 'refactor-feasibility', 'feature-slicing',
]
assert(required12.every((n) => names.includes(n)), '首批 12 个必需模板全部存在')

console.log('\n①b 校验器对齐回归（E10 计算型 return / E4 tags / E6 REQUIRED_REASON）')
const fixture = (meta: Record<string, unknown>, head: string, tail: string): string =>
  'const META = ' + JSON.stringify(meta) + '\n' + head + tail
// 官方契约合法：字面量与计算型 return 均不得被误报（官方测试脚本就是 `return 1` /
// `return { report: x }` 这类运行期可序列化表达式）。
const vLiteral = validateTemplateText(fixture({ name: 'official-literal', description: 'd', tags: ['t'] }, '', 'return 1\n'), 'official-literal.js')
assert(vLiteral.ok && !vLiteral.issues.some((i) => i.code === 'E10'), '官方示例 `return 1` 通过校验（无 E10）')
const vComputed = validateTemplateText(fixture({ name: 'computed-return', description: 'd', tags: ['t'] }, 'const x = 1\n', 'return { report: x, count: [1, 2].length }\n'), 'computed-return.js')
assert(vComputed.ok && !vComputed.issues.some((i) => i.code === 'E10'), '计算型 return（引用已声明 const / 成员表达式）通过校验（无 E10）')
// E10 仍拦截结构非法形态：赋值 / 数组省略 / 括号不配平。
const vAssign = validateTemplateText(fixture({ name: 'assign-return', description: 'd', tags: ['t'] }, 'const y = 2\n', 'return y = 3\n'), 'assign-return.js')
assert(vAssign.issues.some((i) => i.severity === 'error' && i.code === 'E10'), '赋值型 return（`return y = 3`）报 E10')
const vElision = validateTemplateText(fixture({ name: 'elision-return', description: 'd', tags: ['t'] }, '', 'return [1,,2]\n'), 'elision-return.js')
assert(vElision.issues.some((i) => i.severity === 'error' && i.code === 'E10'), '数组省略元素（`return [1,,2]`）报 E10')
const vUnbalanced = validateTemplateText(fixture({ name: 'unbalanced-return', description: 'd', tags: ['t'] }, '', 'return { a: 1\n'), 'unbalanced-return.js')
assert(vUnbalanced.issues.some((i) => i.severity === 'error' && i.code === 'E10'), '括号不配平的 return 报 E10')
// E4：tags 是插件扩展字段，缺失降级为警告而非 error。
const vNoTags = validateTemplateText(fixture({ name: 'no-tags', description: 'd' }, 'const REQUIRED_REASON = "r"\n', 'return { ok: 1 }\n'), 'no-tags.js')
assert(vNoTags.ok && vNoTags.issues.some((i) => i.code === 'W-TAGS'), 'META.tags 缺失 → W-TAGS 警告（非 error）')
// E6：REQUIRED_REASON 是插件扩展字段，缺失降级为警告而非 error。
const vNoReason = validateTemplateText(fixture({ name: 'no-reason', description: 'd', tags: ['t'] }, '', 'return { ok: 1 }\n'), 'no-reason.js')
assert(vNoReason.ok && vNoReason.issues.some((i) => i.code === 'W-REASON'), 'REQUIRED_REASON 缺失 → W-REASON 警告（非 error）')
console.log('\n① 逐模板静态校验（零错误 + 零警告）')
for (const e of catalog.entries) {
  const v = validateTemplateText(e.body, e.name + '.js')
  const detail = v.issues.map((i) => `${i.severity}:${i.code}:${i.message}`).join(' | ')
  assert(v.ok && v.issues.length === 0, `validate ${e.relPath}${v.ok && v.issues.length === 0 ? '' : '  —— ' + detail}`)
  assert(e.issues.length === 0, `loadCatalog 附带 issues 为空（${e.relPath}）`)
}

console.log('\n② 领域过滤与关键词搜索')
const review = filterCatalog(catalog.entries, { domain: 'code-review' })
assert(review.length >= 1 && review.every((e) => e.domain === 'code-review'), 'wf_template_list 按 domain=code-review 过滤正确')
assert(review.some((e) => e.name === 'pr-deep-review'), 'code-review 领域含 pr-deep-review')
const byTag = filterCatalog(catalog.entries, { tag: 'parallel' })
assert(byTag.length >= 1 && byTag.every((e) => (e.meta.tags ?? []).includes('parallel')), 'wf_template_list 按 tag=parallel 过滤正确')
const sDesc = searchCatalog(catalog.entries, '漏洞')
assert(sDesc.some((m) => m.entry.name === 'dep-vuln-sweep' && m.matchedBy.includes('description')), 'search 命中描述（漏洞 → dep-vuln-sweep）')
const sTags = searchCatalog(catalog.entries, 'vulnerability')
assert(sTags.some((m) => m.entry.name === 'dep-vuln-sweep' && m.matchedBy.includes('tags')), 'search 命中 tags（vulnerability → dep-vuln-sweep）')
const sName = searchCatalog(catalog.entries, 'pr')
assert(sName.length >= 1 && sName[0]?.entry.name === 'pr-deep-review', 'search 命中 name 且按相关度排首位（pr → pr-deep-review）')
const sScope = searchCatalog(catalog.entries, '漏洞', 'security')
assert(sScope.length >= 1 && sScope.every((m) => m.entry.domain === 'security'), 'search 支持 domain 收窄')
const listMarkdown = renderListMarkdown(review, knownDomains(catalog.entries), { domain: 'code-review' })
assert(listMarkdown.includes('pr-deep-review') && listMarkdown.includes('code-review'), 'list 渲染 markdown 含名称与领域')

console.log('\n③ pr-deep-review 产出合法 workflow 起点（meta/script/args 三参数）')
const pr = catalog.entries.find((e) => e.name === 'pr-deep-review')
assert(pr !== undefined, '找到 pr-deep-review')
const payload = buildRunPayload(pr!, {})
assert(typeof payload.meta.name === 'string' && payload.meta.name === 'pr-deep-review', 'meta.name 合法')
assert(typeof payload.meta.description === 'string' && payload.meta.description !== '', 'meta.description 合法')
assert(typeof payload.script === 'string' && payload.script.length > 0, 'script 为完整正文')
assert(payload.script.includes('META') && payload.script.includes('const REQUIRED_REASON'), 'script 含 META 与 REQUIRED_REASON')
assert(typeof payload.args === 'object' && payload.args !== null, 'args 为 JSON 对象')
let serializable = true
try { JSON.stringify(payload) } catch { serializable = false }
assert(serializable, 'meta/script/args 整体可 JSON 序列化（meta 仅含官方允许键，tags 经官方 schema additionalProperties 透传）')
assert(payload.missingRequired.includes('prUrl'), '必填参数 prUrl 被标记为未填充')
const filled = buildRunPayload(pr!, { prUrl: 'https://github.com/x/y/pull/1', reviewers: 3 })
assert(filled.args.prUrl === 'https://github.com/x/y/pull/1' && filled.args.reviewers === 3 && filled.missingRequired.length === 0, 'args 填充后 missingRequired 为空')
const runMd = renderRunMarkdown(pr!, filled, { visible: true, workflowToolName: 'workflow' })
assert(runMd.includes('meta（JSON）') && runMd.includes('script（模板全文') && runMd.includes('args（JSON'), 'run 起点渲染包含三参数区块')
assert(runMd.includes('权威执行入口声明'), 'run 起点渲染包含权威执行入口声明')
assert(runMd.includes('不绕过该边界'), 'run 起点渲染包含使用边界（模板库不绕过 workflow 工具）')
const runMdHidden = renderRunMarkdown(pr!, filled, { visible: false, workflowToolName: 'workflow' })
assert(runMdHidden.includes('工具未启用'), 'workflow 工具不可见时给出"工具未启用"提示')

console.log('\n④ INDEX.md 与模板目录一一对应')
const indexPath = join(templatesRoot, 'INDEX.md')
let indexText = ''
try { indexText = readFileSync(indexPath, 'utf8') } catch { /* 下方断言处理 */ }
const indexRows = new Set<string>()
for (const line of indexText.split('\n')) {
  const m = line.match(/^\|\s*`?([a-z0-9-]+)`?\s*\|\s*([a-z0-9-]+)\s*\|\s*([^|`\s]+\.js)\s*\|/)
  if (m) indexRows.add(`${m[1]}::${m[2]}::${m[3]}`)
}
const diskRows = new Set(catalog.entries.map((e) => `${e.name}::${e.domain}::${e.relPath}`))
const missingInIndex = [...diskRows].filter((r) => !indexRows.has(r))
const extraInIndex = [...indexRows].filter((r) => !diskRows.has(r))
assert(indexRows.size === diskRows.size && missingInIndex.length === 0 && extraInIndex.length === 0,
  `INDEX.md 与磁盘一一对应（${diskRows.size} 条；INDEX 缺 ${missingInIndex.length}、多 ${extraInIndex.length}）`)

console.log('\n⑤ README 使用边界（静态断言）')
const readme = readFileSync(join(root, 'README.md'), 'utf8')
assert(readme.includes('显式要求') && readme.includes('workflow'), 'README 写明 workflow 工具使用边界（仅显式要求时用）')

console.log('\n' + (failures === 0 ? '全部断言通过 ✔' : `存在 ${failures} 处失败 ✘`))
process.exitCode = failures === 0 ? 0 : 1