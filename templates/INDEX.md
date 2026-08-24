# dsh-workflow-templates 模板目录清单

> 本清单与 `templates/` 磁盘目录**一一对应**，由 `tests/smoke.e2e.ts` 断言
> （每一行 = 一个模板文件）。新增模板请同时：① 在本清单增加一行；
> ② 在对应领域子目录新增 `.js` 文件；③ 通过 `wf_template_validate` / 冒烟测试。
> 目标：后续按本清单扩展至 50+ 个模板。

## code-review（代码评审）

| 模板 | 领域 | 路径 | 说明 |
|---|---|---|---|
| pr-deep-review | code-review | code-review/pr-deep-review.js | 多面 PR 评审：并行多路 subagent 审阅 + 阶段化汇总报告 |

## migration（迁移）

| 模板 | 领域 | 路径 | 说明 |
|---|---|---|---|
| legacy-assess | migration | migration/legacy-assess.js | 遗留系统迁移评估：模块盘点 + 风险研判 + 迁移路线图 |
| dep-uplift-plan | migration | migration/dep-uplift-plan.js | 依赖升级计划：破坏性变更并行研判 + 分级升级路线 |

## release（发布）

| 模板 | 领域 | 路径 | 说明 |
|---|---|---|---|
| release-checklist | release | release/release-checklist.js | 发布前检查清单：构建/测试/文档/回滚四道门禁并行核对 |

## data（数据）

| 模板 | 领域 | 路径 | 说明 |
|---|---|---|---|
| data-clean-validate | data | data/data-clean-validate.js | 数据清洗与校验：分布分析 + 清洗规则 + 抽样验证 |

## docs（文档）

| 模板 | 领域 | 路径 | 说明 |
|---|---|---|---|
| weekly-report | docs | docs/weekly-report.js | 周报编排：并行收集工作线进展并汇总结构化周报 |
| doc-bilingual-review | docs | docs/doc-bilingual-review.js | 双语文档评审：一致性/术语/格式三路并行 |

## security（安全）

| 模板 | 领域 | 路径 | 说明 |
|---|---|---|---|
| dep-vuln-sweep | security | security/dep-vuln-sweep.js | 依赖漏洞扫描编排：按依赖并行核查 CVE，分级输出台账（占位骨架，未内置与 dsh-dep-vuln-scan 的联通） |

## api（API）

| 模板 | 领域 | 路径 | 说明 |
|---|---|---|---|
| api-contract-audit | api | api/api-contract-audit.js | API 契约审计：端点盘点 + 语义核对 + 破坏性变更评估 |

## testing（测试）

| 模板 | 领域 | 路径 | 说明 |
|---|---|---|---|
| test-coverage-plan | testing | testing/test-coverage-plan.js | 测试补全计划：风险分级 + 覆盖盘点 + 按优先级补测清单 |

## refactor（重构）

| 模板 | 领域 | 路径 | 说明 |
|---|---|---|---|
| refactor-feasibility | refactor | refactor/refactor-feasibility.js | 重构可行性评估：目标形态 + 影响面 + 可行性结论 |

## feature（新功能）

| 模板 | 领域 | 路径 | 说明 |
|---|---|---|---|
| feature-slicing | feature | feature/feature-slicing.js | 新功能拆解：需求澄清 + 用户故事切片 + 验收条件 |

## 模板契约速查（validator 检查）

1. 顶部 `const META = { ... }`：**严格 JSON 字面量**（键双引号、无注释、无尾逗号）；
   `name`/`description` 必填（对齐官方 meta 契约）；`tags`/`args`/`phases` 为
   可选扩展（`tags` 缺失仅警告 W-TAGS）；
2. `const REQUIRED_REASON = '<原因段>'`（可选）：权威执行入口声明；缺失仅
   警告 W-REASON（官方 meta 契约无此字段）；
3. 脚本体只使用官方钩子 `agent/pipeline/parallel/phase/log` 与全局 `args`，
   不含 import/export/require（E8 为 error；未知顶层调用仅警告 W-HOOK）；
4. 结尾 `return <表达式>`：只做轻量结构检查（E10：非赋值、数组不省略元素、
   括号配平），**不要求 JSON 字面量**——运行期 JSON 序列化由官方 workflow
   引擎兜底（官方示例 `return 1`、计算型 return 均合法）。

### 与官方 tool-workflow 契约的关系（对齐而非更严格）

- **对齐**：`name`/`description` 必填；`phases` 可选；`return <表达式>` 结尾、
  运行期 JSON 可序列化；纯 JS、禁 `export const meta`（E7）/模块语句（E8）。
- **仅为本插件扩展（官方 meta 无这些键，可选、缺失只发警告）**：`tags`
  （W-TAGS）、`args` 参数规格（W-ARG）、`REQUIRED_REASON`（W-REASON）。
- 不更严：官方合法脚本在本校验器下零误报；本插件的扩展字段不会把
  官方接受的脚本判为错误。

扩展至 50+ 的方向（按领域建议）：sdk-migration、perf-profiling、accessibility-audit、i18n-review、backup-drill、oncall-handover、api-deprecation、test-flake-triage、deps-prune、runtime-upgrade、cert-rotate、cost-optimize 等。