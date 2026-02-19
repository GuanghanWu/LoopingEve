# CrowdAgents 规则

## 自动流程

当用户说"跑模拟"、"看评价数据"、"运行模拟"等类似语句时，自动执行完整流程：

1. **启动模拟** - 在 `crowdagents/engine/py` 目录下运行 `python run.py`
2. **生成报告** - 自动生成 JSON 和 HTML 报告
3. **启动服务器** - 在 `crowdagents/engine/output` 目录启动本地服务器（端口 8083）
   - 如果端口已被占用，先杀死占用进程再重新启动
4. **打开报告** - 自动打开浏览器访问 `http://localhost:8083/report.html`

## 模拟规范

### 模拟时长
- 标准模拟时长：2分钟（120000ms）
- 运行命令：`python run.py`（在 `crowdagents/engine/py` 目录下）

### 报告查看
- 模拟完成后查看报告
- 报告路径：`crowdagents/engine/output/report.html`
- JSON 数据：`crowdagents/engine/output/report.json`

## 代码规范

### JSON 序列化
- 使用 `orjson` 库进行 JSON 读写，提升性能
- 写入：`file_path.write_bytes(orjson.dumps(data, option=orjson.OPT_INDENT_2))`
- 读取：`data = orjson.loads(file_path.read_bytes())`

### 状态快照
- 每个 Agent 绑定独立的 GameEngine 实例
- 通过状态差异推断事件，而非事件钩子
- 快照间隔：每 100 ticks 创建完整快照
