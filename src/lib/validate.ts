/**
 * 模板静态校验核心：对每个模板文件做"文本级"契约检查，并给出逐条可读错误。
 *
 * 与官方 `workflow` 工具（tool-workflow）契约的关系（对齐而非更严格）：
 *  - **对齐**（与官方一致，未加严）：`name`/`description` 必填；`phases` 可选
 *    进度标注；脚本以 `return <表达式>` 结尾、运行期返回值 JSON 可序列化
 *    （官方接受 `return 1`、`return { report: x }` 等计算型返回值，本校验器
 *    只在结构层面做轻量检查，最终序列化由 workflow 引擎在运行期兜底）。
 *  - **插件自有扩展**（官方 meta 契约无这些字段，均为可选，缺失仅发警告）：
 *    `tags`（缺失 W-TAGS）、`args` 参数规格、`REQUIRED_REASON` 权威执行入口
 *    原因段（缺失 W-REASON）。这些扩展不会比官方更严格地拒绝合法脚本。
 *
 * 模板契约（见 README 与 INDEX.md）：
 *  1. 顶部 module 级常量 `META = { ... }`，为**严格 JSON 字面量**（键带双引号、
 *    无注释、无尾逗号；这是本插件的静态可校验写法，官方 meta 本身是 JSON 参数）；
 *  2. 可选 `const REQUIRED_REASON = '<原因段>'` —— 声明"必须走官方 workflow
 *    工具执行"的权威执行入口理由（对齐 claude-security 立场；缺失仅警告）；
 *  3. 脚本体只使用官方钩子 `agent/pipeline/parallel/phase/log` 与全局 `args`，
 *    不含 import/export/require 等模块语句；
 *  4. 结尾最后一条语句为 `return <表达式>` —— 轻量结构检查（非赋值语句、
 *    数组不省略元素、括号配平），运行期 JSON 序列化由官方引擎兜底。
 *
 * 本文件保持零运行时依赖（纯 Node），便于离线冒烟测试直接复用。
 */

import type { TemplateMeta, ValidationIssue, ValidationResult } from '../types.ts'

/* ------------------------------------------------------------------ *
 * 轻量代码扫描：把文本切成"代码 / 行注释 / 块注释 / 字符串"区域，
 * 后续所有匹配只发生在代码区域，避免字符串与注释里的假阳性。
 * ------------------------------------------------------------------ */

interface CodeSegment {
  start: number
  end: number
}

function codeSegments(text: string): CodeSegment[] {
  const segs: CodeSegment[] = []
  let state: 'code' | 'line' | 'block' | 'str' = 'code'
  let quote = ''
  let start = 0
  let i = 0
  const n = text.length
  const push = (end: number): void => {
    if (end > start) segs.push({ start, end })
  }
  while (i < n) {
    const ch = text[i] as string
    if (state === 'code') {
      if (ch === '/' && text[i + 1] === '/') {
        push(i); state = 'line'; i += 2; continue
      }
      if (ch === '/' && text[i + 1] === '*') {
        push(i); state = 'block'; i += 2; continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        push(i); quote = ch; state = 'str'; i += 1; continue
      }
      i += 1
    } else if (state === 'line') {
      if (ch === '\n') { state = 'code'; start = i + 1 }
      i += 1
    } else if (state === 'block') {
      if (ch === '*' && text[i + 1] === '/') { state = 'code'; start = i + 2; i += 2; continue }
      i += 1
    } else {
      if (ch === '\\') { i += 2; continue }
      if (ch === quote) { state = 'code'; start = i + 1 }
      i += 1
    }
  }
  if (state === 'code') push(n)
  return segs
}

function isInCode(segs: CodeSegment[], index: number): boolean {
  for (const s of segs) {
    if (index >= s.start && index < s.end) return true
  }
  return false
}

/** 在代码区域（跳过字符串与注释）内查找全部正则匹配。 */
function findCode(body: string, pattern: RegExp): Array<{ index: number; match: RegExpExecArray }> {
  const segs = codeSegments(body)
  const out: Array<{ index: number; match: RegExpExecArray }> = []
  const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g')
  let m: RegExpExecArray | null
  while ((m = re.exec(body)) !== null) {
    const index = m.index
    if (isInCode(segs, index)) out.push({ index, match: m })
    if (re.lastIndex <= index) re.lastIndex = index + 1 // 防空匹配死循环
  }
  return out
}

/* ------------------------------------------------------------------ *
 * 逐段提取：META / REQUIRED_REASON / return / 钩子 / args 引用
 * ------------------------------------------------------------------ */

