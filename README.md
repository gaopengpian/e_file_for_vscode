# E-File Language Support for VS Code

支持中国电力系统数据标记语言 E-Language 文件：`.e`、`.E`、`.dt`、`.cim`、`.cime`；纯文本文件亦会按内容自动识别。

## 已实现

- 模块折叠：按 `<Table::Type>` 到 `</Table::Type>` 扫描，**不设文件大小上限**。
- 语法高亮：标签、`@`/`@@`、`#`、`$`、`%`、单引号字符串、行首 `//`。
- 彩虹列：`@` 和 `#` 行按字段列循环着色。
- 数据悬浮信息：悬浮数据值时显示表名、完整标签、字段名、数据行号和值。
- E-File Structure：显示表和字段，可点击跳转。
- Outline：显示模块和字段行。
- 格式化：`Ctrl+Alt+Shift+E`，或编辑器右键菜单；保留标签、注释、空行和 CRLF/LF。
- 默认编码：E-File 语言默认 `files.encoding = gbk`，并关闭自动猜测编码。
- 大文件压缩：仅由右键命令主动触发；超过 50 MiB 时流式压缩，连续空格或 Tab 压为一个空格，单引号字符串原样保留。压缩结果低于 50 MiB 才以未保存的 E-File 编辑标签并排打开；不创建副本文件，不写回源文件。标签内容只驻留内存，关闭前需另存为才会保存。

## 使用

1. 在 VS Code 扩展面板安装 `efile-language-support-0.1.0.vsix`。
2. 打开 `.e`、`.E`、`.dt`、`.cim` 或 `.cime` 文件；其他纯文本文件在前 100 行中，忽略 `//` 注释后，连续有效行覆盖 `<`、`@`、`#` 三种行首标记时会自动识别。
3. 若当前文件已经以其他编码打开，执行命令面板中的 `E-File: Reopen with GBK`，再选择 VS Code 的 `Reopen with Encoding` 里的 `GBK`。
4. 将鼠标悬浮到 `#` 数据行的字段值上，查看表与字段信息。
5. 对大于 50 MiB 的 E-File，右键文件或编辑器内容区选择 `E-File: Compress Large File Copy`，手动压缩并在内存中打开压缩内容；编辑后需另存为。

## 编码说明

扩展通过 `configurationDefaults` 将 GBK 设置为 E-File 语言的默认编码。用户或工作区已有的 `files.encoding` 设置优先级更高。扩展不在打开文件时修改磁盘内容，也不强制清除文件只读属性。

## 格式化说明

格式化默认只处理不超过 `efile.formatting.maxBytes` 的文档，默认值为 `1048576` 字节。彩虹列着色只分析不超过 1 MiB 的文档；超限后关闭着色。hover、结构索引与折叠不受此 1 MiB 限制。VS Code 自身约 50 MiB 的扩展文档同步上限仍适用；内容自动识别不会绕过此上限。格式化不会执行文件转换或导入导出。

## 已知限制

- VS Code 没有公开的自定义 Sticky Scroll provider；扩展使用 Document Symbols 配合 VS Code 原生 Sticky Scroll，无法保证 PyCharm 的双层吸顶效果。
- 扫描器是容错结构扫描器，不提供完整 E-Language 语法校验或诊断。
- GBK 默认值可能被用户、工作区或系统策略覆盖。
- 彩虹列着色对大于 1 MiB 的文件关闭；hover、结构索引和折叠保持可用。

## 开发与发布

```powershell
npm install
npm test
npm run check
npm run package
```

正式更新使用 `npm run release`：本地运行测试和类型检查、递增 patch 版本、打包并安装新版 VSIX。推送到 `main` 后，GitHub Actions 会再次验证，递增 patch 版本并提交 `package.json` 与 `package-lock.json`，创建 `v<版本号>` 标签及 GitHub Release，并附上 `.vsix` 安装包。每次推送都会发布一个 patch 版本。
