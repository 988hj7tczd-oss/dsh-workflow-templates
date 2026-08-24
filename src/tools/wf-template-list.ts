/**
 * wf_template_list：列出预置 workflow 模板库目录，
 * 支持按领域 domain / 标签 tag 过滤，渲染为 markdown。
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { filterCatalog, knownDomains } from '../lib/catalog.ts'
import { renderListMarkdown } from '../lib/render.ts'
import type { TemplateEntry } from '../types.ts'

export function defineWfTemplateList(catalog: TemplateEntry[]) {
  const allDomains = knownDomains(catalog)
  return defineTool({
    name: 'wf_template_list',
    description:
      '列出预置 workflow 模板库（dsh-workflow-templates）：按领域 domain 或标签 tag 过滤，返回模板名称、领域、参数与适用场景的 markdown 目录。模板是 workflow 编排脚本，执行需走官方 workflow 工具（见 README 使用边界）。',
    parameters: {
      domain: {
        type: 'string',
        description: '领域过滤（精确，小写）。已知领域：' + (allDomains.join(' / ') || '—'),
      },
      tag: {
        type: 'string',
        description: '标签过滤（命中 META.tags 中的任意一个即保留）',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      const filter = { domain: args.domain, tag: args.tag }
      return renderListMarkdown(filterCatalog(catalog, filter), allDomains, filter)
    },
  })
}