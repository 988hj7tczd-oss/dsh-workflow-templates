# dsh-workflow-templates

> [!IMPORTANT]
> **依赖前置：相邻 `dsh-src` 检出（`link:` 依赖）**
> 本项目在开发形态下使用 `link:` 依赖指向相邻的 DeepSeek Harness 源码检出（`dsh-src`），
> 与当前仓库保持同一父目录布局（`<parent>/dsh-src`）。克隆本仓库后：
> 1. 先把官方 `deepseek-ai/deepseek-harness` 检出到与本仓库同级的 `dsh-src/` 目录，并执行其 `pnpm install && pnpm run build`；
> 2. 再按下方「安装」一节执行本仓库的 `pnpm install --offline && pnpm build` 与测试。
> 发布到 npm 的版本会尽量把 `link:` 依赖替换为 registry 真实版本；无法替换的内部包保持 `link:`，见各包 README 说明。


DSH（DeepSeek Harness）预置 Workflow 模板库插件：内置 12 个（目标 50+）可复用
workflow 编排脚本模板，提供 `wf_template_list / wf_template_search / wf_template_run /
wf_template_validate` 四个面向模型的工具，携带模板格式静态校验，并把模板内容交给官方
`workflow` 工具（tool-workflow）的发起机制。

> 项目定位（2026-08 调研结论）：DSH 有完整 workflow 引擎与 `workflow` 工具，但
> **没有模板库**。本插件补上这一块：把高频多步任务固化为"编排脚本模板"
> （源 1：anthropics 插件 workflows 的形态），并声明哪些模板**必须走官方
> `workflow` 工具执行**（源 2：claude-security 的权威执行入口立场）。模板校验
> **对齐**官方 tool-workflow 契约（源 3：`packages/workflow/tool-workflow/README.md`）
> ——对齐点见下文「校验器与官方契约的关系」；本插件自有的扩展字段（`tags` /
> `args` / `REQUIRED_REASON`）均为可选且缺失只发警告，**不会比官方更严格地
> 拒绝官方合法脚本**。
> 上游参考均为 Proprietary，本插件仅参考其结构，模板正文全部自写，**MIT 许可**。

## workflow 工具的使用边界（必读）

- 仅当模型/用户**显式要求** workflow 或**大规模多智能体编排**时使用官方 `workflow`
  工具（一次编写 JS 编排脚本、扇出多个 subagent、按阶段返回结构化 JSON）；
  一两个委派直接用普通 subagent，不要用 workflow。
- 本模板库**不绕过**这一边界：`wf_template_run` 只产出"调起 workflow 工具的完整起点"
  （meta / script / args 三参数 + 参数填充引导），**不自动执行**——执行权在模型与你，
  以及官方 `workflow` 工具。模板是"引导素材"，不是自动执行器。
- 固定 Ralph 循环由官方 `tool-ralph` 提供，模板库**不包含**它，避免重复。

## 功能

| 工具 | 作用 |
|---|---|
| `wf_template_list` | 列出模板目录：按领域 `domain` 或标签 `tag` 过滤，返回名称/领域/参数/适用场景（markdown） |
| `wf_template_search` | 按关键词搜索：命中名称/标签/描述/领域/参数名，标注命中依据 |
| `wf_template_run` | 取模板内容 → 输出调起官方 `workflow` 工具的三参数起点（meta/script/args）与参数填充引导；探测当前会话 `workflow` 工具可见性，不可见时给出"工具未启用"提示 |
| `wf_template_validate` | 模板格式校验：META 的 name/description 必填、结尾 return 表达式结构合法、无模块语句、钩子合法；插件扩展字段（tags/args/REQUIRED_REASON）可选（缺失仅警告）；逐条输出错误/警告 |

## 安装与挂载

仓库以 Cordis 插件包组织：`package.json` 声明了 `dsh.bundle.patch: ./cordis.yml`，
`cordis.yml` 为 patch 形态，把本文件加入组合（profile 的 bundles 层或 `--patch`）
即可挂载。其插件行 `name` 支持**两种挂载模式**：

