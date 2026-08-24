/**
 * workflow 模板：data-clean-validate（数据清洗与校验）
 * domain: data
 * 权威执行入口声明见 REQUIRED_REASON：数据清洗需分布分析 + 清洗规则制定
 * + 抽样验证三阶段，属多智能体编排，必须由官方 workflow 工具执行。
 */
const META = {
  "name": "data-clean-validate",
  "description": "数据清洗与校验：拆分布局分析（profile）/清洗（clean）/抽样验证（verify）三阶段，输出清洗报告与规则",
  "tags": ["data", "clean", "validate"],
  "args": {
    "source": { "type": "string", "required": true, "description": "数据源路径或表名" },
    "sampleSize": { "type": "number", "default": 100, "description": "抽样验证条数" }
  },
  "phases": [
    { "title": "profile", "detail": "分布与异常分析" },
    { "title": "clean", "detail": "制定清洗规则" },
    { "title": "verify", "detail": "抽样验证" }
  ]
}

const REQUIRED_REASON = '数据清洗需要分布分析、清洗规则制定与抽样验证分阶段多智能体协作，属于编排任务：必须调用官方 workflow 工具执行。'

phase('profile')
const profile = await agent('分析数据源 ' + args.source + '：字段类型、缺失率、分布异常与质量评分。返回 JSON 对象。', { label: 'profile', phase: 'profile' })

phase('clean')
log('依据分布结论制定清洗规则与兜底策略')

phase('verify')
const verify = await agent('对数据源 ' + args.source + ' 抽样 ' + args.sampleSize + ' 条，验证清洗规则的可执行性、副作用与规则命中率。返回 JSON 对象。', { label: 'verify', phase: 'verify' })

return { "status": profile && verify ? "ok" : "partial", "profile": profile, "verification": verify }