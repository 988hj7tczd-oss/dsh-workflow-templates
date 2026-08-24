# PERMISSIONS — dsh-workflow-templates 权限与失败边界声明

本文件供 DSH STORE 自动审查与人工复核使用，如实描述插件在运行时
做什么、不做什么，以及失败边界。

## 运行时行为
- **目的**：预置 workflow 模板库：`wf_template_list` / `wf_template_search` / `wf_template_run` / `wf_template_validate` 四个工具，把模板内容交给官方 `workflow` 工具发起（不绕过宿主 workflow 引擎）。
- **读取**：本包 `templates/` 目录的编排脚本模板（12 个）；仅读取模板文本。
- **写入**：无默认写面（模板执行由官方 workflow 引擎在其工作区完成）。
- **命令执行**：无直接子进程命令面——模板内容由宿主的官方 `workflow` 工具执行（tool-workflow）；本插件只做 list/search/validate（in-process）。
- **网络**：无。无 fetch/http。
- **凭据/密钥**：不读取、不写、不转发。
- **外部服务**：无。
- **全局资源**：不安装全局包。

## 依赖
| 依赖 | 用途 | 提供方 |
|---|---|---|
| Node.js ≥ 22.18 | 插件加载与工具执行 | DSH 宿主 |
| @deepseek-ai/cordis / dsh-tools / schemastery | DSH 宿主提供的运行时服务（peer） | DSH 宿主 |
| 官方 `workflow` 工具 | 模板实际执行 | DSH 宿主 |

## 文件权限信号说明
- 运行时**不**执行 `chmod`/`chown`；不创建可执行文件。
- 不依赖可执行位；仓库文件均以 644 提交，无 setuid/setgid/sticky 信号。

## 失败边界（结构化，绝不静默）
- 模板格式静态校验失败 → 结构化错误（`wf_template_validate` 明确原因）。
- `workflow` 工具不可见/未启用时 → 给出「工具未启用」提示，不静默失败。
- 模板库只读：不绕过宿主 workflow 工具自执行（约束明确声明）。
