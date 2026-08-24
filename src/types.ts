/**
 * dsh-workflow-templates 共享类型。
 *
 * 本文件保持零运行时依赖（不 import 任何 @deepseek-ai/* 包），
 * 以便 tests/smoke.e2e.ts 在纯 Node 环境下离线复用。
 */

/** `META.args` 中单个参数的规格（模板文件里为严格 JSON 写法）。 */
export interface TemplateArgsEntry {
  type: string
  required?: boolean
  default?: unknown
  description?: string
}

/**
 * 每个模板顶部必须声明的 `META` —— 与官方 `workflow` 工具的 meta 契约对齐
 * （`name` + `description` 必填，`phases` 可选进度标注）；`tags`/`args` 为本
 * 插件自有的扩展字段（可选，缺失只发警告，见 src/lib/validate.ts）。
 */
export interface TemplateMeta {
  name: string
  description: string
  tags?: string[]
  args?: Record<string, TemplateArgsEntry>
  phases?: Array<{ title: string; detail?: string }>
}

export type IssueSeverity = 'error' | 'warning'

/** 一条静态校验问题。`ok` 判定只依据 error 级问题。 */
export interface ValidationIssue {
  severity: IssueSeverity
  code: string
  message: string
}

export interface ValidationResult {
  ok: boolean
  issues: ValidationIssue[]
}

/** 加载到内存的单个模板条目。 */
export interface TemplateEntry {
  /** `META.name`（工具按此查找）。 */
  name: string
  /** 模板所在领域子目录名（如 code-review）。 */
  domain: string
  /** 绝对路径。 */
  file: string
  /** 相对模板根目录的 POSIX 路径（如 code-review/pr-deep-review.js）。 */
  relPath: string
  /** 文件全文（即交给 workflow 工具的 script 正文）。 */
  body: string
  meta: TemplateMeta
  /** `REQUIRED_REASON` 声明的原因段（对齐 claude-security 的权威执行入口立场）。 */
  requiredReason: string
  /** 加载时静态校验的问题清单。 */
  issues: ValidationIssue[]
}

export interface LoadedCatalog {
  root: string
  /** 模板根目录是否存在（不存在时 entries 为空，由装配处报错）。 */
  missing: boolean
  entries: TemplateEntry[]
}

/** 官方 `workflow` 工具三个参数（meta / script / args）对应的产出物。 */
export interface RunPayload {
  meta: {
    name: string
    description: string
    tags?: string[]
    phases?: TemplateMeta['phases']
  }
  script: string
  args: Record<string, unknown>
  /** 已声明 required 但仍未填充的参数名。 */
  missingRequired: string[]
}