interface ExtractedMeta {
  meta: TemplateMeta
  raw: string
}

/** 提取 `const META = { ... }`；要求整体是严格 JSON 字面量。 */
export function extractMeta(body: string): { ok: true; value: ExtractedMeta } | { ok: false; reason: string } {
  const found = findCode(body, /\bconst\s+META\s*=/)
  if (found.length === 0) return { ok: false, reason: '未找到模块级 `const META = { ... }`' }
  const start = body.indexOf('{', found[0]!.index)
  if (start === -1) return { ok: false, reason: 'META 赋值后缺少 `{`' }
  // 按严格 JSON 规则做括号配平（跳过双引号字符串与转义）。
  let depth = 0
  let i = start
  while (i < body.length) {
    const ch = body[i] as string
    if (ch === '"') {
      i += 1
      while (i < body.length && body[i] !== '"') {
        i += body[i] === '\\' ? 2 : 1
      }
      i += 1
      continue
    }
    if (ch === '{') depth += 1
    else if (ch === '}') {
      depth -= 1
      if (depth === 0) {
        const raw = body.slice(start, i + 1)
        try {
          return { ok: true, value: { meta: JSON.parse(raw) as TemplateMeta, raw } }
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error)
          return {
            ok: false,
            reason: `META 必须是严格 JSON 字面量（键加双引号、无注释、无尾逗号），JSON.parse 失败：${message}`,
          }
        }
      }
    }
    i += 1
  }
  return { ok: false, reason: 'META 的 `{` 与 `}` 未配平' }
}

/** 提取 `const REQUIRED_REASON = '<原因段>'`（单行字符串字面量）。 */
export function extractRequiredReason(
  body: string,
): { ok: true; reason: string; backtick: boolean } | { ok: false; reasonDetail?: string } {
  const found = findCode(body, /\bconst\s+REQUIRED_REASON\s*=\s*/)
  if (found.length === 0) return { ok: false }
  const i = body.indexOf('=', found[0]!.index) + 1
  let j = i
  while (j < body.length && /\s/.test(body[j] as string)) j += 1
  const ch = body[j]
  if (ch !== "'" && ch !== '"' && ch !== '`') {
    return { ok: false, reasonDetail: 'REQUIRED_REASON 必须是单行字符串字面量（单引号/双引号/反引号）' }
  }
  if (ch === '`') {
    return { ok: false, reasonDetail: 'REQUIRED_REASON 请使用普通单引号/双引号字符串（避免模板字符串歧义）' }
  }
  let out = ''
  let k = j + 1
  while (k < body.length) {
    const c = body[k] as string
    if (c === '\\') {
      out += body[k + 1] ?? ''
      k += 2
      continue
    }
    if (c === ch) break
    if (c === '\n') return { ok: false, reasonDetail: 'REQUIRED_REASON 必须为单行字符串字面量' }
    out += c
    k += 1
  }
  if (body[k] !== ch) return { ok: false, reasonDetail: 'REQUIRED_REASON 字符串未闭合' }
  if (out.trim() === '') return { ok: false, reasonDetail: 'REQUIRED_REASON 内容为空（请写明必须走 workflow 工具执行的原因）' }
  return { ok: true, reason: out, backtick: false }
}

/** 提取结尾 `return` 表达式（去掉尾部空白与一个可选分号）。 */
export function extractFinalReturn(body: string): { ok: true; tail: string } | { ok: false; reason: string } {
  const returns = findCode(body, /\breturn\b/)
  if (returns.length === 0) return { ok: false, reason: '结尾缺少 `return` 语句（模板必须以 `return <表达式>` 结尾）' }
  const last = returns[returns.length - 1]!
  let tail = body.slice(last.index + 'return'.length).trim()
  if (tail.endsWith(';')) tail = tail.slice(0, -1).trim()
  if (tail === '') return { ok: false, reason: '`return` 后面没有表达式' }
  return { ok: true, tail }
}

/**
 * 对 `return` 表达式做轻量结构检查（不要求是 JSON.parse 可解析的字面量——
 * 官方契约允许 `return 1`、`return { report: x }` 等计算型返回值，运行期由
 * workflow 引擎做 JSON 序列化兜底）。只拦截明显不可序列化或书写错误的形态：
 *  - 顶层赋值（如 `return x = 1`）——返回值必须是表达式而非语句；
 *  - 数组字面量省略元素（`[1,,2]` 含 undefined，运行期无法序列化）；
 *  - 括号 / 花括号 / 方括号不配平。
 * 返回问题描述；结构合法时返回 undefined。
 */