**① 已安装/发布态（默认，`cordis.yml` 即此态）**：`name` 用裸包名
`dsh-workflow-templates`，由 loader 经 node_modules 解析到包，入口取
package.json 的 `main`（`lib/index.js`，`src` 构建产物随包发布）：

```yaml
- insert:
    - id: workflow-templates
      name: 'dsh-workflow-templates'
      config:
        workflowToolName: workflow
```

**② 开发态（源码 checkout）**：`name` 用相对路径直挂 `./src/index.ts`
（TS 由 loader/tsx 处理，仅内部开发/测试环境可用）：

```yaml
- insert:
    - id: workflow-templates
      name: './src/index.ts'
      config:
        workflowToolName: workflow
```

> ⚠️ 相对路径模式不适用于纯 Node 生产挂载：loader 对相对插件名按 baseUrl 解析并
> 做 `.ts→.js` 重写（`./src/index.ts → ./src/index.js`），而发布产物不含
> `src/index.js`（`main` 指向 `lib/index.js`）——会 ERR_MODULE_NOT_FOUND。
> 发布/安装后请使用裸包名模式（**推荐**）。

安装依赖并构建（可选，直挂源码无需）：

```sh
npm install
npm run build        # tsc → lib/
```

插件配置：

| 键 | 默认 | 说明 |
|---|---|---|
| `workflowToolName` | `workflow` | 官方 workflow 工具名（与 tool-workflow 的 `toolName` 配置键联动）；改名部署时两处需设为同一值，否则可见性探测会误报"工具未启用" |
| `templatesDir` | 包内 `templates/` | 覆盖模板目录（绝对路径） |

## 模板契约（`wf_template_validate` 检查）

每个模板文件必须满足：

1. **`META`（顶部 module 级常量，严格 JSON 字面量）**：`name`、`description`
   必填（对齐官方 meta 契约）；`tags`、`args`、`phases` 为**可选扩展**——
   官方 meta 契约无 `tags`/`args` 键，缺失 `tags` 只发警告（W-TAGS）；
2. **`REQUIRED_REASON`（原因段，可选）**：声明"该模板为什么必须走官方
   `workflow` 工具执行"——对齐 claude-security 的权威执行入口立场；官方
   meta 契约无此字段，缺失只发警告（W-REASON）；
3. **脚本体只使用官方钩子** `agent / pipeline / parallel / phase / log` 与全局
   `args`：`import`/`export`/`require` 等模块语句为 error（E8）；未知顶层调用
   是软约束，只发警告（W-HOOK）；
4. **结尾 `return <表达式>`**：只做轻量结构检查（非赋值语句、数组不省略元素、
   括号配平），**不要求是 JSON 字面量**——官方引擎接受一切运行期可 JSON
   序列化的返回值（`return 1`、`return { report: x }` 等计算型均可），
   最终序列化由官方 workflow 引擎在运行期兜底。

### 校验器与官方 tool-workflow 契约的关系（对齐而非更严格）

| 维度 | 官方 tool-workflow 契约 | 本校验器 | 关系 |
|---|---|---|---|
| `meta.name` / `meta.description` | 必填 | 必填（E2/E3） | 一致 |
| `meta.phases` | 可选进度标注 | 可选；`phase()` 调用一致性检查为警告（W-PHASE） | 一致 |
| `meta.whenToUse` | 可选 | 不校验（模板库未使用） | 不更严 |
| `meta.tags` / `meta.args` | 官方 schema 无此键（`additionalProperties: true` 透传） | 插件扩展：缺失仅警告（W-TAGS），类型非法才 error（E4/E5） | 不更严 |
| `REQUIRED_REASON` | 官方 meta 无此键 | 插件扩展：缺失仅警告（W-REASON） | 不更严 |
| 结尾 `return` | 必须以 `return <表达式>` 结尾，运行期 JSON 序列化 | 结尾必须有 return（E9）+ 轻量结构检查（E10），序列化由引擎运行期兜底 | 一致（不要求字面量） |
| 脚本语言 | 纯 JS（非 TS/JSX；禁 `export const meta`） | 模块语句为 error（E7/E8） | 一致（E7 即官方"禁 export const meta"） |
| 钩子 | `agent/pipeline/parallel/phase/log` | 未知顶层调用仅警告（W-HOOK） | 不更严 |

