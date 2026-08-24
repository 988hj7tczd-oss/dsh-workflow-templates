/**
 * dsh-workflow-templates 装配入口：加载模板目录，注册
 * wf_template_list / wf_template_search / wf_template_run / wf_template_validate
 * 四个面向模型的工具。模板目录默认取包内 templates/（兼容 src/ 与编译产物
 * lib/ 两种布局），可通过 Config.templatesDir 覆盖。
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { fileURLToPath } from 'node:url'
import { loadCatalogSync, templateBaseName } from './lib/catalog.ts'
import { validateTemplateText } from './lib/validate.ts'
import { defineWfTemplateList } from './tools/wf-template-list.ts'
import { defineWfTemplateRun } from './tools/wf-template-run.ts'
import { defineWfTemplateSearch } from './tools/wf-template-search.ts'
import { defineWfTemplateValidate } from './tools/wf-template-validate.ts'

export const name = 'workflow-templates'

/** 本插件依赖 tools 服务（工具注册）；其余依赖均为可选探测。 */
export const inject = ['tools']

export interface Config {
  /** 官方 workflow 工具名（默认 `workflow`），用于"工具未启用"判定与起点提示。 */
  workflowToolName?: string
  /** 覆盖模板目录；缺省取包内 templates/（new URL('..', import.meta.url) + '/templates'）。 */
  templatesDir?: string
}

/** 校验并带默认值的插件配置。 */
export const Config: z<Config> = z.object({
  workflowToolName: z.string().default('workflow'),
  // schemastery 此版本类型不含 .optional()；以空串默认值表达"未覆盖"。
  templatesDir: z.string().default(''),
})

export function apply(ctx: Context, config: Config = {}): void {
  const templatesDir = config.templatesDir && config.templatesDir !== ''
    ? config.templatesDir
    : `${fileURLToPath(new URL('..', import.meta.url))}templates`
  const catalog = loadCatalogSync(templatesDir)
  if (catalog.missing) {
    throw new Error(`dsh-workflow-templates: 模板目录不存在：${templatesDir}（可用 config.templatesDir 覆盖）`)
  }
  if (catalog.entries.length === 0) {
    throw new Error(`dsh-workflow-templates: 模板目录为空：${templatesDir}`)
  }

  const invalid = catalog.entries.filter((e) => !validateTemplateText(e.body, templateBaseName(e.relPath)).ok)
  if (invalid.length > 0) {
    ctx.logger.warn(
      `[dsh-workflow-templates] ${invalid.length} 个模板未通过静态校验（可用 wf_template_validate 查看）：` +
      invalid.map((e) => `${e.name}${e.issues.some((i) => i.severity === 'error') ? ' ✗' : ''}`).join(', '),
    )
  }
  ctx.logger.info(`[dsh-workflow-templates] 已加载 ${catalog.entries.length} 个 workflow 模板，根目录 ${templatesDir}`)

  const runDeps = { catalog: catalog.entries, workflowToolName: config.workflowToolName ?? 'workflow' }
  ctx.tools.register(defineWfTemplateList(catalog.entries))
  ctx.tools.register(defineWfTemplateSearch(catalog.entries))
  ctx.tools.register(defineWfTemplateRun(ctx, runDeps))
  ctx.tools.register(defineWfTemplateValidate(catalog.entries))
}