export function checkReturnExpressionStructural(tail: string): string | undefined {
  let depth = 0
  let i = 0
  const n = tail.length
  while (i < n) {
    const ch = tail[i] as string
    if (ch === '"' || ch === "'" || ch === '`') {
      i += 1
      while (i < n && tail[i] !== ch) {
        if (tail[i] === '\\') i += 1
        i += 1
      }
      i += 1
      continue
    }
    if (ch === '{' || ch === '[' || ch === '(') { depth += 1; i += 1; continue }
    if (ch === '}' || ch === ']' || ch === ')') {
      depth -= 1
      if (depth < 0) return 'return 表达式的括号不配平（存在多余的右括号）'
      i += 1
      continue
    }
    if (ch === '=') {
      const prev = tail[i - 1]
      const next = tail[i + 1]
      // 排除比较运算符（== != <= >=）与箭头函数（=>）中的 =；其余顶层裸 = 即赋值。
      const isCompareEq = prev === '=' || prev === '!' || prev === '<' || prev === '>'
      const isArrowEq = next === '>'
      if (depth === 0 && !isCompareEq && !isArrowEq) {
        return 'return 表达式不得是赋值语句（如 `return x = 1`）；请直接返回计算表达式'
      }
      i += 1
      continue
    }
    if (ch === ',' && tail[i + 1] === ',') {
      return 'return 表达式的数组字面量不得省略元素（`[1,,2]` 运行期含 undefined，无法 JSON 序列化）'
    }
    i += 1
  }
  if (depth !== 0) return 'return 表达式的括号不配平（存在未闭合的括号）'
  return undefined
}

/* ------------------------------------------------------------------ *
 * 校验器
 * ------------------------------------------------------------------ */

const KEYWORDS = new Set([
  'if', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return',
  'function', 'class', 'extends', 'super', 'this', 'new', 'delete', 'void', 'typeof',
  'instanceof', 'in', 'of', 'await', 'yield', 'throw', 'try', 'catch', 'finally', 'else',
  'var', 'let', 'const', 'async', 'get', 'set', 'static', 'type', 'interface', 'enum',
  'implements', 'keyof', 'as', 'satisfies', 'namespace', 'declare', 'abstract', 'readonly',
  'export', 'import', 'from', 'with', 'debugger',
])

/** 模板脚本允许的顶层裸调用：官方钩子 + 极少数标准库构造。 */
const ALLOWED_HOOKS = new Set(['agent', 'pipeline', 'parallel', 'phase', 'log'])
const ALLOWED_BARE_GLOBALS = new Set([
  'String', 'Number', 'Boolean', 'Array', 'Object', 'JSON', 'Math', 'Promise',
  'Symbol', 'BigInt', 'parseInt', 'parseFloat', 'isNaN', 'Date', 'undefined',
])

/**
 * 校验一个模板文件正文。返回 error / warning 两级问题，
 * `ok` 当且仅当没有 error。
 */
