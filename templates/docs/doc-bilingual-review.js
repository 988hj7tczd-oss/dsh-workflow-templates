/**
 * workflow 模板：doc-bilingual-review（双语文档评审）
 * domain: docs
 * 权威执行入口声明见 REQUIRED_REASON：双语文档需并行评审一致性/术语/格式，
 * 属编排任务，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "doc-bilingual-review",
  "description": "双语文档评审：中英对照一致性、术语表核查、格式与链接完整度三路并行评审，输出问题清单",
  "tags": ["docs", "bilingual", "review"],
  "args": {
    "docPath": { "type": "string", "required": true, "description": "双语文档目录或文件对路径" },
    "strict": { "type": "boolean", "default": true, "description": "严格模式：将格式/术语问题计入阻断项" }
  },
  "phases": [
    { "title": "consistency", "detail": "中英一致性对照" },
    { "title": "terminology", "detail": "术语表核查" },
    { "title": "format", "detail": "格式与链接完整度" }
  ]
}

const REQUIRED_REASON = '双语文档评审需要并行检查中英一致性、术语与格式三类问题再汇总清单，属于多智能体编排任务：必须调用官方 workflow 工具执行。'

phase('consistency')
const consistency = await agent('对照 ' + args.docPath + ' 的中英文档：章节结构、数字、代码示例、术语的一致性差异。返回 JSON 对象。', { label: 'consistency', phase: 'consistency' })

phase('terminology')
const terminology = await agent('核查 ' + args.docPath + ' 的术语表：中英术语映射是否统一、是否存在误译或漏译。返回 JSON 对象。', { label: 'terminology', phase: 'terminology' })

phase('format')
const format = await agent('检查 ' + args.docPath + ' 的格式：链接、代码块、标签闭合与渲染完整性（严格模式：' + args.strict + '）。返回 JSON 对象。', { label: 'format', phase: 'format' })

const issues = [].concat(
  consistency && Array.isArray(consistency.issues) ? consistency.issues : [],
  terminology && Array.isArray(terminology.issues) ? terminology.issues : [],
  format && Array.isArray(format.issues) ? format.issues : []
)
return { "status": "ok", "issueCount": issues.length, "issues": issues }