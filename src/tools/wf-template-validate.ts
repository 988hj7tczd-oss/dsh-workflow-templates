/**
 * wf_template_validate：模板格式校验（meta 完整、钩子合法、return JSON、
 * args 可序列化），输出逐条错误/警告；缺省校验全部，也可指定单个 name。
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import { renderValidateMarkdown } from '../lib/render.ts'
import { validateTemplateText } from '../lib/validate.ts'
import type { TemplateEntry } from '../types.ts'

export function defineWfTemplateValidate(catalog: TemplateEntry[]) {
  return defineTool({
    name: 'wf_template_validate',
    description:
      '校验预置 workflow 模板库（dsh-workflow-templates）：每个模板必须满足 META（严格 JSON 字面量；name/description 必填，tags/args/phases 为可选扩展）、结尾 return <表达式>（运行期需 JSON 可序列化，本校验只做轻量结构检查）、不含 import/export/require 等模块语句；官方钩子 agent/pipeline/parallel/phase/log 与全局 args（未知顶层调用仅警告）；REQUIRED_REASON 原因段可选（缺失仅警告）。输出逐条错误与警告。缺省校验全部模板，也可指定单个 name。',
    parameters: {
      name: { type: 'string', description: '可选：只校验名为该值的单个模板；缺省校验全部' },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      const targets = args.name !== undefined ? catalog.filter((e) => e.name === args.name) : catalog
      if (args.name !== undefined && targets.length === 0) {
        return `未找到模板 \`${args.name}\`。可用模板：${catalog.map((e) => e.name).sort().join('、')}。`
      }
      const results = targets.map((e) => {
        const v = validateTemplateText(e.body, e.file)
        return { name: e.name, domain: e.domain, ok: v.ok, issues: v.issues }
      })
      return renderValidateMarkdown(results)
    },
  })
}