export function validateTemplateText(body: string, fileName: string): ValidationResult {
  const issues: ValidationIssue[] = []
  const err = (code: string, message: string): void => { issues.push({ severity: 'error', code, message }) }
  const warn = (code: string, message: string): void => { issues.push({ severity: 'warning', code, message }) }

  /* 1) META */
  const metaRes = extractMeta(body)
  if (!metaRes.ok) {
    err('E1', metaRes.reason)
    return { ok: false, issues } // 元数据不可解析时无继续校验基础
  }
  const meta = metaRes.value.meta
  const fileNameBase = fileName.endsWith('.js') ? fileName.slice(0, -3) : fileName
  if (typeof meta.name !== 'string' || meta.name.trim() === '') {
    err('E2', 'META.name 缺失或为空（必填非空字符串，对齐 workflow meta 契约）')
  } else if (meta.name !== fileNameBase) {
    warn('W-NAME', `META.name（${meta.name}）与文件名（${fileNameBase}）不一致`)
  }
  if (typeof meta.description !== 'string' || meta.description.trim() === '') {
    err('E3', 'META.description 缺失或为空（必填）')
  }
  if (meta.tags === undefined) {
    warn('W-TAGS', 'META.tags 缺失——tags 是本插件自有的扩展字段（官方 meta 契约无此键）；缺失时标签过滤/搜索能力受限，但不影响官方契约')
  } else if (!Array.isArray(meta.tags) || meta.tags.some((t) => typeof t !== 'string')) {
    err('E4', 'META.tags 必须是字符串数组')
  }
  if (meta.args !== undefined) {
    if (typeof meta.args !== 'object' || meta.args === null || Array.isArray(meta.args)) {
      err('E5', 'META.args 必须是对象（键为参数名）')
    } else {
      for (const [key, spec] of Object.entries(meta.args)) {
        if (typeof spec !== 'object' || spec === null) {
          warn('W-ARG', `META.args.${key} 必须是对象（type/required/default/description）`)
          continue
        }
        const s = spec as unknown as Record<string, unknown>
        if (typeof s.type !== 'string' || s.type === '') warn('W-ARG', `META.args.${key} 缺少 type 字符串`)
        if (typeof s.description !== 'string') warn('W-ARG', `META.args.${key} 缺少 description`)
        if (s.default !== undefined) {
          try { JSON.stringify(s.default) } catch { warn('W-ARG', `META.args.${key} 的 default 不可 JSON 序列化`) }
        }
      }
    }
  }

  /* 2) REQUIRED_REASON 原因段（权威执行入口声明）——插件自有扩展，缺失仅警告 */
  const reasonRes = extractRequiredReason(body)
  if (!reasonRes.ok) {
    warn('W-REASON', `REQUIRED_REASON 缺失或非法（可选扩展字段，官方 meta 契约无此键；缺失不影响合法性）：${reasonRes.reasonDetail ?? '未找到 `const REQUIRED_REASON = <string>`'}`)
  }

  /* 3) 禁止模块语句：export const meta / import / export / require */
  if (findCode(body, /\bexport\s+const\s+meta\b/).length > 0) {
    err('E7', '禁止 `export const meta` 语句（tool-workflow 契约：meta 作为工具参数传入）')
  }
  for (const { index, match } of findCode(body, /\b(import|export|require)\b/g)) {
    if (match[0] === 'export') {
      const tail = body.slice(index, index + 32)
      if (/^export\s+const\s+meta\b/.test(tail)) continue // 已由 E7 报告
    }
    err('E8', `模板正文不得包含模块语句 \`${match[0]}\`（模板是 workflow 工具的 script 正文，不是模块源文件）`)
  }

  /* 4) 只使用官方钩子与 args 全局 */
  const bareCalls = findCode(body, /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)
  for (const { match } of bareCalls) {
    const name = match[1] as string
    if (name === '') continue
    if (KEYWORDS.has(name) || ALLOWED_HOOKS.has(name) || ALLOWED_BARE_GLOBALS.has(name)) continue
    warn('W-HOOK', `未知顶层调用 \`${name}(…)\`——模板脚本只应使用官方钩子 agent/pipeline/parallel/phase/log 与全局 args`)
  }

  const declaredArgs = new Set(meta.args !== undefined ? Object.keys(meta.args) : [])
  for (const { match } of findCode(body, /\bargs\.([A-Za-z_$][\w$]*)/g)) {
    const key = match[1] as string
    if (key !== '' && !declaredArgs.has(key)) warn('W-ARG', `脚本读取了 \`args.${key}\`，但 META.args 未声明该键`)
  }

  /* 5) phase 声明与调用一致性（对齐 tool-workflow meta 的 phase 标注） */
  const declaredPhases = new Set((meta.phases ?? []).map((p) => p.title))
  const usedPhases = new Set<string>()
  for (const { match } of findCode(body, /\bphase\s*\(\s*(['"])([^'"]+)\1\s*\)/g)) {
    const title = match[2] as string
    usedPhases.add(title)
    if (meta.phases === undefined) {
      warn('W-PHASE', `脚本调用了 phase('${title}')，但 META.phases 未声明进度标注（建议声明以对齐 workflow meta）`)
    } else if (!declaredPhases.has(title)) {
      warn('W-PHASE', `phase('${title}') 未在 META.phases 中声明`)
    }
  }
  if (meta.phases !== undefined) {
    for (const p of meta.phases) {
      if (!usedPhases.has(p.title)) warn('W-PHASE', `META.phases 声明了 '${p.title}'，但脚本未调用 phase('${p.title}')`)
    }
  }

  /* 6) 结尾 return <表达式>：轻量结构检查（运行期 JSON 序列化由官方引擎兜底） */
  const ret = extractFinalReturn(body)
  if (!ret.ok) {
    err('E9', ret.reason)
  } else {
    const structural = checkReturnExpressionStructural(ret.tail)
    if (structural !== undefined) err('E10', structural)
  }

  /* 7) 异常形态防护 */
  if (findCode(body, /\$\{/).length > 0) {
    warn('W-STR', '发现 `${` 模板插值写法——建议普通字符串拼接，保持模板静态可校验')
  }

  return { ok: issues.every((i) => i.severity !== 'error'), issues }
}