/**
 * wf_template_run：取模板内容 → 生成"调起官方 workflow 工具的完整起点"
 * （meta / script / args 三参数 + 参数填充引导 + 权威执行入口声明）。
 * 只产出起点，不自动执行；会话中 workflow 工具不可见时给出"工具未启用"提示。
 */

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildRunPayload, renderRunMarkdown } from '../lib/render.ts'
import type { TemplateEntry } from '../types.ts'

export interface RunToolDeps {
  catalog: TemplateEntry[]
  /** 官方 workflow 工具名（默认 workflow），用于可见性判定与提示文案。 */
  workflowToolName: string
}

export function defineWfTemplateRun(ctx: Context, deps: RunToolDeps) {
  return defineTool({
    name: 'wf_template_run',
    description:
      '取一个预置 workflow 模板的完整内容，输出调起官方 `workflow` 工具的起点：meta/script/args 三参数、参数填充引导、权威执行入口声明，并探测当前会话 workflow 工具是否可见（不可见给出"工具未启用"提示）。只产出起点，**不自动执行**——执行权在模型/用户与官方 workflow 工具。',
    parameters: {
      name: { type: 'string', required: true, description: '模板名称（wf_template_list 返回的 name）' },
      args: {
        type: 'object',
        additionalProperties: true,
        description: '可选：按 META.args 填充模板参数的 JSON 对象；未填的必填参数会在输出中标出',
      },
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(params, exec) {
      const entry = deps.catalog.find((e) => e.name === params.name)
      if (entry === undefined) {
        const names = deps.catalog.map((e) => e.name).sort().join('、')
        return `未找到模板 \`${params.name}\`。可用模板：${names}（或先调用 \`wf_template_list\`）。`
      }
      const payload = buildRunPayload(entry, params.args)
      // 以调用方 agent 为作用域探测 workflow 工具可见性（缺省为全局视角）。
      const visible = ctx.tools.get(deps.workflowToolName, exec.agent) !== undefined
      return renderRunMarkdown(entry, payload, { visible, workflowToolName: deps.workflowToolName })
    },
  })
}