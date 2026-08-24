/**
 * 模板目录装载与查询：递归扫描 templates/ 下的 *.js，读取全文并做静态校验；
 * 提供领域/标签过滤与关键词搜索。零运行时依赖（纯 Node），供离线测试复用。
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative, sep } from 'node:path'
import type { LoadedCatalog, TemplateEntry, TemplateMeta, ValidationIssue } from '../types.ts'
import { extractMeta, extractRequiredReason } from './validate.ts'

/** 递归收集模板文件。 */
function collect(base: string, dir: string, out: TemplateEntry[]): void {
  const names = readdirSync(dir)
    .sort((a, b) => a.localeCompare(b))
    .filter((n) => n !== 'node_modules' && !n.startsWith('.'))
  for (const name of names) {
    const abs = join(dir, name)
    const st = statSync(abs)
    if (st.isDirectory()) {
      collect(base, abs, out)
      continue
    }
    if (!name.endsWith('.js')) continue
    const body = readFileSync(abs, 'utf8')
    const relPath = relative(base, abs).split(sep).join('/')
    const domain = relPath.split('/')[0] ?? '_'

    const issues: ValidationIssue[] = []
    const meta = parseMetaOrFallback(body, name, relPath, issues)
    const reason = parseReasonOrFallback(body, issues)
    out.push({
      name: meta.name,
      domain,
      file: abs,
      relPath,
      body,
      meta,
      requiredReason: reason,
      issues,
    })
  }
}

/** 解析 META；解析失败时给出占位 meta 并把 E1 错误并入 issues（工具仍可列出该模板）。 */
function parseMetaOrFallback(
  body: string,
  fileName: string,
  relPath: string,
  issues: ValidationIssue[],
): TemplateMeta {
  const res = extractMeta(body)
  if (res.ok) {
    const meta = res.value.meta
    // tags 是插件自有扩展（官方 meta 契约无此键）；缺省归一为空数组，
    // 保证过滤/搜索的不变量（校验器对缺失只发 W-TAGS 警告）。
    if (!Array.isArray(meta.tags)) meta.tags = []
    return meta
  }
  issues.push({ severity: 'error', code: 'E1', message: `${relPath}: ${res.reason}` })
  const base = fileName.endsWith('.js') ? fileName.slice(0, -3) : fileName
  return { name: base, description: `（元数据不可解析：${res.reason}）`, tags: [] }
}

/** 解析 REQUIRED_REASON；缺失时并入 W-REASON 警告并返回占位文案。 */
function parseReasonOrFallback(body: string, issues: ValidationIssue[]): string {
  const res = extractRequiredReason(body)
  if (res.ok) return res.reason
  issues.push({
    severity: 'warning',
    code: 'W-REASON',
    message: `REQUIRED_REASON 缺失或非法（可选扩展字段，官方 meta 契约无此键；缺失不影响合法性）：${res.reasonDetail ?? '未找到 `const REQUIRED_REASON = <string>`'}`,
  })
  return ''
}

/**
 * 装载模板目录。missing=true 表示根目录不存在（entries 为空）。
 */
export function loadCatalogSync(root: string): LoadedCatalog {
  if (!existsSync(root)) return { root, missing: true, entries: [] }
  const entries: TemplateEntry[] = []
  collect(root, root, entries)
  entries.sort((a, b) => a.relPath.localeCompare(b.relPath))
  return { root, missing: false, entries }
}

export interface CatalogFilter {
  domain?: string
  tag?: string
}

/** 按领域（精确）与标签（任一命中）过滤。 */
export function filterCatalog(entries: TemplateEntry[], filter: CatalogFilter): TemplateEntry[] {
  const domain = filter.domain?.trim().toLowerCase() ?? ''
  const tag = filter.tag?.trim().toLowerCase() ?? ''
  return entries.filter((e) => {
    if (domain !== '' && e.domain.toLowerCase() !== domain) return false
    if (tag !== '' && !(e.meta.tags ?? []).some((t) => t.toLowerCase() === tag)) return false
    return true
  })
}

export interface SearchMatch {
  entry: TemplateEntry
  /** 命中依据（name / tags / description / domain / args）。 */
  matchedBy: string[]
}

const MATCH_ORDER: Record<string, number> = { name: 0, tags: 1, domain: 2, args: 3, description: 4 }

/** 关键词搜索：对 name/tags/description/domain/args 键做不区分大小写的包含匹配。 */
export function searchCatalog(entries: TemplateEntry[], query: string, domain?: string): SearchMatch[] {
  const q = query.trim().toLowerCase()
  if (q === '') return []
  const scoped = domain !== undefined && domain.trim() !== ''
    ? filterCatalog(entries, { domain })
    : entries
  const matches: SearchMatch[] = []
  for (const entry of scoped) {
    const matchedBy: string[] = []
    if (entry.name.toLowerCase().includes(q)) matchedBy.push('name')
    if ((entry.meta.tags ?? []).some((t) => t.toLowerCase().includes(q))) matchedBy.push('tags')
    if (entry.meta.description.toLowerCase().includes(q)) matchedBy.push('description')
    if (entry.domain.toLowerCase().includes(q)) matchedBy.push('domain')
    if (Object.keys(entry.meta.args ?? {}).some((k) => k.toLowerCase().includes(q))) matchedBy.push('args')
    if (matchedBy.length > 0) matches.push({ entry, matchedBy })
  }
  matches.sort((a, b) => {
    const rank = (items: string[]): number => Math.min(...items.map((k) => MATCH_ORDER[k] ?? 9))
    const ra = rank(a.matchedBy)
    const rb = rank(b.matchedBy)
    if (ra !== rb) return ra - rb
    return a.entry.name.localeCompare(b.entry.name)
  })
  return matches
}

/** 全部领域（排序去重）。 */
export function knownDomains(entries: TemplateEntry[]): string[] {
  return [...new Set(entries.map((e) => e.domain))].sort((a, b) => a.localeCompare(b))
}

/** 模板文件名基础名（去掉 .js）。 */
export function templateBaseName(relPath: string): string {
  return basename(relPath).replace(/\.js$/, '')
}