结论：**对齐而非更严格**——官方合法脚本（如 `return 1`、计算型 return）在本
校验器下不会被误报；本插件只是在官方契约之上增加可选扩展字段与分类提示。

校验逐条报错（E1–E10 错误、W-* 警告），见 `src/lib/validate.ts`。

## 目录结构

```
dsh-workflow-templates/
├── cordis.yml                 # 组合入口（patch 形态，dsh.bundle 指向它）
├── package.json               # dsh.bundle 声明 / peerDependencies / scripts
├── tsconfig.json              # 类型检查（noEmit）
├── tsconfig.build.json        # 构建 → lib/
├── LICENSE                    # MIT
├── README.md
├── src/
│   ├── index.ts               # 装配：加载模板目录 + 注册 4 个工具
│   ├── types.ts               # 共享类型（零运行时依赖）
│   ├── lib/
│   │   ├── validate.ts        # 模板静态校验（纯 Node，可离线复用）
│   │   ├── catalog.ts         # 目录装载 / 过滤 / 搜索
│   │   └── render.ts          # markdown 渲染 + run 起点装配
│   └── tools/
│       ├── wf-template-list.ts
│       ├── wf-template-search.ts
│       ├── wf-template-run.ts
│       └── wf-template-validate.ts
├── templates/
│   ├── INDEX.md               # 模板目录清单（与磁盘一一对应，测试断言）
│   ├── code-review/pr-deep-review.js
│   ├── migration/legacy-assess.js
│   ├── migration/dep-uplift-plan.js
│   ├── release/release-checklist.js
│   ├── data/data-clean-validate.js
│   ├── docs/weekly-report.js
│   ├── docs/doc-bilingual-review.js
│   ├── security/dep-vuln-sweep.js
│   ├── api/api-contract-audit.js
│   ├── testing/test-coverage-plan.js
│   ├── refactor/refactor-feasibility.js
│   └── feature/feature-slicing.js
└── tests/smoke.e2e.ts         # 离线冒烟测试（纯 Node）
```

## 测试

```sh
npm test                       # node --import tsx tests/smoke.e2e.ts
```

冒烟测试（纯 Node，不依赖 DSH 运行时）逐条覆盖验收标准：

- 全部 12 个模板通过 `wf_template_validate`（零错误、零警告）；
- `wf_template_list` 按领域过滤正确、`search` 命中 tags/描述；
- `pr-deep-review` 产出合法 workflow 起点（meta/script/args 三参数）：整体可
  JSON 序列化，meta 仅含官方允许键（`tags` 经官方 schema 的
  `additionalProperties: true` 透传，不越界），script 全文通过本校验器
  （测试只做序列化与结构断言，未加载官方 schema 做等价校验）；
- 校验器对齐回归：官方合法计算型 return（如 `return 1` / `return { report: x }`）
  不被误报；赋值型 return / 缺失 tags / 缺失 REQUIRED_REASON 各按预期报
  E10 / W-TAGS / W-REASON；
- `INDEX.md` 与模板目录一一对应；
- README 使用边界文案存在。

## 扩展至 50+

1. 在对应领域子目录新增 `.js` 模板文件（遵守模板契约）；
2. 在 `templates/INDEX.md` 增加一行；
3. 跑 `npm test` 与 `wf_template_validate` 确认全绿。

## License

MIT — 见 `LICENSE`。参考的上游项目（anthropics claude-plugins-official 等）
为 Proprietary，本插件仅参考其形态，未拷贝其源码正文。