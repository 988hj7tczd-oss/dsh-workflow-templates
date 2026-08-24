/**
 * wf_template_search：按领域/关键词搜索模板，命中依据标注（tags/描述/名称…）。
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { knownDomains, searchCatalog } from '../lib/catalog.ts'
import { renderSearchMarkdown } from '../lib/render.ts'
import type { TemplateEntry } from '../types.ts'

export function defineWfTemplateSearch(catalog: TemplateEntry[]) {
  const allDomains = knownDomains(catalog)
  return defineTool({
    name: 'wf_template_search',
    description:
      '在预置 workflow 模板库（dsh-workflow-templates）中按关键词搜索：匹配名称、标签、描述、领域与参数名（不区分大小写），标注命中依据并返回 markdown 结果。',
    parameters: {
      query: { type: 'string', required: true, description: '搜索关键词，如"评审"、"迁移"、"漏洞"、"pr"' },
      domain: {
        type: 'string',
        description: '可选：先按领域收窄。已知领域：' + (allDomains.join(' / ') || '—'),
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      return renderSearchMarkdown(args.query, args.domain, searchCatalog(catalog, args.query, args.domain))
    },
  })
}